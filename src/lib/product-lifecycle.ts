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
 * History visible in the loaded Shopping window (purchase lines or reviews).
 * UI hint only — the server delete guard counts the full history.
 */
export function productHasLoadedHistory(productId: string, purchases: PurchaseReadModel[], reviews: ProductReview[]): boolean {
  return (
    purchases.some((purchase) => purchase.product_id === productId || purchase.lines.some((line) => line.product_id === productId))
    || reviews.some((review) => review.product_id === productId)
  );
}
