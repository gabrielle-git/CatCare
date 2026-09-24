/**
 * Application-level Product delete guard until header FK transition (0039+).
 * DB CASCADE on purchases.product_id / product_reviews.product_id remains unchanged.
 *
 * Compatibility safety layer only — not a transactional DB guarantee. A concurrent
 * history insert between the guard reads and Product DELETE remains a residual race
 * until a future FK/transaction hardening step. This still materially reduces the
 * prior always-CASCADE exposure through the normal app UI.
 */

export const PRODUCT_DELETE_HISTORY_MESSAGE =
  "Este produto possui histórico de compras ou avaliações e não pode ser excluído sem apagar esse histórico.";

export type ProductHistoryRefs = {
  headerPurchaseCount: number;
  purchaseItemCount: number;
  reviewCount: number;
};

export function productHasCommerceHistory(refs: ProductHistoryRefs): boolean {
  return refs.headerPurchaseCount > 0 || refs.purchaseItemCount > 0 || refs.reviewCount > 0;
}
