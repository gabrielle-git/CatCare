-- Health record attachments: explicit link table + same-household composite FKs.
-- Reuses public.attachments (display_name, pet-media paths). Does not use documents.health_record_id.
-- Zero attachments allowed on a health_record; last attachment may be removed.

-- Needed for composite FKs that pin the same household across health_record ↔ attachment links.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'health_records_id_household_key'
  ) then
    alter table public.health_records
      add constraint health_records_id_household_key unique (id, household_id);
  end if;
end $$;

create table if not exists public.health_record_attachments (
  health_record_id uuid not null,
  attachment_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (health_record_id, attachment_id),
  constraint health_record_attachments_attachment_unique unique (attachment_id),
  constraint health_record_attachments_position_unique unique (health_record_id, position),
  constraint health_record_attachments_position_nonneg check (position >= 0),
  constraint health_record_attachments_health_record_household_fkey
    foreign key (health_record_id, household_id)
    references public.health_records (id, household_id)
    on delete cascade,
  constraint health_record_attachments_attachment_household_fkey
    foreign key (attachment_id, household_id)
    references public.attachments (id, household_id)
    on delete cascade
);

create index if not exists health_record_attachments_health_record_idx
  on public.health_record_attachments (health_record_id, position);

create index if not exists health_record_attachments_household_idx
  on public.health_record_attachments (household_id);

comment on table public.health_record_attachments is
  'Links factual health_records to physical attachments. Composite FKs keep both sides in the same household. Optional (zero files allowed).';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.health_record_attachments enable row level security;

drop policy if exists health_record_attachments_member_select on public.health_record_attachments;
create policy health_record_attachments_member_select on public.health_record_attachments
  for select using (public.is_household_member(household_id));

drop policy if exists health_record_attachments_member_insert on public.health_record_attachments;
create policy health_record_attachments_member_insert on public.health_record_attachments
  for insert with check (public.can_edit_household(household_id));

drop policy if exists health_record_attachments_member_update on public.health_record_attachments;
create policy health_record_attachments_member_update on public.health_record_attachments
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists health_record_attachments_member_delete on public.health_record_attachments;
create policy health_record_attachments_member_delete on public.health_record_attachments
  for delete using (public.can_edit_household(household_id));

-- ---------------------------------------------------------------------------
-- RPCs: transactional metadata (Storage upload/delete stays in the app)
-- ---------------------------------------------------------------------------

create or replace function public.add_health_record_attachments(
  p_health_record_id uuid,
  p_attachments jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  hid uuid;
  item jsonb;
  pos integer;
  current_count integer;
  max_pos integer;
  display_clean text;
  att_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select hr.household_id into hid
  from public.health_records hr
  where hr.id = p_health_record_id;

  if hid is null then
    raise exception 'health record not found';
  end if;

  if not public.can_edit_household(hid) then
    raise exception 'forbidden';
  end if;

  if p_attachments is null or jsonb_typeof(p_attachments) <> 'array' or jsonb_array_length(p_attachments) < 1 then
    raise exception 'attachments required';
  end if;

  select count(*)::integer, coalesce(max(position), -1)
  into current_count, max_pos
  from public.health_record_attachments
  where health_record_id = p_health_record_id;

  for item in select * from jsonb_array_elements(p_attachments)
  loop
    att_id := (item->>'id')::uuid;

    -- Idempotent retry: attachment already linked to this health_record.
    if exists (
      select 1
      from public.health_record_attachments hra
      where hra.health_record_id = p_health_record_id
        and hra.attachment_id = att_id
    ) then
      continue;
    end if;

    -- Already linked elsewhere (or orphan attachment row) → reject duplicates.
    if exists (select 1 from public.attachments a where a.id = att_id) then
      raise exception 'attachment already exists';
    end if;

    if current_count >= 8 then
      raise exception 'too many attachments';
    end if;

    max_pos := max_pos + 1;
    pos := coalesce((item->>'position')::integer, max_pos);
    display_clean := nullif(btrim(coalesce(item->>'display_name', '')), '');

    insert into public.attachments (
      id, household_id, storage_path, original_filename, display_name, mime_type, byte_size, created_by
    ) values (
      att_id,
      hid,
      item->>'storage_path',
      btrim(item->>'original_filename'),
      display_clean,
      item->>'mime_type',
      (item->>'byte_size')::bigint,
      auth.uid()
    );

    insert into public.health_record_attachments (health_record_id, attachment_id, household_id, position)
    values (p_health_record_id, att_id, hid, pos);

    current_count := current_count + 1;
  end loop;
end;
$$;

create or replace function public.delete_health_record_attachment(
  p_attachment_id uuid
) returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  hid uuid;
  path text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select a.household_id, a.storage_path
  into hid, path
  from public.attachments a
  join public.health_record_attachments hra on hra.attachment_id = a.id
  where a.id = p_attachment_id;

  if hid is null then
    raise exception 'attachment not found';
  end if;

  if not public.can_edit_household(hid) then
    raise exception 'forbidden';
  end if;

  -- Last attachment may be removed; health_record with zero files is valid.
  delete from public.attachments where id = p_attachment_id and household_id = hid;
  return path;
end;
$$;

create or replace function public.purge_health_record_attachments(
  p_health_record_id uuid
) returns text[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  hid uuid;
  paths text[];
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select hr.household_id into hid
  from public.health_records hr
  where hr.id = p_health_record_id;

  if hid is null then
    raise exception 'health record not found';
  end if;

  if not public.can_edit_household(hid) then
    raise exception 'forbidden';
  end if;

  select coalesce(array_agg(a.storage_path), '{}')
  into paths
  from public.health_record_attachments hra
  join public.attachments a on a.id = hra.attachment_id
  where hra.health_record_id = p_health_record_id;

  delete from public.attachments a
  using public.health_record_attachments hra
  where hra.health_record_id = p_health_record_id
    and hra.attachment_id = a.id
    and a.household_id = hid;

  return paths;
end;
$$;

grant execute on function public.add_health_record_attachments(uuid, jsonb) to authenticated;
grant execute on function public.delete_health_record_attachment(uuid) to authenticated;
grant execute on function public.purge_health_record_attachments(uuid) to authenticated;
