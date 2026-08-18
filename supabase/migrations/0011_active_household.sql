-- CatCare — família ativa (trocar entre famílias) + corrigir bootstrap

alter table public.profiles
  add column if not exists active_household_id uuid references public.households(id) on delete set null;

create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.active_household_id
      from public.profiles p
      where p.id = auth.uid()
        and p.active_household_id is not null
        and exists (
          select 1 from public.household_members hm
          where hm.user_id = auth.uid() and hm.household_id = p.active_household_id
        )
    ),
    (
      select hm.household_id
      from public.household_members hm
      where hm.user_id = auth.uid()
      order by hm.created_at desc
      limit 1
    )
  );
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

create or replace function public.list_my_households()
returns table (
  household_id uuid,
  name text,
  role text,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    hm.household_id,
    h.name,
    hm.role,
    hm.household_id = public.my_household_id()
  from public.household_members hm
  join public.households h on h.id = hm.household_id
  where hm.user_id = auth.uid()
  order by
    (hm.household_id = public.my_household_id()) desc,
    case hm.role when 'owner' then 0 when 'caregiver' then 1 else 2 end,
    hm.created_at;
$$;

create or replace function public.set_active_household(target_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.household_members hm
    where hm.user_id = auth.uid() and hm.household_id = target_household_id
  ) then
    raise exception 'Você não faz parte desta família.' using errcode = '42501';
  end if;

  update public.profiles
  set active_household_id = target_household_id, updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.ensure_my_household()
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  result public.households;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  hid := public.my_household_id();
  if hid is not null then
    select h.* into result from public.households h where h.id = hid;
    if found then
      return result;
    end if;
  end if;

  select h.* into result
  from public.households h
  where h.owner_id = uid
  limit 1;

  if found then
    insert into public.household_members(household_id, user_id, role)
    values (result.id, uid, 'owner')
    on conflict do nothing;
    update public.profiles set active_household_id = result.id, updated_at = now() where id = uid;
    return result;
  end if;

  insert into public.households(owner_id, name)
  values (uid, 'Nossa família')
  returning * into result;

  update public.profiles set active_household_id = result.id, updated_at = now() where id = uid;
  return result;
end;
$$;

create or replace function public.accept_household_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.household_invites%rowtype;
  user_email text;
  orphan_id uuid;
  already uuid;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select i.household_id into already
  from public.household_invites i
  where i.token = invite_token
    and i.accepted_by = uid
    and i.accepted_at is not null;

  if found then
    update public.profiles set active_household_id = already, updated_at = now() where id = uid;
    return already;
  end if;

  select * into inv
  from public.household_invites
  where token = invite_token
    and revoked_at is null
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'Convite inválido ou expirado. Peça um novo convite em Configurações → Membros.' using errcode = '22023';
  end if;

  select lower(email) into user_email from auth.users where id = uid;
  if user_email is distinct from inv.email then
    raise exception 'Este convite foi enviado para outro e-mail. Entre com a conta correta.' using errcode = '42501';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, uid, inv.role)
  on conflict (household_id, user_id) do update set role = excluded.role;

  update public.household_invites
  set accepted_at = now(), accepted_by = uid
  where id = inv.id;

  update public.profiles
  set active_household_id = inv.household_id, updated_at = now()
  where id = uid;

  for orphan_id in
    select h.id
    from public.households h
    where h.owner_id = uid
      and h.id <> inv.household_id
      and not exists (select 1 from public.pets p where p.household_id = h.id)
      and (select count(*) from public.household_members hm where hm.household_id = h.id) = 1
  loop
    delete from public.households where id = orphan_id;
  end loop;

  return inv.household_id;
end;
$$;

revoke all on function public.list_my_households() from public;
revoke all on function public.set_active_household(uuid) from public;
grant execute on function public.list_my_households() to authenticated;
grant execute on function public.set_active_household(uuid) to authenticated;
