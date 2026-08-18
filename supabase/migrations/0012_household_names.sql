-- CatCare — renomear família + apelidos privados de membros

create table if not exists public.household_member_aliases (
  household_id uuid not null references public.households(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  alias text not null check (char_length(trim(alias)) > 0 and char_length(alias) <= 60),
  updated_at timestamptz not null default now(),
  primary key (household_id, viewer_id, member_id)
);

alter table public.household_member_aliases enable row level security;

create or replace function public.update_household_name(new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.my_household_id();
  cleaned text := trim(new_name);
begin
  if hid is null or not public.is_household_owner(hid) then
    raise exception 'Apenas o dono pode renomear a família.' using errcode = '42501';
  end if;
  if cleaned = '' or char_length(cleaned) > 80 then
    raise exception 'Informe um nome válido (até 80 caracteres).' using errcode = '22023';
  end if;
  update public.households set name = cleaned where id = hid;
end;
$$;

create or replace function public.set_member_alias(target_user_id uuid, alias_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid := public.my_household_id();
  cleaned text := trim(alias_text);
begin
  if hid is null or not public.is_household_member(hid) then
    raise exception 'Família não encontrada.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.household_members hm
    where hm.household_id = hid and hm.user_id = target_user_id
  ) then
    raise exception 'Membro não encontrado nesta família.' using errcode = '22023';
  end if;

  if cleaned = '' then
    delete from public.household_member_aliases
    where household_id = hid and viewer_id = auth.uid() and member_id = target_user_id;
    return;
  end if;

  if char_length(cleaned) > 60 then
    raise exception 'Apelido muito longo (máx. 60 caracteres).' using errcode = '22023';
  end if;

  insert into public.household_member_aliases (household_id, viewer_id, member_id, alias, updated_at)
  values (hid, auth.uid(), target_user_id, cleaned, now())
  on conflict (household_id, viewer_id, member_id) do update
  set alias = excluded.alias, updated_at = now();
end;
$$;

drop function if exists public.household_roster();

create function public.household_roster()
returns table (
  user_id uuid,
  display_name text,
  profile_name text,
  private_alias text,
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
    coalesce(nullif(trim(a.alias), ''), nullif(trim(p.display_name), ''), 'Membro'),
    coalesce(nullif(trim(p.display_name), ''), 'Membro'),
    nullif(trim(a.alias), ''),
    hm.role,
    hm.created_at
  from public.household_members hm
  left join public.profiles p on p.id = hm.user_id
  left join public.household_member_aliases a
    on a.household_id = hm.household_id
    and a.viewer_id = auth.uid()
    and a.member_id = hm.user_id
  where hm.household_id = public.my_household_id()
    and public.is_household_member(hm.household_id)
  order by
    case hm.role when 'owner' then 0 when 'caregiver' then 1 else 2 end,
    hm.created_at;
$$;

revoke all on function public.household_roster() from public;
grant execute on function public.household_roster() to authenticated;

revoke all on function public.update_household_name(text) from public;
revoke all on function public.set_member_alias(uuid, text) from public;
grant execute on function public.update_household_name(text) to authenticated;
grant execute on function public.set_member_alias(uuid, text) to authenticated;
