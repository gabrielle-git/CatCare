-- CatCare — listar membros da família e gerenciar papéis (owner / caregiver / viewer)

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
  order by hm.created_at
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
  order by hm.created_at
  limit 1;
$$;

create or replace function public.household_roster()
returns table (
  user_id uuid,
  display_name text,
  role text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    hm.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Membro'),
    hm.role,
    hm.created_at
  from public.household_members hm
  left join public.profiles p on p.id = hm.user_id
  where hm.household_id = public.my_household_id()
    and public.is_household_member(hm.household_id)
  order by
    case hm.role when 'owner' then 0 when 'caregiver' then 1 else 2 end,
    hm.created_at;
$$;

create or replace function public.set_member_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.my_household_id();
begin
  if hid is null or not public.is_household_owner(hid) then
    raise exception 'Apenas o dono pode alterar papéis.' using errcode = '42501';
  end if;
  if new_role not in ('caregiver', 'viewer') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.household_members
    where household_id = hid and user_id = target_user_id and role = 'owner'
  ) then
    raise exception 'Não é possível alterar o dono da família.' using errcode = '42501';
  end if;
  update public.household_members
  set role = new_role
  where household_id = hid and user_id = target_user_id;
end;
$$;

create or replace function public.remove_household_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.my_household_id();
begin
  if hid is null or not public.is_household_owner(hid) then
    raise exception 'Apenas o dono pode remover membros.' using errcode = '42501';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'O dono não pode sair desta forma.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.household_members
    where household_id = hid and user_id = target_user_id and role = 'owner'
  ) then
    raise exception 'Não é possível remover o dono.' using errcode = '42501';
  end if;
  delete from public.household_members
  where household_id = hid and user_id = target_user_id;
end;
$$;

revoke all on function public.my_household_id() from public;
revoke all on function public.my_household_role() from public;
revoke all on function public.household_roster() from public;
revoke all on function public.set_member_role(uuid, text) from public;
revoke all on function public.remove_household_member(uuid) from public;

grant execute on function public.my_household_id() to authenticated;
grant execute on function public.my_household_role() to authenticated;
grant execute on function public.household_roster() to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.remove_household_member(uuid) to authenticated;
