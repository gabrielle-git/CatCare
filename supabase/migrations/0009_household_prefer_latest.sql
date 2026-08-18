-- CatCare — priorizar a família mais recente (ex.: após aceitar convite)

create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hm.household_id
  from public.household_members hm
  where hm.user_id = auth.uid()
  order by hm.created_at desc
  limit 1;
$$;

create or replace function public.my_household_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select hm.role
  from public.household_members hm
  where hm.user_id = auth.uid()
    and hm.household_id = public.my_household_id();
$$;
