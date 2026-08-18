import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPetIdsByEntity, resolvePetIdsFromRow } from "@/lib/entity-pets";
import type { Expense, Product, ProductReview, Purchase, Reminder } from "@/types/database";

async function attachExpensePetIds(supabase: SupabaseClient, householdId: string, rows: Expense[]) {
  if (rows.length === 0) return rows;
  const map = await loadPetIdsByEntity(supabase, "expense_pets", householdId, rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, pet_ids: resolvePetIdsFromRow(map.get(row.id) ?? [], row.pet_id) }));
}

async function attachExpensePurchaseIds(supabase: SupabaseClient, householdId: string, rows: Expense[]) {
  if (rows.length === 0) return rows;
  const expenseIds = rows.map((row) => row.id);
  const { data, error } = await supabase.from("purchases").select("id, expense_id").eq("household_id", householdId).in("expense_id", expenseIds);
  if (error) throw error;
  const map = new Map((data ?? []).map((row) => [row.expense_id as string, row.id as string]));
  return rows.map((row) => ({ ...row, purchase_id: map.get(row.id) ?? null }));
}

async function attachExpenseLinks(supabase: SupabaseClient, householdId: string, rows: Expense[]) {
  const withPets = await attachExpensePetIds(supabase, householdId, rows);
  return attachExpensePurchaseIds(supabase, householdId, withPets);
}

async function attachPurchasePetIds(supabase: SupabaseClient, householdId: string, rows: Purchase[]) {
  if (rows.length === 0) return rows;
  const map = await loadPetIdsByEntity(supabase, "purchase_pets", householdId, rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, pet_ids: resolvePetIdsFromRow(map.get(row.id) ?? [], row.pet_id) }));
}

async function attachReviewPetIds(supabase: SupabaseClient, householdId: string, rows: ProductReview[]) {
  if (rows.length === 0) return rows;
  const map = await loadPetIdsByEntity(supabase, "review_pets", householdId, rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, pet_ids: resolvePetIdsFromRow(map.get(row.id) ?? [], row.pet_id) }));
}

export async function getExpense(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("expenses").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await attachExpenseLinks(supabase, householdId, [data as Expense]))[0] ?? null;
}

export async function getPurchaseByExpenseId(supabase: SupabaseClient, householdId: string, expenseId: string) {
  const { data, error } = await supabase.from("purchases").select("id").eq("household_id", householdId).eq("expense_id", expenseId).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function getPurchase(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("purchases").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await attachPurchasePetIds(supabase, householdId, [data as Purchase]))[0] ?? null;
}

export async function getProduct(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  return data as Product | null;
}

export async function getProductReview(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("product_reviews").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await attachReviewPetIds(supabase, householdId, [data as ProductReview]))[0] ?? null;
}

export async function getReminder(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("reminders").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  return data as Reminder | null;
}

export async function listExpenses(supabase: SupabaseClient, householdId: string, limit = 120): Promise<Expense[]> {
  const { data, error } = await supabase.from("expenses").select("*").eq("household_id", householdId).order("occurred_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return attachExpenseLinks(supabase, householdId, (data ?? []) as Expense[]);
}

export async function listCommerce(supabase: SupabaseClient, householdId: string) {
  const [products, purchases, reviews] = await Promise.all([
    supabase.from("products").select("*").eq("household_id", householdId).order("updated_at", { ascending: false }),
    supabase.from("purchases").select("*").eq("household_id", householdId).order("purchased_at", { ascending: false }).limit(120),
    supabase.from("product_reviews").select("*").eq("household_id", householdId).order("reviewed_at", { ascending: false }).limit(200),
  ]);
  if (products.error) throw products.error;
  if (purchases.error) throw purchases.error;
  if (reviews.error) throw reviews.error;
  const purchaseRows = (purchases.data ?? []) as Purchase[];
  const reviewRows = (reviews.data ?? []) as ProductReview[];
  const [purchasesWithPets, reviewsWithPets] = await Promise.all([
    attachPurchasePetIds(supabase, householdId, purchaseRows),
    attachReviewPetIds(supabase, householdId, reviewRows),
  ]);
  return {
    products: (products.data ?? []) as Product[],
    purchases: purchasesWithPets,
    reviews: reviewsWithPets,
  };
}
