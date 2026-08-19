-- CatCare — registro de vermífugo como tipo próprio em health_records

alter table public.health_records
  drop constraint if exists health_records_type_check;

alter table public.health_records
  add constraint health_records_type_check
  check (type in ('vaccine', 'consultation', 'exam', 'medication', 'disease', 'allergy', 'surgery', 'deworming', 'other'));
