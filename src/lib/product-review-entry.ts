import type { PurchaseReadLine, PurchaseReadModel } from "@/lib/purchase-read-model";
import type { ProductReview } from "@/types/database";

/**
 * Product-level "Avaliar": which Purchase (if any) the new Review originates from.
 *
 * - Membership uses interpreted line truth (purchase_items when persisted, legacy header otherwise),
 *   never the header product_id of a persisted cart.
 * - A Purchase + Product pair that already has a linked Review (explicit purchase_id + product_id)
 *   is not eligible again. Dates never decide linkage.
 * - Zero eligible → standalone (purchase_id NULL); one → that Purchase; several → the user chooses.
 */

export const PRODUCT_ARCHIVED_REVIEW_MESSAGE =
  "Este produto está arquivado. Restaure-o para registrar uma nova avaliação; as avaliações antigas continuam editáveis.";

export type ProductReviewCandidate = { purchase: PurchaseReadModel; line: PurchaseReadLine };

export type ProductReviewOrigin =
  | { kind: "standalone" }
  | { kind: "single"; candidate: ProductReviewCandidate }
  | { kind: "choose"; candidates: ProductReviewCandidate[] };

export function productReviewCandidates(
  productId: string,
  purchases: PurchaseReadModel[],
  reviews: Pick<ProductReview, "purchase_id" | "product_id">[],
): ProductReviewCandidate[] {
  const reviewedPurchaseIds = new Set(
    reviews.filter((review) => review.product_id === productId && review.purchase_id).map((review) => review.purchase_id as string),
  );
  return purchases
    .flatMap((purchase) => {
      if (reviewedPurchaseIds.has(purchase.id)) return [];
      const line = purchase.lines.find((candidate) => candidate.product_id === productId);
      return line ? [{ purchase, line }] : [];
    })
    .sort((a, b) => Date.parse(b.purchase.purchased_at) - Date.parse(a.purchase.purchased_at) || a.purchase.id.localeCompare(b.purchase.id));
}

export function resolveProductReviewOrigin(
  productId: string,
  purchases: PurchaseReadModel[],
  reviews: Pick<ProductReview, "purchase_id" | "product_id">[],
): ProductReviewOrigin {
  const candidates = productReviewCandidates(productId, purchases, reviews);
  if (candidates.length === 0) return { kind: "standalone" };
  if (candidates.length === 1) return { kind: "single", candidate: candidates[0] };
  return { kind: "choose", candidates };
}

export function productReviewPath(productId: string): string {
  return `/shopping/reviews/new?product=${productId}`;
}

export function productStandaloneReviewPath(productId: string): string {
  return `/shopping/reviews/new?product=${productId}&origin=standalone`;
}

/** Converges on the Purchase-originated Review flow (same action, same duplicate guard). */
export function productPurchaseReviewPath(purchaseId: string, productId: string): string {
  return `/shopping/reviews/new?purchase=${purchaseId}&product=${productId}&from=product`;
}

export type ProductReviewEntryPoints = { create: string | null; editLatest: string | null };

/** Archived Products keep editing existing Reviews but do not advertise new ones. */
export function productReviewEntryPoints(state: {
  productId: string;
  archived: boolean;
  latestReviewId: string | null;
}): ProductReviewEntryPoints {
  return {
    create: state.archived ? null : productReviewPath(state.productId),
    editLatest: state.latestReviewId ? `/shopping/reviews/${state.latestReviewId}/edit` : null,
  };
}
