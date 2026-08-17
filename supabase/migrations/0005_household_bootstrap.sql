-- CatCare — bootstrap da família sem quebrar RLS no primeiro login.
-- O INSERT...RETURNING em households exigia ser membro, mas o membro só nasce no trigger.
-- Rode no SQL Editor se o app já estava no ar.

drop policy if exists "households member select" on public.households;
create policy "households member select" on public.households
for select using (owner_id = auth.uid() or public.is_household_member(id));

drop policy if exists "households owner insert" on public.households;
create policy "households owner insert" on public.households
for insert to authenticated with check (owner_id = auth.uid());

grant select, insert, update, delete on table public.households to authenticated;
grant select, insert, update, delete on table public.household_members to authenticated;

create or replace function public.ensure_my_household()
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.households;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select h.* into result
  from public.households h
  join public.household_members hm on hm.household_id = h.id
  where hm.user_id = uid
  order by hm.created_at
  limit 1;

  if found then
    return result;
  end if;

  select h.* into result
  from public.households h
  where h.owner_id = uid
  limit 1;

  if found then
    insert into public.household_members(household_id, user_id, role)
    values (result.id, uid, 'owner')
    on conflict do nothing;
    return result;
  end if;

  insert into public.households(owner_id, name)
  values (uid, 'Nossa família')
  returning * into result;

  return result;
end;
$$;

revoke all on function public.ensure_my_household() from public;
revoke all on function public.ensure_my_household() from anon;
grant execute on function public.ensure_my_household() to authenticated;
