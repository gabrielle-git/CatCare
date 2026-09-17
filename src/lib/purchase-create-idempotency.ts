import {
  resolveHouseholdCreateOwnership,
  type HouseholdCreateOwnershipResult,
} from "@/lib/create-idempotency";

export type CompoundPurchasePlan =
  | { ok: false; reason: "invalid_id" | "foreign_household"; reject: "purchase" | "expense" }
  | {
      ok: true;
      purchase: "create" | "reuse";
      expense: "create" | "reuse" | "skip";
      /** When purchase already exists, expense must not be inserted again. */
      allowNewExpense: boolean;
      /** Review may still be missing after a prior partial success. */
      ensureReviewIfScored: boolean;
    };

/**
 * Pure plan for compound purchase+expense intent.
 * Order of authority: purchase ownership first (foreign purchase never creates expense),
 * then expense ownership when purchase still needs to be created.
 */
export function planCompoundPurchaseCreate(
  purchaseId: string,
  expenseId: string,
  expectedHouseholdId: string,
  existingPurchase: { id: string; household_id: string; expense_id: string | null } | null,
  existingExpense: { id: string; household_id: string } | null,
): CompoundPurchasePlan {
  const purchaseOwnership = resolveHouseholdCreateOwnership(purchaseId, expectedHouseholdId, existingPurchase);
  if (!purchaseOwnership.ok) {
    return { ok: false, reason: purchaseOwnership.reason, reject: "purchase" };
  }

  if (purchaseOwnership.status === "reuse") {
    return {
      ok: true,
      purchase: "reuse",
      expense: "skip",
      allowNewExpense: false,
      ensureReviewIfScored: true,
    };
  }

  const expenseOwnership = resolveHouseholdCreateOwnership(expenseId, expectedHouseholdId, existingExpense);
  if (!expenseOwnership.ok) {
    return { ok: false, reason: expenseOwnership.reason, reject: "expense" };
  }

  return {
    ok: true,
    purchase: "create",
    expense: expenseOwnership.status,
    allowNewExpense: expenseOwnership.status === "create",
    ensureReviewIfScored: true,
  };
}

/**
 * Only compensate-delete an expense that THIS attempt inserted.
 * Never delete an expense that was reused from a prior partial success (or 23505 reuse).
 */
export function shouldCompensateDeleteExpense(expenseInsertedThisAttempt: boolean): boolean {
  return expenseInsertedThisAttempt;
}

export type { HouseholdCreateOwnershipResult };
