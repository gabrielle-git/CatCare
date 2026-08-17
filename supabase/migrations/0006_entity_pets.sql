-- CatCare — vários gatinhos por gasto, compra ou avaliação (como memory_pets)

create table if not exists public.expense_pets (
  household_id uuid not null references public.households(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  pet_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (expense_id, pet_id),
  foreign key (pet_id, household_id) references public.pets(id, household_id) on delete cascade
);

create table if not exists public.purchase_pets (
  household_id uuid not null references public.households(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  pet_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (purchase_id, pet_id),
  foreign key (pet_id, household_id) references public.pets(id, household_id) on delete cascade
);

create table if not exists public.review_pets (
  household_id uuid not null references public.households(id) on delete cascade,
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  pet_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (review_id, pet_id),
  foreign key (pet_id, household_id) references public.pets(id, household_id) on delete cascade
);

create index if not exists expense_pets_pet_idx on public.expense_pets(pet_id, expense_id);
create index if not exists purchase_pets_pet_idx on public.purchase_pets(pet_id, purchase_id);
create index if not exists review_pets_pet_idx on public.review_pets(pet_id, review_id);

insert into public.expense_pets (household_id, expense_id, pet_id)
select household_id, id, pet_id from public.expenses where pet_id is not null
on conflict do nothing;

insert into public.purchase_pets (household_id, purchase_id, pet_id)
select household_id, id, pet_id from public.purchases where pet_id is not null
on conflict do nothing;

insert into public.review_pets (household_id, review_id, pet_id)
select household_id, id, pet_id from public.product_reviews where pet_id is not null
on conflict do nothing;

alter table public.expense_pets enable row level security;
alter table public.purchase_pets enable row level security;
alter table public.review_pets enable row level security;

drop policy if exists "expense_pets_member_select" on public.expense_pets;
create policy "expense_pets_member_select" on public.expense_pets for select using (public.is_household_member(household_id));
drop policy if exists "expense_pets_member_insert" on public.expense_pets;
create policy "expense_pets_member_insert" on public.expense_pets for insert with check (public.can_edit_household(household_id));
drop policy if exists "expense_pets_member_update" on public.expense_pets;
create policy "expense_pets_member_update" on public.expense_pets for update using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
drop policy if exists "expense_pets_member_delete" on public.expense_pets;
create policy "expense_pets_member_delete" on public.expense_pets for delete using (public.can_edit_household(household_id));

drop policy if exists "purchase_pets_member_select" on public.purchase_pets;
create policy "purchase_pets_member_select" on public.purchase_pets for select using (public.is_household_member(household_id));
drop policy if exists "purchase_pets_member_insert" on public.purchase_pets;
create policy "purchase_pets_member_insert" on public.purchase_pets for insert with check (public.can_edit_household(household_id));
drop policy if exists "purchase_pets_member_update" on public.purchase_pets;
create policy "purchase_pets_member_update" on public.purchase_pets for update using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
drop policy if exists "purchase_pets_member_delete" on public.purchase_pets;
create policy "purchase_pets_member_delete" on public.purchase_pets for delete using (public.can_edit_household(household_id));

drop policy if exists "review_pets_member_select" on public.review_pets;
create policy "review_pets_member_select" on public.review_pets for select using (public.is_household_member(household_id));
drop policy if exists "review_pets_member_insert" on public.review_pets;
create policy "review_pets_member_insert" on public.review_pets for insert with check (public.can_edit_household(household_id));
drop policy if exists "review_pets_member_update" on public.review_pets;
create policy "review_pets_member_update" on public.review_pets for update using (public.can_edit_household(household_id)) with check (public.can_edit_household(household_id));
drop policy if exists "review_pets_member_delete" on public.review_pets;
create policy "review_pets_member_delete" on public.review_pets for delete using (public.can_edit_household(household_id));
