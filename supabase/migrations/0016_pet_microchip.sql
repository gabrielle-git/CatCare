-- CatCare — microchip no perfil do gato

alter table public.pets
  add column if not exists has_microchip boolean not null default false,
  add column if not exists microchip_number text,
  add column if not exists microchip_implanted_at date,
  add column if not exists microchip_location text;
