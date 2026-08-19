-- CatCare — clubes e assinaturas com desconto (Clube Petlove, Clube Petz, etc.)

create table if not exists public.benefit_memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check(kind in ('petlove_club', 'petz_club', 'other')),
  custom_name text,
  active boolean not null default false,
  monthly_fee_cents integer check(monthly_fee_cents is null or monthly_fee_cents >= 0),
  renews_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, kind)
);

create index if not exists benefit_memberships_household_idx on public.benefit_memberships(household_id, active);

alter table public.purchases
  add column if not exists membership_id uuid references public.benefit_memberships(id) on delete set null;

alter table public.benefit_memberships enable row level security;

drop policy if exists benefit_memberships_member_select on public.benefit_memberships;
create policy benefit_memberships_member_select on public.benefit_memberships
  for select using (public.is_household_member(household_id));

drop policy if exists benefit_memberships_member_insert on public.benefit_memberships;
create policy benefit_memberships_member_insert on public.benefit_memberships
  for insert with check (public.can_edit_household(household_id));

drop policy if exists benefit_memberships_member_update on public.benefit_memberships;
create policy benefit_memberships_member_update on public.benefit_memberships
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists benefit_memberships_member_delete on public.benefit_memberships;
create policy benefit_memberships_member_delete on public.benefit_memberships
  for delete using (public.can_edit_household(household_id));
