-- Attachments infrastructure + pet documents linking.
-- documents.storage_path / mime_type remain for legacy rows but are deprecated for new writes.
-- memory_media and pets.photo_path are intentionally untouched.

-- ---------------------------------------------------------------------------
-- documents: allow metadata-only rows (files live in attachments)
-- ---------------------------------------------------------------------------

alter table public.documents
  alter column storage_path drop not null;

comment on column public.documents.storage_path is
  'LEGACY/DEPRECATED. New documents store files via document_attachments → attachments. Nullable for V1+.';

comment on column public.documents.mime_type is
  'LEGACY/DEPRECATED. Prefer attachments.mime_type for new documents.';

comment on column public.documents.health_record_id is
  'Not used for health attachments. Health will get its own link table later. Do not build health uploads on this column.';

create index if not exists documents_household_idx on public.documents (household_id);
create index if not exists documents_pet_idx on public.documents (pet_id);
create index if not exists documents_category_idx on public.documents (household_id, category);

-- Needed for composite FKs that pin the same household across document ↔ attachment links.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documents_id_household_key'
  ) then
    alter table public.documents
      add constraint documents_id_household_key unique (id, household_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- attachments: one physical file in Storage
-- ---------------------------------------------------------------------------

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint attachments_storage_path_unique unique (storage_path),
  constraint attachments_byte_size_positive check (byte_size > 0),
  constraint attachments_original_filename_nonempty
    check (char_length(btrim(original_filename)) > 0),
  constraint attachments_mime_type_allowed
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  constraint attachments_id_household_key unique (id, household_id)
);

create index if not exists attachments_household_idx
  on public.attachments (household_id);

comment on table public.attachments is
  'Generic physical files in pet-media Storage. Domain ownership comes from link tables (e.g. document_attachments).';

-- ---------------------------------------------------------------------------
-- document_attachments: explicit link (same household enforced by composite FKs)
-- ---------------------------------------------------------------------------

create table if not exists public.document_attachments (
  document_id uuid not null,
  attachment_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (document_id, attachment_id),
  constraint document_attachments_attachment_unique unique (attachment_id),
  constraint document_attachments_position_unique unique (document_id, position),
  constraint document_attachments_position_nonneg check (position >= 0),
  constraint document_attachments_document_household_fkey
    foreign key (document_id, household_id)
    references public.documents (id, household_id)
    on delete cascade,
  constraint document_attachments_attachment_household_fkey
    foreign key (attachment_id, household_id)
    references public.attachments (id, household_id)
    on delete cascade
);

create index if not exists document_attachments_document_idx
  on public.document_attachments (document_id, position);

create index if not exists document_attachments_household_idx
  on public.document_attachments (household_id);

comment on table public.document_attachments is
  'Links logical pet documents to physical attachments. Composite FKs keep both sides in the same household.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.attachments enable row level security;
alter table public.document_attachments enable row level security;

drop policy if exists attachments_member_select on public.attachments;
create policy attachments_member_select on public.attachments
  for select using (public.is_household_member(household_id));

drop policy if exists attachments_member_insert on public.attachments;
create policy attachments_member_insert on public.attachments
  for insert with check (public.can_edit_household(household_id));

drop policy if exists attachments_member_update on public.attachments;
create policy attachments_member_update on public.attachments
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists attachments_member_delete on public.attachments;
create policy attachments_member_delete on public.attachments
  for delete using (public.can_edit_household(household_id));

drop policy if exists document_attachments_member_select on public.document_attachments;
create policy document_attachments_member_select on public.document_attachments
  for select using (public.is_household_member(household_id));

drop policy if exists document_attachments_member_insert on public.document_attachments;
create policy document_attachments_member_insert on public.document_attachments
  for insert with check (public.can_edit_household(household_id));

drop policy if exists document_attachments_member_update on public.document_attachments;
create policy document_attachments_member_update on public.document_attachments
  for update using (public.can_edit_household(household_id))
  with check (public.can_edit_household(household_id));

drop policy if exists document_attachments_member_delete on public.document_attachments;
create policy document_attachments_member_delete on public.document_attachments
  for delete using (public.can_edit_household(household_id));

-- ---------------------------------------------------------------------------
-- RPCs: transactional metadata (Storage upload/delete stays in the app)
-- ---------------------------------------------------------------------------

create or replace function public.create_pet_document(
  p_document_id uuid,
  p_pet_id uuid,
  p_title text,
  p_category text,
  p_attachments jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  hid uuid;
  title_clean text := btrim(coalesce(p_title, ''));
  category_clean text := btrim(coalesce(p_category, ''));
  item jsonb;
  pos integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select p.household_id into hid
  from public.pets p
  where p.id = p_pet_id and p.archived_at is null;

  if hid is null then
    raise exception 'pet not found';
  end if;

  if not public.can_edit_household(hid) then
    raise exception 'forbidden';
  end if;

  if title_clean = '' or char_length(title_clean) > 160 then
    raise exception 'invalid title';
  end if;

  if category_clean = '' or char_length(category_clean) > 80 then
    raise exception 'invalid category';
  end if;

  if p_attachments is null or jsonb_typeof(p_attachments) <> 'array' or jsonb_array_length(p_attachments) < 1 then
    raise exception 'attachments required';
  end if;

  if jsonb_array_length(p_attachments) > 8 then
    raise exception 'too many attachments';
  end if;

  insert into public.documents (id, household_id, pet_id, category, title, storage_path, mime_type)
  values (p_document_id, hid, p_pet_id, category_clean, title_clean, null, null);

  for item in select * from jsonb_array_elements(p_attachments)
  loop
    pos := coalesce((item->>'position')::integer, 0);
    insert into public.attachments (
      id, household_id, storage_path, original_filename, mime_type, byte_size, created_by
    ) values (
      (item->>'id')::uuid,
      hid,
      item->>'storage_path',
      btrim(item->>'original_filename'),
      item->>'mime_type',
      (item->>'byte_size')::bigint,
      auth.uid()
    );

    insert into public.document_attachments (document_id, attachment_id, household_id, position)
    values (p_document_id, (item->>'id')::uuid, hid, pos);
  end loop;

  return p_document_id;
end;
$$;

create or replace function public.update_pet_document_meta(
  p_document_id uuid,
  p_title text,
  p_category text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  hid uuid;
  title_clean text := btrim(coalesce(p_title, ''));
  category_clean text := btrim(coalesce(p_category, ''));
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select d.household_id into hid
  from public.documents d
  where d.id = p_document_id;

  if hid is null then
    raise exception 'document not found';
  end if;

  if not public.can_edit_household(hid) then
    raise exception 'forbidden';
  end if;

  if title_clean = '' or char_length(title_clean) > 160 then
    raise exception 'invalid title';
  end if;

  if category_clean = '' or char_length(category_clean) > 80 then
    raise exception 'invalid category';
  end if;

  update public.documents
  set title = title_clean, category = category_clean
  where id = p_document_id and household_id = hid;
end;
$$;

create or replace function public.add_document_attachments(
  p_document_id uuid,
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
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select d.household_id into hid
  from public.documents d
  where d.id = p_document_id;

  if hid is null then
    raise exception 'document not found';
  end if;

  if not public.can_edit_household(hid) then
    raise exception 'forbidden';
  end if;

  if p_attachments is null or jsonb_typeof(p_attachments) <> 'array' or jsonb_array_length(p_attachments) < 1 then
    raise exception 'attachments required';
  end if;

  select count(*)::integer, coalesce(max(position), -1)
  into current_count, max_pos
  from public.document_attachments
  where document_id = p_document_id;

  if current_count + jsonb_array_length(p_attachments) > 8 then
    raise exception 'too many attachments';
  end if;

  for item in select * from jsonb_array_elements(p_attachments)
  loop
    max_pos := max_pos + 1;
    pos := coalesce((item->>'position')::integer, max_pos);

    insert into public.attachments (
      id, household_id, storage_path, original_filename, mime_type, byte_size, created_by
    ) values (
      (item->>'id')::uuid,
      hid,
      item->>'storage_path',
      btrim(item->>'original_filename'),
      item->>'mime_type',
      (item->>'byte_size')::bigint,
      auth.uid()
    );

    insert into public.document_attachments (document_id, attachment_id, household_id, position)
    values (p_document_id, (item->>'id')::uuid, hid, pos);
  end loop;
end;
$$;

create or replace function public.delete_document_attachment(
  p_attachment_id uuid
) returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  hid uuid;
  path text;
  doc_id uuid;
  remaining integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select a.household_id, a.storage_path, da.document_id
  into hid, path, doc_id
  from public.attachments a
  join public.document_attachments da on da.attachment_id = a.id
  where a.id = p_attachment_id;

  if hid is null then
    raise exception 'attachment not found';
  end if;

  if not public.can_edit_household(hid) then
    raise exception 'forbidden';
  end if;

  select count(*)::integer into remaining
  from public.document_attachments
  where document_id = doc_id;

  if remaining <= 1 then
    raise exception 'document requires at least one attachment';
  end if;

  delete from public.attachments where id = p_attachment_id and household_id = hid;
  return path;
end;
$$;

create or replace function public.delete_pet_document(
  p_document_id uuid
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

  select d.household_id into hid
  from public.documents d
  where d.id = p_document_id;

  if hid is null then
    raise exception 'document not found';
  end if;

  if not public.can_edit_household(hid) then
    raise exception 'forbidden';
  end if;

  select coalesce(array_agg(a.storage_path), '{}')
  into paths
  from public.document_attachments da
  join public.attachments a on a.id = da.attachment_id
  where da.document_id = p_document_id;

  delete from public.attachments a
  using public.document_attachments da
  where da.document_id = p_document_id
    and da.attachment_id = a.id
    and a.household_id = hid;

  delete from public.documents
  where id = p_document_id and household_id = hid;

  return paths;
end;
$$;

grant execute on function public.create_pet_document(uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.update_pet_document_meta(uuid, text, text) to authenticated;
grant execute on function public.add_document_attachments(uuid, jsonb) to authenticated;
grant execute on function public.delete_document_attachment(uuid) to authenticated;
grant execute on function public.delete_pet_document(uuid) to authenticated;
