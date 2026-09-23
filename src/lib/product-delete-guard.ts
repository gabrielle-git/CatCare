/**
 * Application-level Product delete guard until header FK transition (0039+).
 * DB CASCADE on purchases.product_id / product_reviews.product_id remains unchanged.
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
