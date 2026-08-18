export const SCORE_LABELS: Record<number, string> = {
  1: "Péssimo",
  2: "Ruim",
  3: "Ok",
  4: "Bom",
  5: "Excelente",
};

export function scoreLabel(score: number) {
  return SCORE_LABELS[Math.round(score)] ?? `${score.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/5`;
}

export function overallReviewScore(quality: number, acceptance: number, value: number) {
  return (quality + acceptance + value) / 3;
}

/** Nota média ≥ 4, pelo menos uma avaliação e alguém marcou "compraria de novo". */
export function qualifiesForRepeat(reviewCount: number, quality: number, acceptance: number, value: number, buyAgainCount: number) {
  if (reviewCount === 0 || buyAgainCount === 0) return false;
  return overallReviewScore(quality, acceptance, value) >= 4;
}
