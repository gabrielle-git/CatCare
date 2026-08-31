-- CatCare — rotinas personalizadas de cuidado (V1)

create unique index if not exists pets_id_household_unique on public.pets(id, household_id);

create table if not exists public.care_routines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 1),
  icon_key text not null default 'heart',
  instructions text,
  recurrence_days integer check (recurrence_days is null or recurrence_days > 0),
  preferred_time time,
  starts_on date not null default (timezone('America/Sao_Paulo', now()))::date,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Permite FKs compostas que amarram household_id da rotina nas tabelas filhas.
create unique index if not exists care_routines_id_household_unique
  on public.care_routines(id, household_id);

create table if not exists public.care_routine_pets (
  household_id uuid not null references public.households(id) on delete cascade,
  routine_id uuid not null,
  pet_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (routine_id, pet_id),
  foreign key (routine_id, household_id)
    references public.care_routines(id, household_id) on delete cascade,
  foreign key (pet_id, household_id)
    references public.pets(id, household_id) on delete cascade
);

create table if not exists public.care_routine_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  routine_id uuid not null,
  pet_id uuid not null,
  completed_at timestamptz not null default now(),
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (routine_id, household_id)
    references public.care_routines(id, household_id) on delete restrict,
  foreign key (pet_id, household_id)
    references public.pets(id, household_id) on delete cascade
);

create index if not exists care_routines_household_active_idx
  on public.care_routines(household_id, active, updated_at desc);

create index if not exists care_routine_pets_pet_idx
  on public.care_routine_pets(pet_id, routine_id);

create index if not exists care_routine_completions_routine_pet_idx
  on public.care_routine_completions(routine_id, pet_id, completed_at desc);

create index if not exists care_routine_completions_household_idx
  on public.care_routine_completions(household_id, completed_at desc);

alter table public.care_routines enable row level security;
alter table public.care_routine_pets enable row level security;
alter table public.care_routine_completions enable row level security;

drop policy if exists "care_routines_member_select" on public.care_routines;
create policy "care_routines_member_select" on public.care_routines
  for select using (public.is_household_member(household_id));

drop policy if exists "care_routines_member_insert" on public.care_routines;
create policy "care_routines_member_insert" on public.care_routines
  for insert with check (public.can_edit_household(household_id));

drop policy if exists "care_routines_member_update" on public.care_routines;
create policy "care_routines_member_update" on public.care_routines
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists "care_routines_member_delete" on public.care_routines;
create policy "care_routines_member_delete" on public.care_routines
  for delete using (public.can_edit_household(household_id));

drop policy if exists "care_routine_pets_member_select" on public.care_routine_pets;
create policy "care_routine_pets_member_select" on public.care_routine_pets
  for select using (public.is_household_member(household_id));

drop policy if exists "care_routine_pets_member_insert" on public.care_routine_pets;
create policy "care_routine_pets_member_insert" on public.care_routine_pets
  for insert with check (public.can_edit_household(household_id));

drop policy if exists "care_routine_pets_member_update" on public.care_routine_pets;
create policy "care_routine_pets_member_update" on public.care_routine_pets
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists "care_routine_pets_member_delete" on public.care_routine_pets;
create policy "care_routine_pets_member_delete" on public.care_routine_pets
  for delete using (public.can_edit_household(household_id));

-- V1: histórico append-only — sem UPDATE/DELETE via RLS.
drop policy if exists "care_routine_completions_member_select" on public.care_routine_completions;
create policy "care_routine_completions_member_select" on public.care_routine_completions
  for select using (public.is_household_member(household_id));

drop policy if exists "care_routine_completions_member_insert" on public.care_routine_completions;
create policy "care_routine_completions_member_insert" on public.care_routine_completions
  for insert with check (public.can_edit_household(household_id));

drop policy if exists "care_routine_completions_member_update" on public.care_routine_completions;
drop policy if exists "care_routine_completions_member_delete" on public.care_routine_completions;
