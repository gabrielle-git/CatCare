-- CatCare — plano de saúde, coparticipação e descontos em compras

alter table public.purchases
  add column if not exists subtotal_cents integer check(subtotal_cents is null or subtotal_cents >= 0),
  add column if not exists discount_cents integer not null default 0 check(discount_cents >= 0),
  add column if not exists coupon_code text,
  add column if not exists petlove_club boolean not null default false;

create table if not exists public.health_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  provider text not null default 'petlove',
  plan_name text not null,
  monthly_fee_cents integer check(monthly_fee_cents is null or monthly_fee_cents >= 0),
  started_at date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id)
);

create table if not exists public.health_plan_copay_rules (
  id uuid primary key default gen_random_uuid(),
  health_plan_id uuid not null references public.health_plans(id) on delete cascade,
  service_type text not null check(service_type in (
    'consultation', 'exam', 'surgery', 'hospitalization',
    'vaccine', 'deworming', 'emergency', 'physiotherapy', 'other'
  )),
  copay_cents integer check(copay_cents is null or copay_cents >= 0),
  notes text,
  sort_order smallint not null default 0,
  unique (health_plan_id, service_type)
);

create index if not exists health_plans_household_idx on public.health_plans(household_id, active);
create index if not exists health_plan_copay_rules_plan_idx on public.health_plan_copay_rules(health_plan_id, sort_order);

alter table public.health_plans enable row level security;
alter table public.health_plan_copay_rules enable row level security;

drop policy if exists health_plans_member_select on public.health_plans;
create policy health_plans_member_select on public.health_plans
  for select using (public.is_household_member(household_id));

drop policy if exists health_plans_member_insert on public.health_plans;
create policy health_plans_member_insert on public.health_plans
  for insert with check (public.can_edit_household(household_id));

drop policy if exists health_plans_member_update on public.health_plans;
create policy health_plans_member_update on public.health_plans
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists health_plans_member_delete on public.health_plans;
create policy health_plans_member_delete on public.health_plans
  for delete using (public.can_edit_household(household_id));

drop policy if exists health_plan_copay_rules_member_select on public.health_plan_copay_rules;
create policy health_plan_copay_rules_member_select on public.health_plan_copay_rules
  for select using (
    exists (
      select 1 from public.health_plans hp
      where hp.id = health_plan_id and public.is_household_member(hp.household_id)
    )
  );

drop policy if exists health_plan_copay_rules_member_insert on public.health_plan_copay_rules;
create policy health_plan_copay_rules_member_insert on public.health_plan_copay_rules
  for insert with check (
    exists (
      select 1 from public.health_plans hp
      where hp.id = health_plan_id and public.can_edit_household(hp.household_id)
    )
  );

drop policy if exists health_plan_copay_rules_member_update on public.health_plan_copay_rules;
create policy health_plan_copay_rules_member_update on public.health_plan_copay_rules
  for update using (
    exists (
      select 1 from public.health_plans hp
      where hp.id = health_plan_id and public.can_edit_household(hp.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.health_plans hp
      where hp.id = health_plan_id and public.can_edit_household(hp.household_id)
    )
  );

drop policy if exists health_plan_copay_rules_member_delete on public.health_plan_copay_rules;
create policy health_plan_copay_rules_member_delete on public.health_plan_copay_rules
  for delete using (
    exists (
      select 1 from public.health_plans hp
      where hp.id = health_plan_id and public.can_edit_household(hp.household_id)
    )
  );
