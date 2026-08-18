-- CatCare — delete_household não apaga Storage via SQL (a API do Storage recusa).
-- Arquivos são removidos na Server Action com storage.from('pet-media').remove(...)

create or replace function public.delete_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.my_household_id();
  next_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if hid is null or not public.is_household_owner(hid) then
    raise exception 'Apenas o dono pode excluir a família.' using errcode = '42501';
  end if;
  if (
    select count(*) from public.household_members where household_id = hid
  ) > 1 then
    raise exception 'Há outros membros. Transfira o dono ou remova as outras pessoas antes de excluir.' using errcode = '42501';
  end if;

  delete from public.memory_media where household_id = hid;
  delete from public.memory_pets where household_id = hid;
  delete from public.review_pets where household_id = hid;
  delete from public.purchase_pets where household_id = hid;
  delete from public.expense_pets where household_id = hid;
  delete from public.product_reviews where household_id = hid;
  delete from public.purchases where household_id = hid;
  delete from public.products where household_id = hid;
  delete from public.memories where household_id = hid;
  delete from public.documents where household_id = hid;
  delete from public.reminders where household_id = hid;
  delete from public.expenses where household_id = hid;
  delete from public.neonatal_records where household_id = hid;
  delete from public.vaccine_doses where household_id = hid;
  delete from public.health_records where household_id = hid;
  delete from public.weight_records where household_id = hid;
  delete from public.pets where household_id = hid;
  delete from public.household_invites where household_id = hid;
  delete from public.household_member_aliases where household_id = hid;
  delete from public.household_members where household_id = hid;
  delete from public.households where id = hid;

  select hm.household_id into next_id
  from public.household_members hm
  where hm.user_id = uid
  order by hm.created_at desc
  limit 1;

  update public.profiles
  set active_household_id = next_id, updated_at = now()
  where id = uid;
end;
$$;
