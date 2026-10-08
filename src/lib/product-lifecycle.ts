import type { Product, ProductReview } from "@/types/database";
import type { PurchaseReadModel } from "@/lib/purchase-read-model";

/**
 * Product lifecycle (0038): archived_at NULL = active, non-NULL = archived.
 *
 * Active-only surfaces: Shopping catalog, new-Purchase picker, recommendations, Assistant.
 * History surfaces (Purchase lines, Purchase/Review edit, Product edit, export) must keep
 * resolving archived Products — never filter the full Product map.
 */

export const PRODUCT_ARCHIVED_FOR_PURCHASE_MESSAGE =
  "Este produto está arquivado. Restaure-o na edição do produto para usá-lo em novas compras, ou escolha outro produto.";

export const PRODUCT_NOT_FOUND_MESSAGE = "Produto não encontrado.";

export function isProductArchived(product: Pick<Product, "archived_at">): boolean {
  return product.archived_at != null;
}

export function isProductActive(product: Pick<Product, "archived_at">): boolean {
  return product.archived_at == null;
}

export function splitProductsByLifecycle<T extends Pick<Product, "archived_at">>(products: T[]): { active: T[]; archived: T[] } {
  const active: T[] = [];
  const archived: T[] = [];
  for (const product of products) (isProductActive(product) ? active : archived).push(product);
  return { active, archived };
}

export function activeProducts<T extends Pick<Product, "archived_at">>(products: T[]): T[] {
  return products.filter(isProductActive);
}

export type ProductSelectionResult = { ok: true; product: Product } | { ok: false; error: string };

/** Server-side guard for NEW Purchases: the Product must exist in the household and be active. */
export function productSelectableForNewPurchase(product: Product | null, householdId: string): ProductSelectionResult {
  if (!product || product.household_id !== householdId) return { ok: false, error: PRODUCT_NOT_FOUND_MESSAGE };
  if (isProductArchived(product)) return { ok: false, error: PRODUCT_ARCHIVED_FOR_PURCHASE_MESSAGE };
  return { ok: true, product };
}

export type ProductLifecycleOptions = {
  canHardDelete: boolean;
  canArchive: boolean;
  canRestore: boolean;
};

/**
 * Hard delete only without history; history means archive instead of a dead end.
 * Archived Products can always be restored.
 */
export function productLifecycleOptions(state: { archived: boolean; hasHistory: boolean }): ProductLifecycleOptions {
  return {
    canHardDelete: !state.hasHistory,
    canArchive: !state.archived,
    canRestore: state.archived,
  };
}

/**
 * One household-scoped query: PostgREST embedded counts are computed in the database,
 * so every Product gets an authoritative history signal without loading history rows
 * and without a query per Product.
 */
export const PRODUCT_HISTORY_COUNT_SELECT = "id, purchases(count), purchase_items(count), product_reviews(count)";

type EmbeddedCount = { count: number }[] | null | undefined;

export type ProductHistoryCountRow = {
  id: string;
  purchases?: EmbeddedCount;
  purchase_items?: EmbeddedCount;
  product_reviews?: EmbeddedCount;
};

function embeddedCount(value: EmbeddedCount): number {
  return value?.[0]?.count ?? 0;
}

/** Products with ANY history in purchases.product_id, purchase_items.product_id or product_reviews.product_id. */
export function productIdsWithHistory(rows: ProductHistoryCountRow[]): string[] {
  return rows
    .filter((row) => embeddedCount(row.purchases) > 0 || embeddedCount(row.purchase_items) > 0 || embeddedCount(row.product_reviews) > 0)
    .map((row) => row.id);
}

/** Demo data is complete (not a capped window), so its history can be derived in memory. */
export function demoProductIdsWithHistory(
  products: Pick<Product, "id">[],
  purchases: Pick<PurchaseReadModel, "product_id" | "lines">[],
  reviews: Pick<ProductReview, "product_id">[],
): string[] {
  return products
    .filter((product) =>
      purchases.some((purchase) => purchase.product_id === product.id || purchase.lines.some((line) => line.product_id === product.id))
      || reviews.some((review) => review.product_id === product.id))
    .map((product) => product.id);
}
