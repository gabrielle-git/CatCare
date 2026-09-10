-- Attachments: friendly display_name separate from original_filename.
-- No Storage rename. No backfill. Legacy rows keep display_name NULL (UI falls back to basename).

alter table public.attachments
  add column if not exists display_name text null;

alter table public.attachments
  drop constraint if exists attachments_display_name_nonempty;

alter table public.attachments
  add constraint attachments_display_name_nonempty
  check (
    display_name is null
    or (
      char_length(btrim(display_name)) > 0
      and char_length(btrim(display_name)) <= 160
    )
  );

comment on column public.attachments.display_name is
  'Friendly label shown in CatCare UI. original_filename remains the uploaded name for download/audit.';

comment on column public.attachments.original_filename is
  'Exact original upload filename. Used for Content-Disposition download and audit. Not replaced by display_name.';

-- Recreate create/add RPCs to accept optional display_name in jsonb payload.

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
  display_clean text;
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
    display_clean := nullif(btrim(coalesce(item->>'display_name', '')), '');

    insert into public.attachments (
      id, household_id, storage_path, original_filename, display_name, mime_type, byte_size, created_by
    ) values (
      (item->>'id')::uuid,
      hid,
      item->>'storage_path',
      btrim(item->>'original_filename'),
      display_clean,
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
  display_clean text;
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
    display_clean := nullif(btrim(coalesce(item->>'display_name', '')), '');

    insert into public.attachments (
      id, household_id, storage_path, original_filename, display_name, mime_type, byte_size, created_by
    ) values (
      (item->>'id')::uuid,
      hid,
      item->>'storage_path',
      btrim(item->>'original_filename'),
      display_clean,
      item->>'mime_type',
      (item->>'byte_size')::bigint,
      auth.uid()
    );

    insert into public.document_attachments (document_id, attachment_id, household_id, position)
    values (p_document_id, (item->>'id')::uuid, hid, pos);
  end loop;
end;
$$;

create or replace function public.update_attachment_display_name(
  p_attachment_id uuid,
  p_display_name text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  hid uuid;
  display_clean text := nullif(btrim(coalesce(p_display_name, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select a.household_id into hid
  from public.attachments a
  where a.id = p_attachment_id;

  if hid is null then
    raise exception 'attachment not found';
  end if;

  if not public.can_edit_household(hid) then
    raise exception 'forbidden';
  end if;

  if display_clean is not null and char_length(display_clean) > 160 then
    raise exception 'invalid display_name';
  end if;

  update public.attachments
  set display_name = display_clean
  where id = p_attachment_id and household_id = hid;
end;
$$;

grant execute on function public.update_attachment_display_name(uuid, text) to authenticated;
