-- CatCare — compras, produtos e avaliações

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  brand text,
  category text not null check(category in ('dry_food','wet_food','litter','treat','hygiene','medicine','accessory','other')),
  package_size text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  expense_id uuid references public.expenses(id) on delete set null,
  store_name text not null,
  channel text not null default 'physical_store' check(channel in ('physical_store','online_store','marketplace','delivery','veterinary','other')),
  quantity numeric(9,2) not null default 1 check(quantity > 0),
  amount_cents integer not null check(amount_cents >= 0),
  purchased_at timestamptz not null default now(),
  product_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  quality_score integer not null check(quality_score between 1 and 5),
  acceptance_score integer not null check(acceptance_score between 1 and 5),
  cost_benefit_score integer not null check(cost_benefit_score between 1 and 5),
  would_buy_again boolean not null default true,
  notes text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_household_category_idx on public.products(household_id, category);
create index if not exists purchases_household_date_idx on public.purchases(household_id, purchased_at desc);
create index if not exists purchases_product_date_idx on public.purchases(product_id, purchased_at desc);
create index if not exists product_reviews_product_date_idx on public.product_reviews(product_id, reviewed_at desc);

alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.product_reviews enable row level security;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','purchases','product_reviews'] LOOP
    EXECUTE format('drop policy if exists %I on public.%I', t||'_member_select', t);
    EXECUTE format('create policy %I on public.%I for select using (public.is_household_member(household_id))', t||'_member_select', t);
    EXECUTE format('drop policy if exists %I on public.%I', t||'_member_insert', t);
    EXECUTE format('create policy %I on public.%I for insert with check (public.can_edit_household(household_id))', t||'_member_insert', t);
    EXECUTE format('drop policy if exists %I on public.%I', t||'_member_update', t);
    EXECUTE format('create policy %I on public.%I for update using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id))', t||'_member_update', t);
    EXECUTE format('drop policy if exists %I on public.%I', t||'_member_delete', t);
    EXECUTE format('create policy %I on public.%I for delete using (public.can_edit_household(household_id))', t||'_member_delete', t);
  END LOOP;
END $$;
