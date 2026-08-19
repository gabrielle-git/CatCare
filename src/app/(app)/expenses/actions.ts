"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncEntityPets, validateEntityPets } from "@/lib/entity-pets";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
import { parsePetIds, resolveOptionalPetId, sharedFromPetIds } from "@/lib/pet-form";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory } from "@/types/database";

const categories = new Set<ExpenseCategory>(["veterinary", "food", "medication", "hygiene", "accessory", "transport", "other"]);
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function moneyToCents(raw: string) {
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
}

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { supabase, household };
}

async function saveExpensePets(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string, expenseId: string, petIds: string[]) {
  await validateEntityPets(supabase, householdId, petIds);
  await syncEntityPets(supabase, "expense_pets", householdId, expenseId, petIds);
}

export async function createExpense(formData: FormData) {
  const description = value(formData, "description");
  const categoryValue = value(formData, "category") as ExpenseCategory;
  const amountCents = moneyToCents(value(formData, "amount"));
  const date = value(formData, "occurred_on");
  if (!description || !categories.has(categoryValue) || !Number.isFinite(amountCents) || amountCents < 0 || !date) redirect("/expenses/new?error=Confira%20os%20campos%20obrigat%C3%B3rios.");

  const { supabase, household } = await authContext();
  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const shared = sharedFromPetIds(petIds);
  const { data: created, error } = await supabase.from("expenses").insert({
    household_id: household.id,
    pet_id: petId,
    category: categoryValue,
    description,
    amount_cents: amountCents,
    occurred_at: `${date}T12:00:00-03:00`,
    shared,
    notes: value(formData, "notes") || null,
  }).select("id").single();
  if (error) redirect(`/expenses/new?error=${encodeURIComponent(error.message)}`);
  try {
    await saveExpensePets(supabase, household.id, created.id, petIds);
  } catch (petError) {
    await supabase.from("expenses").delete().eq("id", created.id).eq("household_id", household.id);
    redirect(`/expenses/new?error=${encodeURIComponent(petError instanceof Error ? petError.message : "Não foi possível vincular os pets.")}`);
  }
  revalidatePath("/expenses");
  revalidatePath("/");
  redirect("/expenses?saved=1");
}

export async function updateExpense(expenseId: string, formData: FormData) {
  const description = value(formData, "description");
  const categoryValue = value(formData, "category") as ExpenseCategory;
  const amountCents = moneyToCents(value(formData, "amount"));
  const date = value(formData, "occurred_on");
  if (!description || !categories.has(categoryValue) || !Number.isFinite(amountCents) || amountCents < 0 || !date) redirect(`/expenses/${expenseId}/edit?error=Confira%20os%20campos%20obrigat%C3%B3rios.`);

  const { supabase, household } = await authContext();
  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const shared = sharedFromPetIds(petIds);
  const { error } = await supabase.from("expenses").update({
    pet_id: petId,
    category: categoryValue,
    description,
    amount_cents: amountCents,
    occurred_at: `${date}T12:00:00-03:00`,
    shared,
    notes: value(formData, "notes") || null,
  }).eq("id", expenseId).eq("household_id", household.id);
  if (error) redirect(`/expenses/${expenseId}/edit?error=${encodeURIComponent(error.message)}`);
  try {
    await saveExpensePets(supabase, household.id, expenseId, petIds);
  } catch (petError) {
    redirect(`/expenses/${expenseId}/edit?error=${encodeURIComponent(petError instanceof Error ? petError.message : "Não foi possível vincular os pets.")}`);
  }

  const linkedPurchase = await supabase.from("purchases").select("id").eq("expense_id", expenseId).eq("household_id", household.id).maybeSingle();
  if (linkedPurchase.data) {
    await supabase.from("purchases").update({
      pet_id: petId,
      amount_cents: amountCents,
      purchased_at: `${date}T12:00:00-03:00`,
    }).eq("id", linkedPurchase.data.id).eq("household_id", household.id);
    await syncEntityPets(supabase, "purchase_pets", household.id, linkedPurchase.data.id, petIds);
  }

  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/shopping");
  redirect("/expenses?updated=1");
}

export async function deleteExpense(expenseId: string) {
  const { supabase, household } = await authContext();
  const linkedPurchase = await supabase.from("purchases").select("id").eq("expense_id", expenseId).eq("household_id", household.id).maybeSingle();
  if (linkedPurchase.data) {
    await supabase.from("purchases").delete().eq("id", linkedPurchase.data.id).eq("household_id", household.id);
  }
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId).eq("household_id", household.id);
  if (error) redirect(`/expenses?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/shopping");
  redirect("/expenses?deleted=1");
}
