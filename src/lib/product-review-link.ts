/**
 * Review → Purchase write contract (0038).
 *
 * - Purchase-originated Reviews always persist purchase_id explicitly.
 * - Standalone Product Reviews keep purchase_id NULL.
 * - At most one Review per (purchase_id, product_id) — enforced by the partial unique index;
 *   a second create resolves to the existing Review instead of duplicating.
 * - Household / Product membership is enforced by the product_reviews_assert_purchase_context
 *   trigger (SQLSTATE 23514); the app surfaces it as a recoverable message, never bypasses it.
 */

import type { ProductReview } from "@/types/database";

export const REVIEW_PURCHASE_CONTEXT_MESSAGE =
  "Esta avaliação não corresponde a um produto desta compra. Volte às compras e tente avaliar pelo item certo.";

export type ProductReviewInsert = {
  id?: string;
  household_id: string;
  product_id: string;
  purchase_id: string | null;
  pet_id: string | null;
  quality_score: number;
  acceptance_score: number;
  cost_benefit_score: number;
  would_buy_again: boolean;
  notes: string | null;
  reviewed_at: string;
};

export function buildProductReviewInsert(args: {
  id?: string;
  householdId: string;
  productId: string;
  purchaseId: string | null;
  petId: string | null;
  scores: readonly number[];
  wouldBuyAgain: boolean;
  notes: string | null;
  reviewedAt: string;
}): ProductReviewInsert {
  return {
    ...(args.id ? { id: args.id } : {}),
    household_id: args.householdId,
    product_id: args.productId,
    purchase_id: args.purchaseId,
    pet_id: args.petId,
    quality_score: args.scores[0],
    acceptance_score: args.scores[1],
    cost_benefit_score: args.scores[2],
    would_buy_again: args.wouldBuyAgain,
    notes: args.notes,
    reviewed_at: args.reviewedAt,
  };
}

export type PurchaseReviewCreatePlan =
  | { action: "create" }
  | { action: "edit_existing"; reviewId: string };

/** Existing Review for the same Purchase + Product wins: route to its exact edit, never insert again. */
export function planPurchaseReviewCreate(existing: { id: string } | null | undefined): PurchaseReviewCreatePlan {
  return existing?.id ? { action: "edit_existing", reviewId: existing.id } : { action: "create" };
}

export function isPurchaseContextViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23514";
}

export function existingReviewEditPath(reviewId: string): string {
  return `/shopping/reviews/${reviewId}/edit?existing=1`;
}

/** Truly the latest Review of a Product (reviewed_at, then created_at) — backs "Editar última avaliação". */
export function latestProductReview<T extends Pick<ProductReview, "product_id" | "reviewed_at" | "created_at">>(
  productId: string,
  reviews: T[],
): T | null {
  return (
    reviews
      .filter((review) => review.product_id === productId)
      .sort((a, b) => Date.parse(b.reviewed_at) - Date.parse(a.reviewed_at) || Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null
  );
}
