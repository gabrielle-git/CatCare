-- Feeding create idempotency: client-stable session_id → create-or-reuse + replace-all items.
-- Preserves legacy create_feeding_session(pet, ...) overload (server-generated id).
-- Extends create_feeding_sessions_batch payload entries with optional session_id (non-breaking).

-- ---------------------------------------------------------------------------
-- Idempotent single-pet create (overload: session_id first)
-- ---------------------------------------------------------------------------

create or replace function public.create_feeding_session(
  p_session_id uuid,
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
  notes_norm text := nullif(btrim(coalesce(p_notes, '')), '');
  quality_norm text := nullif(btrim(coalesce(p_quality, '')), '');
  existing_pet uuid;
begin
  if p_session_id is null then
    raise exception 'Identificador da refeição inválido.' using errcode = '22023';
  end if;

  -- Authorize the requested pet first (same helper as 0032).
  perform public._feeding_assert_can_edit_pet(p_pet_id);

  if p_occurred_at is null then
    raise exception 'Informe data e hora.' using errcode = '22023';
  end if;

  -- Race-safe create: concurrent same p_session_id → one row; losers re-read.
  -- Do NOT treat conflict as "this attempt created the row".
  insert into public.feeding_sessions (id, pet_id, occurred_at, notes, quality)
  values (p_session_id, p_pet_id, p_occurred_at, notes_norm, quality_norm)
  on conflict (id) do nothing;

  -- Lock the session row before ownership check + replace-all items.
  -- Without FOR UPDATE, concurrent callers can interleave DELETE/INSERT and
  -- leave a mixed item set from two payloads.
  select s.pet_id into existing_pet
  from public.feeding_sessions s
  where s.id = p_session_id
  for update;

  if existing_pet is null then
    -- Should not happen after insert/conflict; fail closed without leaking.
    raise exception 'Não foi possível salvar esta refeição.' using errcode = 'P0002';
  end if;

  -- Same session_id bound to another pet (or unreachable context) → generic reject.
  -- Must happen BEFORE any DELETE/UPDATE of items (foreign rows untouched).
  if existing_pet is distinct from p_pet_id then
    raise exception 'Não foi possível salvar esta refeição.' using errcode = '42501';
  end if;

  -- Same intention: apply latest mutable session fields + replace-all items.
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

revoke all on function public.create_feeding_session(uuid, uuid, timestamptz, text, text, jsonb) from public;
grant execute on function public.create_feeding_session(uuid, uuid, timestamptz, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Batch: optional session_id per payload entry (legacy entries keep 5-arg create)
-- p_payload: [{ "pet_id", "notes", "items", "session_id"? }, ...]
-- ---------------------------------------------------------------------------

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
  session_raw text;
  session_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'array' or jsonb_array_length(p_payload) < 1 then
    raise exception 'Selecione ao menos um pet.' using errcode = '22023';
  end if;
  if p_occurred_at is null then
    raise exception 'Informe data e hora.' using errcode = '22023';
  end if;

  for entry in select * from jsonb_array_elements(p_payload)
  loop
    session_raw := nullif(btrim(coalesce(entry->>'session_id', '')), '');
    if session_raw is not null then
      begin
        session_id := session_raw::uuid;
      exception
        when invalid_text_representation then
          raise exception 'Identificador da refeição inválido.' using errcode = '22023';
      end;
      sid := public.create_feeding_session(
        session_id,
        (entry->>'pet_id')::uuid,
        p_occurred_at,
        entry->>'notes',
        quality_norm,
        entry->'items'
      );
    else
      -- Legacy path: server-generated session id (5-arg overload from 0032).
      sid := public.create_feeding_session(
        (entry->>'pet_id')::uuid,
        p_occurred_at,
        entry->>'notes',
        quality_norm,
        entry->'items'
      );
    end if;
    ids := array_append(ids, sid);
  end loop;

  return ids;
end;
$$;

revoke all on function public.create_feeding_sessions_batch(timestamptz, text, jsonb) from public;
grant execute on function public.create_feeding_sessions_batch(timestamptz, text, jsonb) to authenticated;

comment on function public.create_feeding_session(uuid, uuid, timestamptz, text, text, jsonb) is
  'Idempotent feeding create: stable session_id create-or-reuse with replace-all items.';

comment on function public.create_feeding_sessions_batch(timestamptz, text, jsonb) is
  'Multi-pet feeding create. Optional payload session_id enables idempotent create; omit for legacy server UUID.';
