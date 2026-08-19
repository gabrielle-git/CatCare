-- CatCare — mensalidade Leve editável por família + promo/cupom por plano

alter table public.households
  add column if not exists petlove_leve_base_fee_cents integer
    check (petlove_leve_base_fee_cents is null or petlove_leve_base_fee_cents >= 0);

alter table public.health_plans
  add column if not exists promo_coupon_code text,
  add column if not exists zero_waiting_consultation boolean not null default false,
  add column if not exists zero_waiting_vaccine boolean not null default false,
  add column if not exists promo_notes text;
