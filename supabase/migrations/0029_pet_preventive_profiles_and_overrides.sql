-- Pet preventive profile + sparse item overrides.
-- Templates remain in TypeScript (preventive_protocol_id is a stable catalog id, no FK).
-- Absence of an override row = inherit/default from the resolved protocol.
-- Does NOT activate recurrence, motor, or UI.

-- ---------------------------------------------------------------------------
-- pets: light profile fields
-- ---------------------------------------------------------------------------

alter table public.pets
  add column if not exists preventive_protocol_id text null,
  add column if not exists preventive_core_vaccine_key text null;

-- NULL = inherit; non-null must be a non-empty catalog / core key.
alter table public.pets
  drop constraint if exists pets_preventive_protocol_id_nonempty;
alter table public.pets
  add constraint pets_preventive_protocol_id_nonempty
  check (preventive_protocol_id is null or char_length(btrim(preventive_protocol_id)) > 0);

alter table public.pets
  drop constraint if exists pets_preventive_core_vaccine_key_nonempty;
alter table public.pets
  add constraint pets_preventive_core_vaccine_key_nonempty
  check (preventive_core_vaccine_key is null or char_length(btrim(preventive_core_vaccine_key)) > 0);

comment on column public.pets.preventive_protocol_id is
  'Optional TypeScript preventive protocol catalog id. NULL inherits by species.';
comment on column public.pets.preventive_core_vaccine_key is
  'Optional core vaccine key override for the pet protocol. NULL uses template default.';

-- ---------------------------------------------------------------------------
-- pet_preventive_item_overrides: exceptions only (no denormalized household_id)
-- Authorization derives: pet_id → pets.household_id → is_household_member / can_edit_household
-- ---------------------------------------------------------------------------

create table if not exists public.pet_preventive_item_overrides (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  item_key text not null,
  status text not null,
  deferred_until date null,
  reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_preventive_item_overrides_pet_item_uidx unique (pet_id, item_key),
  constraint pet_preventive_item_overrides_item_key_nonempty
    check (char_length(btrim(item_key)) > 0),
  constraint pet_preventive_item_overrides_status_check
    check (status in ('not_applicable', 'deferred')),
  constraint pet_preventive_item_overrides_status_dates_check
    check (
      (status = 'not_applicable' and deferred_until is null)
      or (status = 'deferred' and deferred_until is not null)
    )
);

comment on table public.pet_preventive_item_overrides is
  'Sparse preventive exceptions per pet. No row means inherit from protocol template.';

alter table public.pet_preventive_item_overrides enable row level security;

-- UNIQUE (pet_id, item_key) already provides a btree usable for pet_id lookups.
-- No additional pet_id-only index.

drop policy if exists pet_preventive_item_overrides_member_select on public.pet_preventive_item_overrides;
create policy pet_preventive_item_overrides_member_select
  on public.pet_preventive_item_overrides
  for select
  using (
    exists (
      select 1
      from public.pets p
      where p.id = pet_id
        and public.is_household_member(p.household_id)
    )
  );

drop policy if exists pet_preventive_item_overrides_member_insert on public.pet_preventive_item_overrides;
create policy pet_preventive_item_overrides_member_insert
  on public.pet_preventive_item_overrides
  for insert
  with check (
    exists (
      select 1
      from public.pets p
      where p.id = pet_id
        and public.can_edit_household(p.household_id)
    )
  );

drop policy if exists pet_preventive_item_overrides_member_update on public.pet_preventive_item_overrides;
create policy pet_preventive_item_overrides_member_update
  on public.pet_preventive_item_overrides
  for update
  using (
    exists (
      select 1
      from public.pets p
      where p.id = pet_id
        and public.can_edit_household(p.household_id)
    )
  )
  with check (
    exists (
      select 1
      from public.pets p
      where p.id = pet_id
        and public.can_edit_household(p.household_id)
    )
  );

drop policy if exists pet_preventive_item_overrides_member_delete on public.pet_preventive_item_overrides;
create policy pet_preventive_item_overrides_member_delete
  on public.pet_preventive_item_overrides
  for delete
  using (
    exists (
      select 1
      from public.pets p
      where p.id = pet_id
        and public.can_edit_household(p.household_id)
    )
  );
