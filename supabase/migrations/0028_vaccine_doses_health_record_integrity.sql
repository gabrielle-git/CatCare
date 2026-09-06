-- Integrity only: health_records → vaccine_doses
-- - FK ON DELETE CASCADE (column stays nullable)
-- - Partial UNIQUE on health_record_id (linked doses only)
-- Does NOT delete orphans (health_record_id IS NULL).
-- Does NOT unique (pet_id, vaccine_name, dose_label).

ALTER TABLE public.vaccine_doses
  DROP CONSTRAINT vaccine_doses_health_record_id_fkey;

ALTER TABLE public.vaccine_doses
  ADD CONSTRAINT vaccine_doses_health_record_id_fkey
  FOREIGN KEY (health_record_id)
  REFERENCES public.health_records (id)
  ON DELETE CASCADE;

CREATE UNIQUE INDEX vaccine_doses_health_record_id_uidx
  ON public.vaccine_doses (health_record_id)
  WHERE health_record_id IS NOT NULL;
