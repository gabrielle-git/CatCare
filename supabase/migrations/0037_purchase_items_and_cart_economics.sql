-- CatCare / Cuidadim — Purchases & Expenses V2 schema foundation (0037)
--
-- Additive only. CURRENT deployed single-item app must remain compatible.
--
-- Domain:
--   purchases            = cart / order HEADER (official cart money on header totals)
--   purchase_items       = V2 historical LINE truth (multi-item)
--   purchases.product_id / purchases.quantity
--                        = LEGACY single-item compatibility mirrors (NOT V2 line truth)
--   purchase_attachments = receipt/invoice/screenshot/payment-proof metadata links only;
--                        Storage bytes stay outside DB transactions
--
-- OUT OF SCOPE (do not change here):
--   - purchases.product_id NOT NULL / ON DELETE CASCADE (legacy Product delete debt)
--   - cart mutation RPCs (likely 0038+)
--   - product_reviews / cashback / Storage / Auth / UI

-- ---------------------------------------------------------------------------
-- Parent composite keys for same-household FKs
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'purchases_id_household_key'
  ) then
    alter table public.purchases
      add constraint purchases_id_household_key unique (id, household_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_id_household_key'
  ) then
    alter table public.products
      add constraint products_id_household_key unique (id, household_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- A. Purchase header finance columns (defaults preserve old-app totals)
-- ---------------------------------------------------------------------------

alter table public.purchases
  add column if not exists shipping_cents integer not null default 0
    constraint purchases_shipping_cents_nonneg check (shipping_cents >= 0),
  add column if not exists credits_applied_cents integer not null default 0
    constraint purchases_credits_applied_cents_nonneg check (credits_applied_cents >= 0),
  add column if not exists discount_rate_bps integer
    constraint purchases_discount_rate_bps_range
      check (discount_rate_bps is null or (discount_rate_bps >= 0 and discount_rate_bps <= 10000));

comment on column public.purchases.shipping_cents is
  'V2 cart shipping in integer cents. Default 0 preserves legacy totals. 0 may mean free/no shipping charge.';
comment on column public.purchases.credits_applied_cents is
  'V2 credits applied to this cart in integer cents. Not cashback earned.';
comment on column public.purchases.discount_rate_bps is
  'When NULL, discount_cents is a fixed monetary discount. When set (0..10000), UI entered a percentage; discount_cents remains monetary truth.';
comment on column public.purchases.product_id is
  'LEGACY single-item compatibility mirror. Official multi-item product identity lives on purchase_items. Do not treat as V2 line truth.';
comment on column public.purchases.quantity is
  'LEGACY single-item compatibility mirror. Official line quantities live on purchase_items.';
comment on table public.purchases is
  'Cart/order HEADER. Official cart money: subtotal_cents, discount_cents, credits_applied_cents, shipping_cents, amount_cents (final). Lines live in purchase_items.';

-- ---------------------------------------------------------------------------
-- B. purchase_items
-- ---------------------------------------------------------------------------

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  purchase_id uuid not null,
  product_id uuid null,
  position integer not null default 0,
  product_name text not null,
  brand text null,
  category text not null,
  package_size text null,
  quantity numeric(9,2) not null,
  unit_price_cents integer not null,
  line_subtotal_cents integer not null,
  notes text null,
  created_at timestamptz not null default now(),
  constraint purchase_items_position_nonneg check (position >= 0),
  constraint purchase_items_quantity_positive check (quantity > 0),
  constraint purchase_items_unit_price_nonneg check (unit_price_cents >= 0),
  constraint purchase_items_line_subtotal_nonneg check (line_subtotal_cents >= 0),
  constraint purchase_items_category_check check (
    category in (
      'dry_food', 'wet_food', 'litter', 'treat',
      'hygiene', 'medicine', 'accessory', 'other'
    )
  ),
  -- Deterministic cents math (numeric × integer → numeric; round → numeric; cast → int)
  constraint purchase_items_line_subtotal_matches_qty_price check (
    line_subtotal_cents = (round(quantity * unit_price_cents))::integer
  ),
  constraint purchase_items_id_household_key unique (id, household_id),
  constraint purchase_items_purchase_household_fkey
    foreign key (purchase_id, household_id)
    references public.purchases (id, household_id)
    on delete cascade,
  -- Catalog pointer only. ON DELETE SET NULL nulls product_id when the Product row is
  -- deleted AND the parent Purchase still exists (so the item row survives).
  -- IMPORTANT: legacy purchases.product_id remains ON DELETE CASCADE, so deleting a
  -- Product that is still referenced by the Purchase HEADER still deletes that Purchase
  -- (and cascades its purchase_items). SET NULL on items does NOT by itself make
  -- historical Purchases survive Product deletion — that remains deferred debt.
  -- Cross-household product linking is enforced by trigger below (composite FK with
  -- ON DELETE SET NULL would also null household_id in PostgreSQL — unsafe).
  constraint purchase_items_product_fkey
    foreign key (product_id)
    references public.products (id)
    on delete set null
);

create index if not exists purchase_items_purchase_idx
  on public.purchase_items (purchase_id);

create index if not exists purchase_items_purchase_position_id_idx
  on public.purchase_items (purchase_id, position, id);

create index if not exists purchase_items_household_idx
  on public.purchase_items (household_id);

create index if not exists purchase_items_product_idx
  on public.purchase_items (product_id);

comment on table public.purchase_items is
  'V2 historical multi-item line truth for a Purchase cart. Snapshot columns survive Product rename. product_id SET NULL applies only when the parent Purchase survives Product deletion; legacy header Product CASCADE still removes Purchase+items today. Pets never affect line economics.';

create or replace function public.purchase_items_assert_product_household()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.product_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.products pr
    where pr.id = new.product_id
      and pr.household_id = new.household_id
  ) then
    raise exception 'purchase_items.product_id must belong to the same household'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_items_assert_product_household on public.purchase_items;
create trigger purchase_items_assert_product_household
  before insert or update of product_id, household_id
  on public.purchase_items
  for each row
  execute function public.purchase_items_assert_product_household();

-- ---------------------------------------------------------------------------
-- C. purchase_item_pets
-- ---------------------------------------------------------------------------

create table if not exists public.purchase_item_pets (
  household_id uuid not null references public.households(id) on delete cascade,
  purchase_item_id uuid not null,
  pet_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (purchase_item_id, pet_id),
  constraint purchase_item_pets_item_household_fkey
    foreign key (purchase_item_id, household_id)
    references public.purchase_items (id, household_id)
    on delete cascade,
  constraint purchase_item_pets_pet_household_fkey
    foreign key (pet_id, household_id)
    references public.pets (id, household_id)
    on delete cascade
);

create index if not exists purchase_item_pets_pet_idx
  on public.purchase_item_pets (pet_id, purchase_item_id);

comment on table public.purchase_item_pets is
  'Optional item-level pet beneficiaries. Zero rows → inherit purchase_pets. >=1 rows → authoritative for that item. Never affects money.';

-- ---------------------------------------------------------------------------
-- D. purchase_attachments
-- ---------------------------------------------------------------------------

create table if not exists public.purchase_attachments (
  purchase_id uuid not null,
  attachment_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  position integer not null default 0,
  kind text null,
  created_at timestamptz not null default now(),
  primary key (purchase_id, attachment_id),
  constraint purchase_attachments_attachment_unique unique (attachment_id),
  constraint purchase_attachments_position_unique unique (purchase_id, position),
  constraint purchase_attachments_position_nonneg check (position >= 0),
  constraint purchase_attachments_kind_check check (
    kind is null
    or kind in ('receipt', 'invoice', 'screenshot', 'payment_proof')
  ),
  constraint purchase_attachments_purchase_household_fkey
    foreign key (purchase_id, household_id)
    references public.purchases (id, household_id)
    on delete cascade,
  constraint purchase_attachments_attachment_household_fkey
    foreign key (attachment_id, household_id)
    references public.attachments (id, household_id)
    on delete cascade
);

create index if not exists purchase_attachments_purchase_idx
  on public.purchase_attachments (purchase_id, position);

create index if not exists purchase_attachments_household_idx
  on public.purchase_attachments (household_id);

comment on table public.purchase_attachments is
  'Links Purchase carts to public.attachments (receipt/invoice/screenshot/payment_proof). Metadata only; Storage upload/delete stays outside DB transactions. Not duplicated onto Expense.';

-- ---------------------------------------------------------------------------
-- F. Partial UNIQUE principal expense link (defensive precheck)
-- ---------------------------------------------------------------------------

do $$
declare
  dup_count integer;
begin
  select count(*)::integer into dup_count
  from (
    select expense_id
    from public.purchases
    where expense_id is not null
    group by expense_id
    having count(*) > 1
  ) d;

  if dup_count > 0 then
    raise exception
      '0037 aborted: % duplicate non-null purchases.expense_id value(s); refuse silent cleanup',
      dup_count;
  end if;
end $$;

create unique index if not exists purchases_expense_id_uidx
  on public.purchases (expense_id)
  where expense_id is not null;

-- ---------------------------------------------------------------------------
-- E. Deterministic legacy purchase → one purchase_items row
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  merch integer;
  unit_price integer;
  computed_subtotal integer;
begin
  for r in
    select
      p.id,
      p.household_id,
      p.product_id,
      p.quantity,
      p.amount_cents,
      p.subtotal_cents,
      p.discount_cents,
      pr.name as product_name,
      pr.brand as product_brand,
      pr.category as product_category,
      pr.package_size as product_package_size
    from public.purchases p
    left join public.products pr on pr.id = p.product_id
    where not exists (
      select 1 from public.purchase_items i where i.purchase_id = p.id
    )
  loop
    if r.product_name is null or r.product_category is null then
      raise exception
        '0037 backfill blocked: purchase % has unresolvable product_id (will not invent snapshot)',
        r.id;
    end if;

    if r.quantity is null or r.quantity <= 0 then
      raise exception
        '0037 backfill blocked: purchase % has invalid quantity',
        r.id;
    end if;

    merch := coalesce(r.subtotal_cents, r.amount_cents + coalesce(r.discount_cents, 0));
    if merch is null or merch < 0 then
      raise exception
        '0037 backfill blocked: purchase % has non-representable merchandise cents',
        r.id;
    end if;

    -- Nearest integer-cent unit price via division (supports qty < 1).
    -- Do NOT enumerate candidate unit prices from 0..merchandise: that misses
    -- unit prices > merch when quantity is fractional (e.g. qty=0.50, merch=100 → unit=200).
    unit_price := round(merch::numeric / r.quantity)::integer;
    if unit_price is null or unit_price < 0 then
      raise exception
        '0037 backfill blocked: purchase % qty=% merchandise=% produced invalid unit_price_cents',
        r.id, r.quantity, merch;
    end if;

    computed_subtotal := (round(r.quantity * unit_price))::integer;
    if computed_subtotal <> merch then
      raise exception
        '0037 backfill blocked: purchase % qty=% merchandise=% has no integer unit_price_cents satisfying round(qty*unit)=merchandise (candidate unit=% computed=%)',
        r.id, r.quantity, merch, unit_price, computed_subtotal;
    end if;

    insert into public.purchase_items (
      id,
      household_id,
      purchase_id,
      product_id,
      position,
      product_name,
      brand,
      category,
      package_size,
      quantity,
      unit_price_cents,
      line_subtotal_cents,
      notes
    ) values (
      gen_random_uuid(),
      r.household_id,
      r.id,
      r.product_id,
      0,
      r.product_name,
      r.product_brand,
      r.product_category,
      r.product_package_size,
      r.quantity,
      unit_price,
      merch,
      null
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- G/H already covered by table constraints + indexes above
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- I. RLS
-- ---------------------------------------------------------------------------

alter table public.purchase_items enable row level security;
alter table public.purchase_item_pets enable row level security;
alter table public.purchase_attachments enable row level security;

drop policy if exists purchase_items_member_select on public.purchase_items;
create policy purchase_items_member_select on public.purchase_items
  for select using (public.is_household_member(household_id));

drop policy if exists purchase_items_member_insert on public.purchase_items;
create policy purchase_items_member_insert on public.purchase_items
  for insert with check (public.can_edit_household(household_id));

drop policy if exists purchase_items_member_update on public.purchase_items;
create policy purchase_items_member_update on public.purchase_items
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists purchase_items_member_delete on public.purchase_items;
create policy purchase_items_member_delete on public.purchase_items
  for delete using (public.can_edit_household(household_id));

drop policy if exists purchase_item_pets_member_select on public.purchase_item_pets;
create policy purchase_item_pets_member_select on public.purchase_item_pets
  for select using (public.is_household_member(household_id));

drop policy if exists purchase_item_pets_member_insert on public.purchase_item_pets;
create policy purchase_item_pets_member_insert on public.purchase_item_pets
  for insert with check (public.can_edit_household(household_id));

drop policy if exists purchase_item_pets_member_update on public.purchase_item_pets;
create policy purchase_item_pets_member_update on public.purchase_item_pets
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists purchase_item_pets_member_delete on public.purchase_item_pets;
create policy purchase_item_pets_member_delete on public.purchase_item_pets
  for delete using (public.can_edit_household(household_id));

drop policy if exists purchase_attachments_member_select on public.purchase_attachments;
create policy purchase_attachments_member_select on public.purchase_attachments
  for select using (public.is_household_member(household_id));

drop policy if exists purchase_attachments_member_insert on public.purchase_attachments;
create policy purchase_attachments_member_insert on public.purchase_attachments
  for insert with check (public.can_edit_household(household_id));

drop policy if exists purchase_attachments_member_update on public.purchase_attachments;
create policy purchase_attachments_member_update on public.purchase_attachments
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists purchase_attachments_member_delete on public.purchase_attachments;
create policy purchase_attachments_member_delete on public.purchase_attachments
  for delete using (public.can_edit_household(household_id));

-- ---------------------------------------------------------------------------
-- J. Grants
-- ---------------------------------------------------------------------------
-- Table access follows existing commerce/entity_pets convention: RLS + Supabase
-- default role grants. No extra anon broadening. Trigger helper stays internal.

revoke all on function public.purchase_items_assert_product_household() from public;
revoke all on function public.purchase_items_assert_product_household() from anon;
revoke all on function public.purchase_items_assert_product_household() from authenticated;
