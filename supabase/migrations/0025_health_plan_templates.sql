-- CatCare — modelos de plano compartilhados (mesma cobertura para todos os pets no mesmo plano)

create table if not exists public.health_plan_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  provider text not null check (provider in ('petlove', 'other')),
  plan_name text not null,
  coverage_summary text,
  guide_id uuid references public.health_plan_guides(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, provider, plan_name)
);

create index if not exists health_plan_templates_household_idx on public.health_plan_templates(household_id);

alter table public.health_plans
  add column if not exists template_id uuid references public.health_plan_templates(id) on delete set null;

alter table public.health_plan_templates enable row level security;

drop policy if exists health_plan_templates_member_select on public.health_plan_templates;
create policy health_plan_templates_member_select on public.health_plan_templates
  for select using (public.is_household_member(household_id));

drop policy if exists health_plan_templates_member_insert on public.health_plan_templates;
create policy health_plan_templates_member_insert on public.health_plan_templates
  for insert with check (public.can_edit_household(household_id));

drop policy if exists health_plan_templates_member_update on public.health_plan_templates;
create policy health_plan_templates_member_update on public.health_plan_templates
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists health_plan_templates_member_delete on public.health_plan_templates;
create policy health_plan_templates_member_delete on public.health_plan_templates
  for delete using (public.can_edit_household(household_id));
