-- CatCare — aceitar convite de novo não quebra se já foi aceito

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
