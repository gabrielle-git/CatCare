-- Canonical feeding: sessions (1 meal / pet) + items (1..N components).
-- No household_id on sessions — RLS derives household via pets.
-- No backfill / reclassification of neonatal_records feeding.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.feeding_sessions (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  occurred_at timestamptz not null,
  notes text null,
  quality text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feeding_sessions_notes_nonempty
    check (notes is null or char_length(btrim(notes)) > 0),
  constraint feeding_sessions_quality_nonempty
    check (quality is null or char_length(btrim(quality)) > 0)
);

create table if not exists public.feeding_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.feeding_sessions(id) on delete cascade,
  subtype text not null,
  custom_label text null,
  amount_value numeric(7, 2) null,
  amount_unit text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feeding_items_subtype_nonempty
    check (char_length(btrim(subtype)) > 0),
  constraint feeding_items_custom_label_nonempty
    check (custom_label is null or char_length(btrim(custom_label)) > 0),
  constraint feeding_items_other_custom_label
    check (
      (btrim(subtype) = 'other' and custom_label is not null)
      or (btrim(subtype) <> 'other' and custom_label is null)
    ),
  constraint feeding_items_amount_pair
    check (
      (amount_value is null and amount_unit is null)
      or (
        amount_value is not null
        and amount_value > 0
        and amount_unit is not null
        and char_length(btrim(amount_unit)) > 0
      )
    )
);

create index if not exists feeding_sessions_pet_occurred_idx
  on public.feeding_sessions (pet_id, occurred_at desc);

create index if not exists feeding_items_session_idx
  on public.feeding_items (session_id);

comment on table public.feeding_sessions is
  'One factual meal per pet. New feedings (adult + neonatal) write here; neonatal_records feeding remains legacy.';

comment on table public.feeding_items is
  'Components of a feeding session. subtype is open text; presets live in the app.';

-- ---------------------------------------------------------------------------
-- RLS (household via pets)
-- ---------------------------------------------------------------------------

alter table public.feeding_sessions enable row level security;
alter table public.feeding_items enable row level security;

drop policy if exists feeding_sessions_member_select on public.feeding_sessions;
create policy feeding_sessions_member_select on public.feeding_sessions
  for select using (
    exists (
      select 1 from public.pets p
      where p.id = pet_id and public.is_household_member(p.household_id)
    )
  );

drop policy if exists feeding_sessions_member_insert on public.feeding_sessions;
create policy feeding_sessions_member_insert on public.feeding_sessions
  for insert with check (
    exists (
      select 1 from public.pets p
      where p.id = pet_id and public.can_edit_household(p.household_id)
    )
  );

drop policy if exists feeding_sessions_member_update on public.feeding_sessions;
create policy feeding_sessions_member_update on public.feeding_sessions
  for update using (
    exists (
      select 1 from public.pets p
      where p.id = pet_id and public.can_edit_household(p.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.pets p
      where p.id = pet_id and public.can_edit_household(p.household_id)
    )
  );

drop policy if exists feeding_sessions_member_delete on public.feeding_sessions;
create policy feeding_sessions_member_delete on public.feeding_sessions
  for delete using (
    exists (
      select 1 from public.pets p
      where p.id = pet_id and public.can_edit_household(p.household_id)
    )
  );

drop policy if exists feeding_items_member_select on public.feeding_items;
create policy feeding_items_member_select on public.feeding_items
  for select using (
    exists (
      select 1
      from public.feeding_sessions s
      join public.pets p on p.id = s.pet_id
      where s.id = session_id and public.is_household_member(p.household_id)
    )
  );

drop policy if exists feeding_items_member_insert on public.feeding_items;
create policy feeding_items_member_insert on public.feeding_items
  for insert with check (
    exists (
      select 1
      from public.feeding_sessions s
      join public.pets p on p.id = s.pet_id
      where s.id = session_id and public.can_edit_household(p.household_id)
    )
  );

drop policy if exists feeding_items_member_update on public.feeding_items;
create policy feeding_items_member_update on public.feeding_items
  for update using (
    exists (
      select 1
      from public.feeding_sessions s
      join public.pets p on p.id = s.pet_id
      where s.id = session_id and public.can_edit_household(p.household_id)
    )
  )
  with check (
    exists (
      select 1
      from public.feeding_sessions s
      join public.pets p on p.id = s.pet_id
      where s.id = session_id and public.can_edit_household(p.household_id)
    )
  );

drop policy if exists feeding_items_member_delete on public.feeding_items;
create policy feeding_items_member_delete on public.feeding_items
  for delete using (
    exists (
      select 1
      from public.feeding_sessions s
      join public.pets p on p.id = s.pet_id
      where s.id = session_id and public.can_edit_household(p.household_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Atomic write helpers (security definer, search_path = public)
-- ---------------------------------------------------------------------------

create or replace function public._feeding_assert_can_edit_pet(target_pet_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;
  select p.household_id into hid
  from public.pets p
  where p.id = target_pet_id and p.archived_at is null;
  if hid is null then
    raise exception 'Pet não encontrado.' using errcode = 'P0002';
  end if;
  if not public.can_edit_household(hid) then
    raise exception 'Sem permissão para editar esta família.' using errcode = '42501';
  end if;
  return hid;
end;
$$;

revoke all on function public._feeding_assert_can_edit_pet(uuid) from public;
grant execute on function public._feeding_assert_can_edit_pet(uuid) to authenticated;

create or replace function public._feeding_insert_items(p_session_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  subtype text;
  custom_label text;
  amount_value numeric;
  amount_unit text;
  n int := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'Uma refeição precisa ter pelo menos um item.' using errcode = '22023';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    subtype := nullif(btrim(coalesce(item->>'subtype', '')), '');
    if subtype is null then
      raise exception 'Informe o tipo de alimento.' using errcode = '22023';
    end if;

    custom_label := nullif(btrim(coalesce(item->>'custom_label', '')), '');
    if subtype = 'other' then
      if custom_label is null then
        raise exception 'Informe qual alimento você registrou.' using errcode = '22023';
      end if;
    else
      custom_label := null;
    end if;

    if item ? 'amount_value' and item->>'amount_value' is not null and btrim(item->>'amount_value') <> '' then
      amount_value := (item->>'amount_value')::numeric;
    else
      amount_value := null;
    end if;
    amount_unit := nullif(btrim(coalesce(item->>'amount_unit', '')), '');

    if amount_value is null and amount_unit is null then
      null;
    elsif amount_value is not null and amount_value > 0 and amount_unit is not null then
      null;
    else
      raise exception 'Quantidade e unidade devem vir juntas.' using errcode = '22023';
    end if;

    insert into public.feeding_items (
      session_id, subtype, custom_label, amount_value, amount_unit
    ) values (
      p_session_id, subtype, custom_label, amount_value, amount_unit
    );
    n := n + 1;
  end loop;

  if n < 1 then
    raise exception 'Uma refeição precisa ter pelo menos um item.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public._feeding_insert_items(uuid, jsonb) from public;
grant execute on function public._feeding_insert_items(uuid, jsonb) to authenticated;

-- Single-pet atomic create. Returns session id.
create or replace function public.create_feeding_session(
  p_pet_id uuid,
  p_occurred_at timestamptz,
  p_notes text,
  p_quality text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  notes_norm text := nullif(btrim(coalesce(p_notes, '')), '');
  quality_norm text := nullif(btrim(coalesce(p_quality, '')), '');
begin
  perform public._feeding_assert_can_edit_pet(p_pet_id);
  if p_occurred_at is null then
    raise exception 'Informe data e hora.' using errcode = '22023';
  end if;

  insert into public.feeding_sessions (pet_id, occurred_at, notes, quality)
  values (p_pet_id, p_occurred_at, notes_norm, quality_norm)
  returning id into sid;

  perform public._feeding_insert_items(sid, p_items);
  return sid;
end;
$$;

revoke all on function public.create_feeding_session(uuid, timestamptz, text, text, jsonb) from public;
grant execute on function public.create_feeding_session(uuid, timestamptz, text, text, jsonb) to authenticated;

-- Multi-pet all-or-nothing.
-- p_payload: [{ "pet_id": "...", "notes": "...", "items": [ ... ] }, ...]
-- Shared quality + occurred_at for the submit.
create or replace function public.create_feeding_sessions_batch(
  p_occurred_at timestamptz,
  p_quality text,
  p_payload jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  entry jsonb;
  sid uuid;
  ids uuid[] := '{}';
  quality_norm text := nullif(btrim(coalesce(p_quality, '')), '');
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'array' or jsonb_array_length(p_payload) < 1 then
    raise exception 'Selecione ao menos um pet.' using errcode = '22023';
  end if;
  if p_occurred_at is null then
    raise exception 'Informe data e hora.' using errcode = '22023';
  end if;

  for entry in select * from jsonb_array_elements(p_payload)
  loop
    sid := public.create_feeding_session(
      (entry->>'pet_id')::uuid,
      p_occurred_at,
      entry->>'notes',
      quality_norm,
      entry->'items'
    );
    ids := array_append(ids, sid);
  end loop;

  return ids;
end;
$$;

revoke all on function public.create_feeding_sessions_batch(timestamptz, text, jsonb) from public;
grant execute on function public.create_feeding_sessions_batch(timestamptz, text, jsonb) to authenticated;

-- Atomic edit: update session fields + replace all items.
create or replace function public.replace_feeding_session(
  p_session_id uuid,
  p_occurred_at timestamptz,
  p_notes text,
  p_quality text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pet uuid;
  notes_norm text := nullif(btrim(coalesce(p_notes, '')), '');
  quality_norm text := nullif(btrim(coalesce(p_quality, '')), '');
begin
  select s.pet_id into target_pet
  from public.feeding_sessions s
  where s.id = p_session_id;
  if target_pet is null then
    raise exception 'Refeição não encontrada.' using errcode = 'P0002';
  end if;
  perform public._feeding_assert_can_edit_pet(target_pet);
  if p_occurred_at is null then
    raise exception 'Informe data e hora.' using errcode = '22023';
  end if;

  update public.feeding_sessions
  set
    occurred_at = p_occurred_at,
    notes = notes_norm,
    quality = quality_norm,
    updated_at = now()
  where id = p_session_id;

  delete from public.feeding_items where session_id = p_session_id;
  perform public._feeding_insert_items(p_session_id, p_items);
  return p_session_id;
end;
$$;

revoke all on function public.replace_feeding_session(uuid, timestamptz, text, text, jsonb) from public;
grant execute on function public.replace_feeding_session(uuid, timestamptz, text, text, jsonb) to authenticated;
