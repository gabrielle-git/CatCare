-- CatCare — notas de referência nas tabelas de coparticipação

alter table public.health_plan_guides
  add column if not exists payment_notes text,
  add column if not exists waiting_notes text;
