-- CatCare — convites por e-mail para entrar na família

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  role text not null check (role in ('caregiver', 'viewer')),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint household_invites_email_lower check (email = lower(email))
);

create unique index if not exists household_invites_pending_unique
  on public.household_invites (household_id, email)
  where accepted_at is null and revoked_at is null;

alter table public.household_invites enable row level security;

create or replace function public.create_household_invite(invitee_email text, invite_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.my_household_id();
  normalized text := lower(trim(invitee_email));
  new_token text;
begin
  if hid is null or not public.is_household_owner(hid) then
    raise exception 'Apenas o dono pode convidar.' using errcode = '42501';
  end if;
  if invite_role not in ('caregiver', 'viewer') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;
  if normalized !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'E-mail inválido.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from auth.users u
    join public.household_members hm on hm.user_id = u.id and hm.household_id = hid
    where lower(u.email) = normalized
  ) then
    raise exception 'Esta pessoa já faz parte da família.' using errcode = '23505';
  end if;

  update public.household_invites
  set revoked_at = now()
  where household_id = hid
    and email = normalized
    and accepted_at is null
    and revoked_at is null;

  insert into public.household_invites (household_id, email, role, invited_by)
  values (hid, normalized, invite_role, auth.uid())
  returning token into new_token;

  return new_token;
end;
$$;

create or replace function public.list_household_invites()
returns table (
  id uuid,
  email text,
  role text,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.email, i.role, i.expires_at, i.created_at
  from public.household_invites i
  where i.household_id = public.my_household_id()
    and public.is_household_owner(i.household_id)
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
  order by i.created_at desc;
$$;

create or replace function public.revoke_household_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.my_household_id();
begin
  if hid is null or not public.is_household_owner(hid) then
    raise exception 'Apenas o dono pode cancelar convites.' using errcode = '42501';
  end if;

  update public.household_invites
  set revoked_at = now()
  where id = invite_id
    and household_id = hid
    and accepted_at is null
    and revoked_at is null;

  if not found then
    raise exception 'Convite não encontrado.' using errcode = '22023';
  end if;
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
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into inv
  from public.household_invites
  where token = invite_token
    and revoked_at is null
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'Convite inválido ou expirado.' using errcode = '22023';
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

revoke all on function public.create_household_invite(text, text) from public;
revoke all on function public.list_household_invites() from public;
revoke all on function public.revoke_household_invite(uuid) from public;
revoke all on function public.accept_household_invite(text) from public;

grant execute on function public.create_household_invite(text, text) to authenticated;
grant execute on function public.list_household_invites() to authenticated;
grant execute on function public.revoke_household_invite(uuid) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
