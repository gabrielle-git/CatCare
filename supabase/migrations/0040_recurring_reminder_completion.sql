-- Recurring reminder completion.
-- Adds series identity and the original monthly day. Does not change due_at,
-- completed_at, status, or notes, and does not insert a future occurrence.

alter table public.reminders
  add column if not exists series_id uuid,
  add column if not exists recurrence_anchor_day smallint;

alter table public.reminders
  drop constraint if exists reminders_anchor_day_check;

alter table public.reminders
  add constraint reminders_anchor_day_check
  check (recurrence_anchor_day is null or recurrence_anchor_day between 1 and 31);

update public.reminders
set series_id = id
where series_id is null;

-- Civil clock is the fixed UTC−3 offset the app already stores.
-- America/Sao_Paulo has had no daylight saving since 2019; using the IANA history
-- would move a pre-2019 timestamp stored as −03:00 by one hour.
update public.reminders
set recurrence_anchor_day = extract(day from ((due_at at time zone 'UTC') - interval '3 hours'))::smallint
where recurrence_rule = 'FREQ=MONTHLY'
  and recurrence_anchor_day is null;

alter table public.reminders
  alter column series_id set not null;

create unique index if not exists reminders_one_open_occurrence_per_series
  on public.reminders (household_id, series_id)
  where status = 'pending' and recurrence_rule is not null;

create or replace function public.reminders_assign_series_id()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.series_id is null then
    new.series_id := new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists reminders_assign_series_id on public.reminders;
create trigger reminders_assign_series_id
  before insert on public.reminders
  for each row
  execute function public.reminders_assign_series_id();

-- Next occurrence on the America/Sao_Paulo civil calendar (fixed UTC−3).
-- Month length is calculated on that civil date, not by adding months in UTC.
-- One closed-form step, plus a single correction when that step is still due.
-- There is no year cap: a reminder years overdue jumps straight to the next future slot.
create or replace function public.next_reminder_due(
  p_due_at timestamptz,
  p_rule text,
  p_anchor_day smallint,
  p_as_of timestamptz
) returns timestamptz
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  due_local timestamp;
  as_of_local timestamp;
  step integer;
  day_diff integer;
  n integer;
  candidate timestamp;
  anchor integer;
  due_index integer;
  as_of_index integer;
  target_index integer;
  target_year integer;
  target_month integer;
  target_day integer;
  dim integer;
begin
  if p_rule not in ('FREQ=DAILY', 'FREQ=WEEKLY', 'FREQ=MONTHLY') then
    raise exception 'unsupported recurrence' using errcode = '22023';
  end if;

  due_local := (p_due_at at time zone 'UTC') - interval '3 hours';
  as_of_local := (p_as_of at time zone 'UTC') - interval '3 hours';

  if p_rule in ('FREQ=DAILY', 'FREQ=WEEKLY') then
    step := case when p_rule = 'FREQ=WEEKLY' then 7 else 1 end;
    day_diff := as_of_local::date - due_local::date;
    if day_diff <= 0 then
      n := 1;
    else
      n := ceil(day_diff::numeric / step)::integer;
      if n < 1 then
        n := 1;
      end if;
    end if;
    candidate := due_local + make_interval(days => n * step);
    if candidate <= as_of_local then
      candidate := due_local + make_interval(days => (n + 1) * step);
    end if;
    if candidate <= as_of_local then
      raise exception 'recurrence did not advance' using errcode = '22023';
    end if;
    return (candidate + interval '3 hours') at time zone 'UTC';
  end if;

  anchor := coalesce(p_anchor_day, extract(day from due_local)::integer);
  if anchor < 1 or anchor > 31 then
    raise exception 'invalid recurrence anchor' using errcode = '22023';
  end if;

  due_index := extract(year from due_local)::integer * 12 + extract(month from due_local)::integer - 1;
  as_of_index := extract(year from as_of_local)::integer * 12 + extract(month from as_of_local)::integer - 1;
  n := as_of_index - due_index;
  if n < 1 then
    n := 1;
  end if;

  target_index := due_index + n;
  target_year := target_index / 12;
  target_month := (target_index % 12) + 1;
  dim := extract(day from (make_date(target_year, target_month, 1) + interval '1 month' - interval '1 day'))::integer;
  target_day := least(anchor, dim);
  candidate := make_timestamp(
    target_year,
    target_month,
    target_day,
    extract(hour from due_local)::integer,
    extract(minute from due_local)::integer,
    extract(second from due_local)
  );
  if candidate <= as_of_local then
    n := n + 1;
    target_index := due_index + n;
    target_year := target_index / 12;
    target_month := (target_index % 12) + 1;
    dim := extract(day from (make_date(target_year, target_month, 1) + interval '1 month' - interval '1 day'))::integer;
    target_day := least(anchor, dim);
    candidate := make_timestamp(
      target_year,
      target_month,
      target_day,
      extract(hour from due_local)::integer,
      extract(minute from due_local)::integer,
      extract(second from due_local)
    );
  end if;
  if candidate <= as_of_local then
    raise exception 'recurrence did not advance' using errcode = '22023';
  end if;
  return (candidate + interval '3 hours') at time zone 'UTC';
end;
$$;

create or replace function public.complete_reminder(p_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec public.reminders%rowtype;
  completed timestamptz := clock_timestamp();
  next_due timestamptz;
  next_anchor smallint;
  next_id uuid;
  updated_count integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into rec
  from public.reminders
  where id = p_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not public.can_edit_household(rec.household_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into rec
  from public.reminders
  where id = p_id
    and household_id = rec.household_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if rec.status <> 'pending' then
    return jsonb_build_object('ok', true, 'status', 'already_done');
  end if;

  if rec.recurrence_rule is null or btrim(rec.recurrence_rule) = '' then
    update public.reminders
    set status = 'done',
        completed_at = completed,
        updated_at = completed
    where id = rec.id
      and household_id = rec.household_id
      and status = 'pending';
    get diagnostics updated_count = row_count;
    if updated_count <> 1 then
      raise exception 'reminder completion did not persist' using errcode = '40001';
    end if;
    return jsonb_build_object('ok', true, 'status', 'completed', 'next_id', null);
  end if;

  next_due := public.next_reminder_due(
    rec.due_at,
    rec.recurrence_rule,
    rec.recurrence_anchor_day,
    completed
  );
  next_anchor := case
    when rec.recurrence_rule = 'FREQ=MONTHLY' then coalesce(
      rec.recurrence_anchor_day,
      extract(day from ((rec.due_at at time zone 'UTC') - interval '3 hours'))::smallint
    )
    else null
  end;

  update public.reminders
  set status = 'done',
      completed_at = completed,
      updated_at = completed
  where id = rec.id
    and household_id = rec.household_id
    and status = 'pending';
  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'reminder completion did not persist' using errcode = '40001';
  end if;

  insert into public.reminders (
    household_id,
    pet_id,
    health_record_id,
    title,
    category,
    due_at,
    recurrence_rule,
    recurrence_anchor_day,
    series_id,
    status,
    notes
  ) values (
    rec.household_id,
    rec.pet_id,
    null,
    rec.title,
    rec.category,
    next_due,
    rec.recurrence_rule,
    next_anchor,
    coalesce(rec.series_id, rec.id),
    'pending',
    rec.notes
  )
  returning id into next_id;

  return jsonb_build_object('ok', true, 'status', 'completed', 'next_id', next_id);
end;
$$;

revoke all on function public.reminders_assign_series_id() from public;
revoke all on function public.reminders_assign_series_id() from anon;
grant execute on function public.reminders_assign_series_id() to authenticated;

revoke all on function public.next_reminder_due(timestamptz, text, smallint, timestamptz) from public;
revoke all on function public.next_reminder_due(timestamptz, text, smallint, timestamptz) from anon;
grant execute on function public.next_reminder_due(timestamptz, text, smallint, timestamptz) to authenticated;

revoke all on function public.complete_reminder(uuid) from public;
revoke all on function public.complete_reminder(uuid) from anon;
grant execute on function public.complete_reminder(uuid) to authenticated;
