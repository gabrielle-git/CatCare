-- CatCare / Cuidadim — Commerce lifecycle foundation (0038)
--
-- Schema only:
--   products.archived_at              = soft catalog lifecycle (NULL = active)
--   product_reviews.purchase_id       = optional originating Purchase link
--
-- Review remains Product-scoped. purchase_id is optional origin metadata.
--
-- Purchase Product truth for linkage / backfill:
--   IF Purchase has >=1 purchase_items → items are truth
--   ELSE → legacy header purchases.product_id
-- Header product_id is NOT used when persisted items exist.
--
-- Civil-day matching uses America/Sao_Paulo (app factual timezone).
--
-- OUT OF SCOPE:
--   - 0039 cart mutation RPC
--   - 0040 purchases.product_id nullable / ON DELETE SET NULL
--   - archive/restore app UX
--   - review app write/read path changes
--   - Auth / Storage

-- ---------------------------------------------------------------------------
-- A. products.archived_at
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists archived_at timestamptz null;

comment on column public.products.archived_at is
  'NULL = active catalog Product. Non-NULL = archived (hidden from new Purchases / active recommendations; historical Purchases and reviews remain).';

-- Active catalog reads order by household + updated_at desc (listCommerce).
create index if not exists products_household_active_updated_idx
  on public.products (household_id, updated_at desc)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- B. product_reviews.purchase_id (optional origin link)
-- ---------------------------------------------------------------------------

alter table public.product_reviews
  add column if not exists purchase_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_reviews_purchase_id_fkey'
  ) then
    alter table public.product_reviews
      add constraint product_reviews_purchase_id_fkey
      foreign key (purchase_id)
      references public.purchases (id)
      on delete set null;
  end if;
end $$;

comment on column public.product_reviews.purchase_id is
  'Optional originating Purchase when known. Review remains Product-scoped. ON DELETE SET NULL so deleting a Purchase does not erase the Product opinion.';

-- One linked review per (Purchase, Product). Standalone reviews (purchase_id NULL) unrestricted.
create unique index if not exists product_reviews_purchase_product_uidx
  on public.product_reviews (purchase_id, product_id)
  where purchase_id is not null;

-- ---------------------------------------------------------------------------
-- C. Same-household + Purchase Product-membership trigger
-- ---------------------------------------------------------------------------

create or replace function public.product_reviews_assert_purchase_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  purchase_household uuid;
  purchase_product uuid;
  has_items boolean;
begin
  if new.purchase_id is null then
    return new;
  end if;

  select p.household_id, p.product_id
    into purchase_household, purchase_product
  from public.purchases p
  where p.id = new.purchase_id;

  if purchase_household is null then
    raise exception 'product_reviews.purchase_id must reference an existing Purchase'
      using errcode = '23514';
  end if;

  if purchase_household is distinct from new.household_id then
    raise exception 'product_reviews.purchase_id must belong to the same household'
      using errcode = '23514';
  end if;

  select exists (
    select 1
    from public.purchase_items pi
    where pi.purchase_id = new.purchase_id
      and pi.household_id = new.household_id
  ) into has_items;

  if has_items then
    -- Persisted items are Product truth; do NOT fall back to header product_id.
    if not exists (
      select 1
      from public.purchase_items pi
      where pi.purchase_id = new.purchase_id
        and pi.household_id = new.household_id
        and pi.product_id = new.product_id
    ) then
      raise exception 'product_reviews.product_id must belong to a purchase_items row of the linked Purchase'
        using errcode = '23514';
    end if;
  else
    -- Legacy zero-item Purchase: header product_id is fallback truth.
    if purchase_product is distinct from new.product_id then
      raise exception 'product_reviews.product_id must match the linked legacy Purchase product_id'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists product_reviews_assert_purchase_context on public.product_reviews;
create trigger product_reviews_assert_purchase_context
  before insert or update of purchase_id, household_id, product_id
  on public.product_reviews
  for each row
  execute function public.product_reviews_assert_purchase_context();

revoke all on function public.product_reviews_assert_purchase_context() from public;
revoke all on function public.product_reviews_assert_purchase_context() from anon;
revoke all on function public.product_reviews_assert_purchase_context() from authenticated;

-- ---------------------------------------------------------------------------
-- D. Deterministic backfill of purchase_id
-- ---------------------------------------------------------------------------
-- Civil day in America/Sao_Paulo. Product truth matches trigger semantics.
-- Exactly one DISTINCT candidate Purchase → link; 0 or >1 → leave NULL.

with candidates as (
  select distinct
    r.id as review_id,
    p.id as purchase_id
  from public.product_reviews r
  inner join public.purchases p
    on p.household_id = r.household_id
   and (p.purchased_at at time zone 'America/Sao_Paulo')::date
     = (r.reviewed_at at time zone 'America/Sao_Paulo')::date
  where r.purchase_id is null
    and (
      case
        when exists (
          select 1
          from public.purchase_items pi
          where pi.purchase_id = p.id
            and pi.household_id = p.household_id
        ) then exists (
          select 1
          from public.purchase_items pi
          where pi.purchase_id = p.id
            and pi.household_id = r.household_id
            and pi.product_id = r.product_id
        )
        else p.product_id = r.product_id
      end
    )
),
singleton as (
  select
    review_id,
    (array_agg(purchase_id order by purchase_id))[1] as purchase_id
  from candidates
  group by review_id
  having count(*) = 1
)
update public.product_reviews r
set purchase_id = s.purchase_id
from singleton s
where r.id = s.review_id
  and r.purchase_id is null;
