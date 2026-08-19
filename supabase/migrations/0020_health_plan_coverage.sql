-- CatCare — cobertura do plano de saúde

alter table public.health_plans
  add column if not exists coverage_summary text;

alter table public.health_plan_copay_rules
  add column if not exists coverage_status text check(
    coverage_status is null or coverage_status in ('covered', 'not_covered', 'partial')
  ),
  add column if not exists coverage_notes text;
