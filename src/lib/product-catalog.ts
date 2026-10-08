import type { SupabaseClient } from "@supabase/supabase-js";
import {
  foreignIntentErrorMessage,
  invalidIntentErrorMessage,
  isUniqueViolation,
  resolveHouseholdCreateOwnership,
} from "@/lib/create-idempotency";
import type { Product, ProductCategory } from "@/types/database";

/**
 * Product = catalog item only (name, brand, category, package size, notes).
 * Transaction facts (date, store, price, payment, Expense) belong to Purchase, never here.
 */

export const PRODUCT_CATEGORIES: ReadonlySet<ProductCategory> = new Set<ProductCategory>([
  "dry_food",
  "wet_food",
  "litter",
  "treat",
  "hygiene",
  "medicine",
  "accessory",
  "other",
]);

export const NEW_PRODUCT_FIELDS_MESSAGE = "Dê um nome e uma categoria ao novo produto.";
export const PRODUCT_CREATED_MESSAGE = "Produto cadastrado. Agora você pode registrar uma compra ou avaliá-lo.";

export type ProductCatalogFields = {
  name: string;
  brand: string | null;
  category: ProductCategory;
  package_size: string | null;
  notes: string | null;
};

export type ProductCatalogFieldsResult = { ok: true; fields: ProductCatalogFields } | { ok: false; error: string };

/** Same field names and rules for Product-only create, inline create in a Purchase, and Product edit. */
export function parseProductCatalogFields(read: (name: string) => string): ProductCatalogFieldsResult {
  const name = read("product_name");
  const category = read("category") as ProductCategory;
  if (!name || !PRODUCT_CATEGORIES.has(category)) return { ok: false, error: NEW_PRODUCT_FIELDS_MESSAGE };
  return {
    ok: true,
    fields: {
      name,
      brand: read("brand") || null,
      category,
      package_size: read("package_size") || null,
      notes: read("product_notes") || null,
    },
  };
}

/** archived_at is omitted on purpose: the column default (NULL) makes every new Product active. */
export function buildProductCatalogInsert(id: string, householdId: string, fields: ProductCatalogFields) {
  return {
    id,
    household_id: householdId,
    name: fields.name,
    brand: fields.brand,
    category: fields.category,
    package_size: fields.package_size,
    notes: fields.notes,
  };
}

export type CatalogProductResult =
  | { ok: true; product: Product; status: "created" | "reused" }
  | { ok: false; error: string };

/**
 * Catalog-only write keyed by a client-stable Product id: a retry or double submit reuses the
 * same row. Touches `products` only — never Purchases, Expenses or Reviews.
 */
export async function createOrReuseCatalogProduct(
  supabase: SupabaseClient,
  householdId: string,
  productId: string,
  fields: ProductCatalogFields,
): Promise<CatalogProductResult> {
  const { data: existing } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
  const ownership = resolveHouseholdCreateOwnership(productId, householdId, existing);
  if (!ownership.ok) {
    return { ok: false, error: ownership.reason === "foreign_household" ? foreignIntentErrorMessage() : invalidIntentErrorMessage() };
  }
  if (ownership.status === "reuse") return { ok: true, product: existing as Product, status: "reused" };

  const result = await supabase
    .from("products")
    .insert(buildProductCatalogInsert(productId, householdId, fields))
    .select("*")
    .single();
  if (result.error) {
    if (isUniqueViolation(result.error)) {
      const { data: again } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
      const retry = resolveHouseholdCreateOwnership(productId, householdId, again);
      if (retry.ok && retry.status === "reuse") return { ok: true, product: again as Product, status: "reused" };
      return { ok: false, error: foreignIntentErrorMessage() };
    }
    return { ok: false, error: result.error.message };
  }
  return { ok: true, product: result.data as Product, status: "created" };
}

export function productCreatedRedirect(productId: string): string {
  return `/shopping?productCreated=${productId}`;
}
