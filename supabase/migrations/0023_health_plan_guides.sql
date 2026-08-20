-- CatCare — tabelas de referência de serviços e coparticipação (Petlove e outros planos)

create table if not exists public.health_plan_guides (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  slug text not null,
  title text not null,
  provider text not null default 'other' check (provider in ('petlove', 'other')),
  base_monthly_fee_cents integer check (base_monthly_fee_cents is null or base_monthly_fee_cents >= 0),
  official_url text,
  notes text,
  show_multi_pet_discount boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, slug)
);

create table if not exists public.health_plan_guide_services (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.health_plan_guides(id) on delete cascade,
  group_key text not null default 'custom',
  group_title text not null,
  name text not null,
  copay_cents integer not null default 0 check (copay_cents >= 0),
  annual_limit text,
  waiting_days integer not null default 0 check (waiting_days >= 0),
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists health_plan_guides_household_idx on public.health_plan_guides(household_id);
create index if not exists health_plan_guide_services_guide_idx on public.health_plan_guide_services(guide_id, sort_order);

alter table public.health_plan_guides enable row level security;
alter table public.health_plan_guide_services enable row level security;

drop policy if exists health_plan_guides_member_select on public.health_plan_guides;
create policy health_plan_guides_member_select on public.health_plan_guides
  for select using (public.is_household_member(household_id));

drop policy if exists health_plan_guides_member_insert on public.health_plan_guides;
create policy health_plan_guides_member_insert on public.health_plan_guides
  for insert with check (public.can_edit_household(household_id));

drop policy if exists health_plan_guides_member_update on public.health_plan_guides;
create policy health_plan_guides_member_update on public.health_plan_guides
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists health_plan_guides_member_delete on public.health_plan_guides;
create policy health_plan_guides_member_delete on public.health_plan_guides
  for delete using (public.can_edit_household(household_id));

drop policy if exists health_plan_guide_services_member_select on public.health_plan_guide_services;
create policy health_plan_guide_services_member_select on public.health_plan_guide_services
  for select using (
    exists (
      select 1 from public.health_plan_guides g
      where g.id = guide_id and public.is_household_member(g.household_id)
    )
  );

drop policy if exists health_plan_guide_services_member_insert on public.health_plan_guide_services;
create policy health_plan_guide_services_member_insert on public.health_plan_guide_services
  for insert with check (
    exists (
      select 1 from public.health_plan_guides g
      where g.id = guide_id and public.can_edit_household(g.household_id)
    )
  );

drop policy if exists health_plan_guide_services_member_update on public.health_plan_guide_services;
create policy health_plan_guide_services_member_update on public.health_plan_guide_services
  for update using (
    exists (
      select 1 from public.health_plan_guides g
      where g.id = guide_id and public.can_edit_household(g.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.health_plan_guides g
      where g.id = guide_id and public.can_edit_household(g.household_id)
    )
  );

drop policy if exists health_plan_guide_services_member_delete on public.health_plan_guide_services;
create policy health_plan_guide_services_member_delete on public.health_plan_guide_services
  for delete using (
    exists (
      select 1 from public.health_plan_guides g
      where g.id = guide_id and public.can_edit_household(g.household_id)
    )
  );
