-- Hygiene care as health_records.type = 'hygiene' + structured subtype/custom label.
-- Does NOT backfill, reclassify other rows, or touch RLS.
-- App presets (bath, dry_bath, …, other) are open text — no closed subtype enum.

-- ---------------------------------------------------------------------------
-- Expand health_records.type CHECK to include hygiene
-- ---------------------------------------------------------------------------

alter table public.health_records
  drop constraint if exists health_records_type_check;

alter table public.health_records
  add constraint health_records_type_check
  check (type in (
    'vaccine',
    'consultation',
    'exam',
    'medication',
    'disease',
    'allergy',
    'surgery',
    'deworming',
    'other',
    'hygiene'
  ));

-- ---------------------------------------------------------------------------
-- hygiene_subtype + hygiene_custom_label
-- ---------------------------------------------------------------------------

alter table public.health_records
  add column if not exists hygiene_subtype text null;

alter table public.health_records
  add column if not exists hygiene_custom_label text null;

alter table public.health_records
  drop constraint if exists health_records_hygiene_subtype_nonempty;
alter table public.health_records
  add constraint health_records_hygiene_subtype_nonempty
  check (hygiene_subtype is null or char_length(btrim(hygiene_subtype)) > 0);

alter table public.health_records
  drop constraint if exists health_records_hygiene_custom_label_nonempty;
alter table public.health_records
  add constraint health_records_hygiene_custom_label_nonempty
  check (hygiene_custom_label is null or char_length(btrim(hygiene_custom_label)) > 0);

-- Non-hygiene rows must keep hygiene_* null.
-- Hygiene rows require subtype; custom label only when subtype = 'other'.
alter table public.health_records
  drop constraint if exists health_records_hygiene_fields_consistency;
alter table public.health_records
  add constraint health_records_hygiene_fields_consistency
  check (
    (
      type <> 'hygiene'
      and hygiene_subtype is null
      and hygiene_custom_label is null
    )
    or (
      type = 'hygiene'
      and hygiene_subtype is not null
      and (
        (btrim(hygiene_subtype) = 'other' and hygiene_custom_label is not null)
        or (btrim(hygiene_subtype) <> 'other' and hygiene_custom_label is null)
      )
    )
  );

comment on column public.health_records.hygiene_subtype is
  'Structured hygiene kind key (e.g. bath, nail_trim, other). Required when type=hygiene. Open text — presets live in the app.';

comment on column public.health_records.hygiene_custom_label is
  'Human label required when hygiene_subtype=other. Must be null for any other subtype.';
