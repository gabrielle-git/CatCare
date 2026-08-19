-- CatCare — detalhes de castração no perfil do pet

alter table public.pets
  add column if not exists neutered_at date,
  add column if not exists neutered_place text;
