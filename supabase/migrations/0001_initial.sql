-- CatCare — schema inicial MVP
-- Rode no SQL Editor de um projeto Supabase novo.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Minha família',
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'caregiver' check (role in ('owner','caregiver','viewer')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create or replace function public.is_household_member(target_household_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.household_members hm where hm.household_id=target_household_id and hm.user_id=auth.uid());
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.households h where h.id=target_household_id and h.owner_id=auth.uid());
$$;

create or replace function public.can_edit_household(target_household_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.household_members hm
    where hm.household_id=target_household_id
      and hm.user_id=auth.uid()
      and hm.role in ('owner','caregiver')
  );
$$;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.can_edit_household(uuid) to authenticated;

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  sex text not null default 'unknown' check (sex in ('male','female','unknown')),
  birth_date date,
  birth_date_estimated boolean not null default false,
  species text not null default 'cat',
  breed text,
  color text,
  photo_path text,
  current_weight_grams integer check (current_weight_grams is null or current_weight_grams > 0),
  neutered boolean not null default false,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weight_records (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade, weight_grams integer not null check(weight_grams>0),
  measured_at timestamptz not null default now(), notes text, created_at timestamptz not null default now()
);

-- O histórico é a fonte de verdade: o peso atual do perfil acompanha a pesagem mais recente.
create or replace function public.sync_pet_current_weight() returns trigger
language plpgsql security definer set search_path=public as $$
declare target_pet_id uuid;
begin
  target_pet_id := case when tg_op='DELETE' then old.pet_id else new.pet_id end;

  update public.pets
  set current_weight_grams=(
    select wr.weight_grams from public.weight_records wr
    where wr.pet_id=target_pet_id
    order by wr.measured_at desc, wr.created_at desc
    limit 1
  ), updated_at=now()
  where id=target_pet_id;

  if tg_op='UPDATE' and old.pet_id is distinct from new.pet_id then
    update public.pets
    set current_weight_grams=(
      select wr.weight_grams from public.weight_records wr
      where wr.pet_id=old.pet_id
      order by wr.measured_at desc, wr.created_at desc
      limit 1
    ), updated_at=now()
    where id=old.pet_id;
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists sync_pet_weight_after_change on public.weight_records;
create trigger sync_pet_weight_after_change
after insert or update or delete on public.weight_records
for each row execute procedure public.sync_pet_current_weight();

create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  type text not null check(type in ('vaccine','consultation','exam','medication','disease','allergy','surgery','other')),
  title text not null, occurred_at timestamptz not null default now(), clinic_or_vet text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.vaccine_doses (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade, health_record_id uuid references public.health_records(id) on delete set null,
  vaccine_name text not null, dose_label text, administered_at timestamptz not null, lot_number text, clinic_or_vet text,
  next_due_at timestamptz, notes text, created_at timestamptz not null default now()
);

create table if not exists public.neonatal_records (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  type text not null check(type in ('feeding','weight','urine','stool','temperature','observation')),
  occurred_at timestamptz not null default now(), amount_ml numeric(7,2), weight_grams integer, temperature_c numeric(4,1),
  quality text, notes text, created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null, health_record_id uuid references public.health_records(id) on delete set null,
  category text not null check(category in ('veterinary','food','medication','hygiene','accessory','transport','other')),
  description text not null, amount_cents integer not null check(amount_cents>=0), occurred_at timestamptz not null default now(),
  shared boolean not null default false, receipt_path text, notes text, created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade, health_record_id uuid references public.health_records(id) on delete set null,
  title text not null, category text not null default 'other', due_at timestamptz not null,
  recurrence_rule text, status text not null default 'pending' check(status in ('pending','done','snoozed','cancelled')),
  completed_at timestamptz, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade, health_record_id uuid references public.health_records(id) on delete set null,
  category text not null default 'other', title text not null, storage_path text not null, mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade,
  type text not null check(type in ('diary','milestone','photo')),
  title text not null, body text, occurred_at timestamptz not null default now(), media_path text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create unique index if not exists households_one_owned_per_user on public.households(owner_id);
create index if not exists pets_household_active_idx on public.pets(household_id, archived_at);
create index if not exists weight_records_pet_measured_idx on public.weight_records(pet_id, measured_at desc);
create index if not exists health_records_pet_occurred_idx on public.health_records(pet_id, occurred_at desc);
create index if not exists neonatal_records_pet_occurred_idx on public.neonatal_records(pet_id, occurred_at desc);
create index if not exists reminders_household_due_idx on public.reminders(household_id, status, due_at);

-- Perfil automático ao criar usuário
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1))) on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Ao criar família, o dono vira membro automaticamente
create or replace function public.handle_new_household() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.household_members(household_id,user_id,role) values(new.id,new.owner_id,'owner') on conflict do nothing; return new; end; $$;
drop trigger if exists on_household_created on public.households;
create trigger on_household_created after insert on public.households for each row execute procedure public.handle_new_household();

-- RLS
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.pets enable row level security;
alter table public.weight_records enable row level security;
alter table public.health_records enable row level security;
alter table public.vaccine_doses enable row level security;
alter table public.neonatal_records enable row level security;
alter table public.expenses enable row level security;
alter table public.reminders enable row level security;
alter table public.documents enable row level security;
alter table public.memories enable row level security;

drop policy if exists "profiles own select" on public.profiles;
create policy "profiles own select" on public.profiles for select using(id=auth.uid());
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists "households member select" on public.households;
create policy "households member select" on public.households for select using(public.is_household_member(id));
drop policy if exists "households owner insert" on public.households;
create policy "households owner insert" on public.households for insert with check(owner_id=auth.uid());
drop policy if exists "households owner update" on public.households;
create policy "households owner update" on public.households for update using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "households owner delete" on public.households;
create policy "households owner delete" on public.households for delete using(owner_id=auth.uid());
drop policy if exists "members member select" on public.household_members;
create policy "members member select" on public.household_members for select using(public.is_household_member(household_id));
drop policy if exists "members owner insert" on public.household_members;
create policy "members owner insert" on public.household_members for insert with check(public.is_household_owner(household_id));
drop policy if exists "members owner update" on public.household_members;
create policy "members owner update" on public.household_members for update using(public.is_household_owner(household_id)) with check(public.is_household_owner(household_id));
drop policy if exists "members owner delete" on public.household_members;
create policy "members owner delete" on public.household_members for delete using(public.is_household_owner(household_id));

-- Leitores visualizam; apenas donos e cuidadores alteram dados.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pets','weight_records','health_records','vaccine_doses','neonatal_records','expenses','reminders','documents','memories'] LOOP
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

-- Bucket privado para fotos/documentos. Caminho recomendado: <household_id>/<pet_id>/arquivo.ext
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pet-media','pet-media',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "pet media read" on storage.objects;
create policy "pet media read" on storage.objects for select to authenticated using(bucket_id='pet-media' and public.is_household_member((storage.foldername(name))[1]::uuid));
drop policy if exists "pet media insert" on storage.objects;
create policy "pet media insert" on storage.objects for insert to authenticated with check(bucket_id='pet-media' and public.can_edit_household((storage.foldername(name))[1]::uuid));
drop policy if exists "pet media update" on storage.objects;
create policy "pet media update" on storage.objects for update to authenticated using(bucket_id='pet-media' and public.can_edit_household((storage.foldername(name))[1]::uuid));
drop policy if exists "pet media delete" on storage.objects;
create policy "pet media delete" on storage.objects for delete to authenticated using(bucket_id='pet-media' and public.can_edit_household((storage.foldername(name))[1]::uuid));
