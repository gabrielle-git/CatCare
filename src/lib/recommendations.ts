import type { Product, ProductReview, PurchaseChannel } from "@/types/database";
import { qualifiesForRepeat } from "@/lib/score-labels";
import {
  latestSightingForProduct,
  type PurchaseReadModel,
} from "@/lib/purchase-read-model";

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
    const quality = average(productReviews.map((review) => review.quality_score));
    const acceptance = average(productReviews.map((review) => review.acceptance_score));
    const value = average(productReviews.map((review) => review.cost_benefit_score));
    const buyAgainCount = productReviews.filter((review) => review.would_buy_again).length;
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

export function bestFoodRecommendation(ranked: ProductRecommendation[]) {
  return ranked.find((item) => ["dry_food", "wet_food", "treat"].includes(item.product.category)) ?? null;
}

export function bestLitterRecommendation(ranked: ProductRecommendation[]) {
  return ranked.find((item) => item.product.category === "litter") ?? null;
}
