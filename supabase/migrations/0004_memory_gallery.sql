-- CatCare — galeria com várias fotos por memória

create unique index if not exists memories_id_household_unique on public.memories(id, household_id);

create table if not exists public.memory_media (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  memory_id uuid not null,
  storage_path text not null,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (memory_id, storage_path),
  unique (memory_id, position),
  foreign key (memory_id, household_id) references public.memories(id, household_id) on delete cascade
);

-- Preserva como primeira foto tudo o que já estava salvo no campo antigo.
insert into public.memory_media (household_id, memory_id, storage_path, position)
select household_id, id, media_path, 0
from public.memories
where media_path is not null
on conflict (memory_id, storage_path) do nothing;

create index if not exists memory_media_memory_position_idx on public.memory_media(memory_id, position);

alter table public.memory_media enable row level security;
drop policy if exists "memory_media_member_select" on public.memory_media;
create policy "memory_media_member_select" on public.memory_media for select using (public.is_household_member(household_id));
drop policy if exists "memory_media_member_insert" on public.memory_media;
create policy "memory_media_member_insert" on public.memory_media for insert with check (public.can_edit_household(household_id));
drop policy if exists "memory_media_member_update" on public.memory_media;
create policy "memory_media_member_update" on public.memory_media for update using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
drop policy if exists "memory_media_member_delete" on public.memory_media;
create policy "memory_media_member_delete" on public.memory_media for delete using (public.can_edit_household(household_id));
