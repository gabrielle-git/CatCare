-- CatCare — vários clubes "outro" por família (Petlove continua único)

alter table public.benefit_memberships drop constraint if exists benefit_memberships_household_id_kind_key;

create unique index if not exists benefit_memberships_one_petlove_per_household
  on public.benefit_memberships (household_id)
  where kind = 'petlove_club';

create unique index if not exists benefit_memberships_other_name_per_household
  on public.benefit_memberships (household_id, lower(trim(custom_name)))
  where kind = 'other' and custom_name is not null;
