"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureHousehold } from "@/lib/households";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory } from "@/types/database";

const categories = new Set<ExpenseCategory>(["veterinary", "food", "medication", "hygiene", "accessory", "transport", "other"]);
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function moneyToCents(raw: string) {
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
}

export async function createExpense(formData: FormData) {
  const description = value(formData, "description");
  const categoryValue = value(formData, "category") as ExpenseCategory;
  const amountCents = moneyToCents(value(formData, "amount"));
  const date = value(formData, "occurred_on");
  if (!description || !categories.has(categoryValue) || !Number.isFinite(amountCents) || amountCents < 0 || !date) redirect("/expenses/new?error=Confira%20os%20campos%20obrigat%C3%B3rios.");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const household = await ensureHousehold(supabase, data.user.id);
  const petId = value(formData, "pet_id") || null;
  const { error } = await supabase.from("expenses").insert({
    household_id: household.id, pet_id: petId, category: categoryValue, description, amount_cents: amountCents,
    occurred_at: `${date}T12:00:00-03:00`, shared: formData.get("shared") === "on", notes: value(formData, "notes") || null,
  });
  if (error) redirect(`/expenses/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/expenses");
  revalidatePath("/");
  redirect("/expenses?saved=1");
}

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const household = await ensureHousehold(supabase, data.user.id);
  return { supabase, household };
}

export async function updateExpense(expenseId: string, formData: FormData) {
  const description = value(formData, "description");
  const categoryValue = value(formData, "category") as ExpenseCategory;
  const amountCents = moneyToCents(value(formData, "amount"));
  const date = value(formData, "occurred_on");
  if (!description || !categories.has(categoryValue) || !Number.isFinite(amountCents) || amountCents < 0 || !date) redirect(`/expenses/${expenseId}/edit?error=Confira%20os%20campos%20obrigat%C3%B3rios.`);

  const { supabase, household } = await authContext();
  const petId = value(formData, "pet_id") || null;
  const { error } = await supabase.from("expenses").update({
    pet_id: petId,
    category: categoryValue,
    description,
    amount_cents: amountCents,
    occurred_at: `${date}T12:00:00-03:00`,
    shared: formData.get("shared") === "on",
    notes: value(formData, "notes") || null,
  }).eq("id", expenseId).eq("household_id", household.id);
  if (error) redirect(`/expenses/${expenseId}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/shopping");
  redirect("/expenses?updated=1");
}

export async function deleteExpense(expenseId: string) {
  const { supabase, household } = await authContext();
  await supabase.from("purchases").update({ expense_id: null }).eq("expense_id", expenseId).eq("household_id", household.id);
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId).eq("household_id", household.id);
  if (error) redirect(`/expenses?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/expenses");
  revalidatePath("/");
  revalidatePath("/shopping");
  redirect("/expenses?deleted=1");
}
