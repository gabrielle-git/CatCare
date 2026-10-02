import type { Product, ProductReview, PurchaseChannel } from "@/types/database";
import { activeProducts } from "@/lib/product-lifecycle";
import { qualifiesForRepeat } from "@/lib/score-labels";
import {
  latestSightingForProduct,
  type PurchaseReadModel,
} from "@/lib/purchase-read-model";

/** Minimum average cost_benefit_score for "Melhor custo-benefício" (on top of repeat qualification). */
export const BEST_VALUE_MIN_SCORE = 4;

export type ProductRecommendationLatest = {
  purchase_id: string;
  purchased_at: string;
  store_name: string;
  channel: PurchaseChannel;
  quantity: number;
  unit_price_cents: number | null;
  line_subtotal_cents: number;
};

export type ProductRecommendation = {
  product: Product;
  latest: ProductRecommendationLatest | null;
  reviewCount: number;
  quality: number;
  acceptance: number;
  value: number;
  buyAgainRate: number;
  buyAgainCount: number;
  score: number;
  reason: string;
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export type ProductReviewSummary = {
  reviewCount: number;
  quality: number;
  acceptance: number;
  value: number;
  buyAgainCount: number;
};

/** Simple average across ALL current reviews of a Product — no recency weighting, no cache. */
export function summarizeProductReviews(reviews: ProductReview[]): ProductReviewSummary {
  return {
    reviewCount: reviews.length,
    quality: average(reviews.map((review) => review.quality_score)),
    acceptance: average(reviews.map((review) => review.acceptance_score)),
    value: average(reviews.map((review) => review.cost_benefit_score)),
    buyAgainCount: reviews.filter((review) => review.would_buy_again).length,
  };
}

export function summaryQualifiesForRepeat(summary: ProductReviewSummary): boolean {
  return qualifiesForRepeat(summary.reviewCount, summary.quality, summary.acceptance, summary.value, summary.buyAgainCount);
}

export function summaryQualifiesForBestValue(summary: ProductReviewSummary): boolean {
  return summaryQualifiesForRepeat(summary) && summary.value >= BEST_VALUE_MIN_SCORE;
}

function recommendationReason(quality: number, acceptance: number, value: number, buyAgainRate: number) {
  const strengths: string[] = [];
  if (acceptance >= 4) strengths.push("boa aceitação pelos pets");
  if (quality >= 4) strengths.push("qualidade bem avaliada");
  if (value >= 4) strengths.push("bom custo-benefício");
  if (buyAgainRate >= 0.75) strengths.push("alta intenção de recompra");
  return strengths.length ? strengths.slice(0, 2).join(" e ") : "é a opção com melhor equilíbrio entre as notas registradas";
}

export function rankProductRecommendations(
  products: Product[],
  purchases: PurchaseReadModel[],
  reviews: ProductReview[],
) {
  return products.map((product): ProductRecommendation | null => {
    const productReviews = reviews.filter((review) => review.product_id === product.id);
    if (productReviews.length === 0) return null;
    const { quality, acceptance, value, buyAgainCount } = summarizeProductReviews(productReviews);
    const buyAgainRate = buyAgainCount / productReviews.length;
    const acceptanceWeight = ["dry_food", "wet_food", "treat"].includes(product.category) ? 0.35 : 0.3;
    const qualityWeight = product.category === "litter" ? 0.35 : 0.3;
    const valueWeight = 0.9 - acceptanceWeight - qualityWeight;
    const score = (acceptance * acceptanceWeight) + (quality * qualityWeight) + (value * valueWeight) + (buyAgainRate * 0.5);
    const sighting = latestSightingForProduct(purchases, product.id);
    const latest: ProductRecommendationLatest | null = sighting
      ? {
          purchase_id: sighting.purchase.id,
          purchased_at: sighting.purchase.purchased_at,
          store_name: sighting.purchase.store_name,
          channel: sighting.purchase.channel,
          quantity: sighting.line.quantity,
          unit_price_cents: sighting.line.unit_price_cents,
          line_subtotal_cents: sighting.line.line_subtotal_cents,
        }
      : null;
    return { product, latest, reviewCount: productReviews.length, quality, acceptance, value, buyAgainRate, buyAgainCount, score, reason: recommendationReason(quality, acceptance, value, buyAgainRate) };
  }).filter((item): item is ProductRecommendation => item !== null).sort((a, b) => b.score - a.score);
}

export function worthRepeatingRecommendations(ranked: ProductRecommendation[]) {
  return ranked.filter((item) => qualifiesForRepeat(item.reviewCount, item.quality, item.acceptance, item.value, item.buyAgainCount));
}

/**
 * Single eligibility path for every recommendation surface (Shopping + Assistant):
 * active Product, ≥1 review, overall average ≥ 4, ≥1 would_buy_again. Sorted by score.
 */
export function qualifiedProductRecommendations(
  products: Product[],
  purchases: PurchaseReadModel[],
  reviews: ProductReview[],
): ProductRecommendation[] {
  return worthRepeatingRecommendations(rankProductRecommendations(activeProducts(products), purchases, reviews));
}

/** Highest cost-benefit among qualified recommendations with value ≥ 4. Null when nobody qualifies — no fallback winner. */
export function bestValueRecommendation(qualified: ProductRecommendation[]): ProductRecommendation | null {
  const eligible = qualified.filter((item) => summaryQualifiesForBestValue({
    reviewCount: item.reviewCount,
    quality: item.quality,
    acceptance: item.acceptance,
    value: item.value,
    buyAgainCount: item.buyAgainCount,
  }));
  return [...eligible].sort((a, b) => b.value - a.value || b.score - a.score)[0] ?? null;
}

export function bestFoodRecommendation(ranked: ProductRecommendation[]) {
  return ranked.find((item) => ["dry_food", "wet_food", "treat"].includes(item.product.category)) ?? null;
}

export function bestLitterRecommendation(ranked: ProductRecommendation[]) {
  return ranked.find((item) => item.product.category === "litter") ?? null;
}
