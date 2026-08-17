-- CatCare — memórias com vários gatos, foto e arquivamento recuperável

alter table public.memories add column if not exists archived_at timestamptz;
create unique index if not exists pets_id_household_unique on public.pets(id, household_id);

create table if not exists public.memory_pets (
  household_id uuid not null references public.households(id) on delete cascade,
  memory_id uuid not null references public.memories(id) on delete cascade,
  pet_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (memory_id, pet_id),
  foreign key (pet_id, household_id) references public.pets(id, household_id) on delete cascade
);

create index if not exists memories_household_date_idx on public.memories(household_id, archived_at, occurred_at desc);
create index if not exists memory_pets_pet_idx on public.memory_pets(pet_id, memory_id);

alter table public.memory_pets enable row level security;
drop policy if exists "memory_pets_member_select" on public.memory_pets;
create policy "memory_pets_member_select" on public.memory_pets for select using (public.is_household_member(household_id));
drop policy if exists "memory_pets_member_insert" on public.memory_pets;
create policy "memory_pets_member_insert" on public.memory_pets for insert with check (public.can_edit_household(household_id));
drop policy if exists "memory_pets_member_update" on public.memory_pets;
create policy "memory_pets_member_update" on public.memory_pets for update using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
drop policy if exists "memory_pets_member_delete" on public.memory_pets;
create policy "memory_pets_member_delete" on public.memory_pets for delete using (public.can_edit_household(household_id));
