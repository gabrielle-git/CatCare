-- CatCare / Cuidadim — M4 multi-plan health schema (0039)
--
-- DEC-045. Does not apply itself to production.
--
-- Preserves every existing health_plans row, copay rule, guide, template and purchase.
-- Drops only the global UNIQUE (pet_id) from 0019 so a pet may have 0..N plans,
-- including more than one active plan. History stays on the same row via ended_at.
--
-- CHECK is one implication only: a plan with ended_at cannot stay active.
-- An inactive plan may still have ended_at NULL (closed without a recorded date).
-- There is no partial unique index on active plans.
--
-- Composite FK (pet_id, household_id) -> pets (id, household_id) rejects a plan
-- whose pet belongs to another household. The existing pet_id FK is kept.
-- Aborts if any current row would violate that pair. Does not rewrite rows.
--
-- Idempotent create stays on the primary key: the app mints a stable id and
-- retries the same id. This migration adds no second idempotency key.
--
-- OUT OF SCOPE:
--   - app create/end/delete behavior (still one-plan in the current UI)
--   - cart mutation RPC previously mentioned as a placeholder in 0038
--   - 0040 purchases.product_id
--   - Auth / Storage / RLS policy changes

-- ---------------------------------------------------------------------------
-- A. ended_at (same calendar type as started_at)
-- ---------------------------------------------------------------------------

alter table public.health_plans
  add column if not exists ended_at date;

comment on column public.health_plans.ended_at is
  'Optional close date. NULL while the plan is open. Setting it requires active = false. Inactive plans may keep ended_at NULL. Not a delete.';

-- ---------------------------------------------------------------------------
-- B. active × ended_at (implication only)
-- ---------------------------------------------------------------------------

alter table public.health_plans
  drop constraint if exists health_plans_active_ended_at_check;

alter table public.health_plans
  add constraint health_plans_active_ended_at_check
  check (ended_at is null or active = false);

-- ---------------------------------------------------------------------------
-- C. Allow more than one plan per pet
-- ---------------------------------------------------------------------------

do $$
declare
  cname text;
begin
  select c.conname into cname
  from pg_constraint c
  where c.conrelid = 'public.health_plans'::regclass
    and c.contype = 'u'
    and pg_get_constraintdef(c.oid) = 'UNIQUE (pet_id)';
  if cname is not null then
    execute format('alter table public.health_plans drop constraint %I', cname);
  end if;
end $$;

-- Lookup only. Not unique, and not partial on active.
create index if not exists health_plans_pet_idx
  on public.health_plans (pet_id);

-- ---------------------------------------------------------------------------
-- D. Pet must belong to the plan household
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from public.health_plans hp
    left join public.pets p
      on p.id = hp.pet_id
     and p.household_id = hp.household_id
    where p.id is null
  ) then
    raise exception '0039 aborted: health_plans row has no pet in the same household; refusing to rewrite rows';
  end if;
end $$;

alter table public.health_plans
  drop constraint if exists health_plans_pet_household_fkey;

alter table public.health_plans
  add constraint health_plans_pet_household_fkey
  foreign key (pet_id, household_id)
  references public.pets (id, household_id)
  on delete cascade;
