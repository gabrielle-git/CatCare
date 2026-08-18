-- CatCare — transferir dono, sair da família e excluir família (ativa via my_household_id)

drop index if exists public.households_one_owned_per_user;

create or replace function public.transfer_ownership(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid := public.my_household_id();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if hid is null or not public.is_household_owner(hid) then
    raise exception 'Apenas o dono pode transferir a família.' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = uid then
    raise exception 'Escolha outro membro para ser o novo dono.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.household_members
    where household_id = hid and user_id = target_user_id
  ) then
    raise exception 'Essa pessoa não faz parte desta família.' using errcode = '42501';
  end if;

  update public.households
  set owner_id = target_user_id
  where id = hid;

  update public.household_members
  set role = 'owner'
  where household_id = hid and user_id = target_user_id;

  update public.household_members
  set role = 'caregiver'
  where household_id = hid and user_id = uid;
end;
$$;

create or replace function public.leave_household()
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
  if hid is null then
    raise exception 'Você não faz parte de nenhuma família.' using errcode = '42501';
  end if;
  if public.is_household_owner(hid) then
    raise exception 'O dono precisa transferir a família antes de sair.' using errcode = '42501';
  end if;

  delete from public.household_members
  where household_id = hid and user_id = uid;

  delete from public.household_member_aliases
  where household_id = hid and (viewer_id = uid or member_id = uid);

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

  -- Arquivos do bucket pet-media são apagados na Server Action via Storage API.

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

revoke all on function public.transfer_ownership(uuid) from public;
revoke all on function public.leave_household() from public;
revoke all on function public.delete_household() from public;

grant execute on function public.transfer_ownership(uuid) to authenticated;
grant execute on function public.leave_household() to authenticated;
grant execute on function public.delete_household() to authenticated;
