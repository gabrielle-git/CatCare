-- Neonatal feeding structure: subtype + structured amount (value/unit).
-- Does NOT backfill, reclassify, or touch amount_ml / notes / type values.
-- Legacy rows keep amount_ml only; new feeding rows use feeding_amount_* .
-- App contract (future): prefer feeding_amount_value+unit; else amount_ml as ml.
-- type remains 'feeding'; subtype is orthogonal (milk/wet_food/puree/other in UI).

-- ---------------------------------------------------------------------------
-- feeding_subtype: extensible text (no closed enum — avoid migration per subtype)
-- ---------------------------------------------------------------------------

alter table public.neonatal_records
  add column if not exists feeding_subtype text null;

alter table public.neonatal_records
  drop constraint if exists neonatal_records_feeding_subtype_nonempty;
alter table public.neonatal_records
  add constraint neonatal_records_feeding_subtype_nonempty
  check (feeding_subtype is null or char_length(btrim(feeding_subtype)) > 0);

comment on column public.neonatal_records.feeding_subtype is
  'Optional structured feeding kind (e.g. milk, wet_food, puree, other). NULL = legacy / unspecified. Only meaningful when type=feeding.';

-- ---------------------------------------------------------------------------
-- feeding_amount_value + feeding_amount_unit: structured quantity for new feedings
-- amount_ml stays legacy-only; do not store grams/spoons in amount_ml.
-- ---------------------------------------------------------------------------

alter table public.neonatal_records
  add column if not exists feeding_amount_value numeric(7,2) null;

alter table public.neonatal_records
  add column if not exists feeding_amount_unit text null;

alter table public.neonatal_records
  drop constraint if exists neonatal_records_feeding_amount_value_positive;
alter table public.neonatal_records
  add constraint neonatal_records_feeding_amount_value_positive
  check (feeding_amount_value is null or feeding_amount_value > 0);

alter table public.neonatal_records
  drop constraint if exists neonatal_records_feeding_amount_unit_nonempty;
alter table public.neonatal_records
  add constraint neonatal_records_feeding_amount_unit_nonempty
  check (feeding_amount_unit is null or char_length(btrim(feeding_amount_unit)) > 0);

-- Pairing: both null or both set. Independent of amount_ml.
alter table public.neonatal_records
  drop constraint if exists neonatal_records_feeding_amount_value_unit_pair;
alter table public.neonatal_records
  add constraint neonatal_records_feeding_amount_value_unit_pair
  check (
    (feeding_amount_value is null and feeding_amount_unit is null)
    or (feeding_amount_value is not null and feeding_amount_unit is not null)
  );

-- Feeding-domain columns must stay null on non-feeding rows.
alter table public.neonatal_records
  drop constraint if exists neonatal_records_feeding_fields_only_when_feeding;
alter table public.neonatal_records
  add constraint neonatal_records_feeding_fields_only_when_feeding
  check (
    type = 'feeding'
    or (
      feeding_subtype is null
      and feeding_amount_value is null
      and feeding_amount_unit is null
    )
  );

comment on column public.neonatal_records.feeding_amount_value is
  'Structured quantity for new feeding records. Pair with feeding_amount_unit. NULL on legacy rows that use amount_ml.';
comment on column public.neonatal_records.feeding_amount_unit is
  'Unit for feeding_amount_value (e.g. ml, g, spoon, or free text). Must be null iff feeding_amount_value is null.';
comment on column public.neonatal_records.amount_ml is
  'Legacy feeding quantity in millilitres. Not modified by 0030; new structured amounts use feeding_amount_value + feeding_amount_unit.';
