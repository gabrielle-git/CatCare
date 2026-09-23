import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPetIdsByEntity, resolvePetIdsFromRow } from "@/lib/entity-pets";
import {
  buildPurchaseReadModels,
  type PurchaseItemRow,
  type PurchaseReadModel,
} from "@/lib/purchase-read-model";
import type { Expense, Product, ProductCategory, ProductReview, Purchase, Reminder } from "@/types/database";

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

async function loadPurchaseItemsForPurchases(
  supabase: SupabaseClient,
  householdId: string,
  purchaseIds: string[],
): Promise<PurchaseItemRow[]> {
  if (purchaseIds.length === 0) return [];
  const { data, error } = await supabase
    .from("purchase_items")
    .select(
      "id, household_id, purchase_id, product_id, position, product_name, brand, category, package_size, quantity, unit_price_cents, line_subtotal_cents, notes",
    )
    .eq("household_id", householdId)
    .in("purchase_id", purchaseIds)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    household_id: String(row.household_id),
    purchase_id: String(row.purchase_id),
    product_id: row.product_id == null ? null : String(row.product_id),
    position: Number(row.position),
    product_name: String(row.product_name),
    brand: row.brand == null ? null : String(row.brand),
    category: row.category as ProductCategory,
    package_size: row.package_size == null ? null : String(row.package_size),
    quantity: Number(row.quantity),
    unit_price_cents: Number(row.unit_price_cents),
    line_subtotal_cents: Number(row.line_subtotal_cents),
    notes: row.notes == null ? null : String(row.notes),
  }));
}

async function loadPurchaseItemPetsByItemId(
  supabase: SupabaseClient,
  householdId: string,
  itemIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (itemIds.length === 0) return map;
  const { data, error } = await supabase
    .from("purchase_item_pets")
    .select("purchase_item_id, pet_id")
    .eq("household_id", householdId)
    .in("purchase_item_id", itemIds);
  if (error) throw error;
  for (const row of data ?? []) {
    const itemId = String((row as { purchase_item_id: string }).purchase_item_id);
    const petId = String((row as { pet_id: string }).pet_id);
    const current = map.get(itemId) ?? [];
    current.push(petId);
    map.set(itemId, current);
  }
  return map;
}

async function toPurchaseReadModels(
  supabase: SupabaseClient,
  householdId: string,
  purchases: Purchase[],
  products: Product[],
): Promise<PurchaseReadModel[]> {
  const purchaseIds = purchases.map((row) => row.id);
  const items = await loadPurchaseItemsForPurchases(supabase, householdId, purchaseIds);
  const itemPets = await loadPurchaseItemPetsByItemId(
    supabase,
    householdId,
    items.map((item) => item.id),
  );
  const productsById = new Map(products.map((product) => [product.id, product]));
  // Ensure products referenced by header are present for legacy virtual lines even if not in catalog page set.
  const missingIds = purchases
    .map((purchase) => purchase.product_id)
    .filter((id) => id && !productsById.has(id));
  if (missingIds.length > 0) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("household_id", householdId)
      .in("id", [...new Set(missingIds)]);
    if (error) throw error;
    for (const row of (data ?? []) as Product[]) productsById.set(row.id, row);
  }
  return buildPurchaseReadModels(purchases, items, itemPets, productsById);
}

/** Demo / offline: interpret purchases with no persisted items (legacy virtual lines). */
export function interpretPurchasesOffline(purchases: Purchase[], products: Product[]): PurchaseReadModel[] {
  const productsById = new Map(products.map((product) => [product.id, product]));
  return buildPurchaseReadModels(purchases, [], new Map(), productsById);
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

export async function getPurchase(supabase: SupabaseClient, householdId: string, id: string): Promise<PurchaseReadModel | null> {
  const { data, error } = await supabase.from("purchases").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const withPets = (await attachPurchasePetIds(supabase, householdId, [data as Purchase]))[0];
  if (!withPets) return null;
  const models = await toPurchaseReadModels(supabase, householdId, [withPets], []);
  return models[0] ?? null;
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
  const productRows = (products.data ?? []) as Product[];
  const purchaseRows = (purchases.data ?? []) as Purchase[];
  const reviewRows = (reviews.data ?? []) as ProductReview[];
  const [purchasesWithPets, reviewsWithPets] = await Promise.all([
    attachPurchasePetIds(supabase, householdId, purchaseRows),
    attachReviewPetIds(supabase, householdId, reviewRows),
  ]);
  const purchaseModels = await toPurchaseReadModels(supabase, householdId, purchasesWithPets, productRows);
  return {
    products: productRows,
    purchases: purchaseModels,
    reviews: reviewsWithPets,
  };
}
