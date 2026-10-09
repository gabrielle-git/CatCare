import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { resolveHouseholdCreateOwnership } from "@/lib/create-idempotency";
import {
  planCompoundPurchaseCreate,
  planPurchaseInsertCollision,
  shouldCompensateDeleteExpense,
} from "@/lib/purchase-create-idempotency";

const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const PURCHASE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXPENSE_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("compound purchase+expense partial plans", () => {
  it("A: expense exists, purchase missing → reuse expense, create purchase, no new expense", () => {
    const plan = planCompoundPurchaseCreate(
      PURCHASE_A,
      EXPENSE_A,
      HOUSEHOLD_A,
      null,
      { id: EXPENSE_A, household_id: HOUSEHOLD_A },
    );
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.purchase, "create");
    assert.equal(plan.expense, "reuse");
    assert.equal(plan.allowNewExpense, false);
    assert.equal(plan.ensureReviewIfScored, true);
  });

  it("B: purchase already exists → reuse purchase, never create another expense", () => {
    const plan = planCompoundPurchaseCreate(
      PURCHASE_A,
      EXPENSE_A,
      HOUSEHOLD_A,
      { id: PURCHASE_A, household_id: HOUSEHOLD_A, expense_id: EXPENSE_A },
      { id: EXPENSE_A, household_id: HOUSEHOLD_A },
    );
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.purchase, "reuse");
    assert.equal(plan.expense, "skip");
    assert.equal(plan.allowNewExpense, false);
    assert.equal(plan.ensureReviewIfScored, true);
  });

  it("C: neither exists → create expense then purchase", () => {
    const plan = planCompoundPurchaseCreate(PURCHASE_A, EXPENSE_A, HOUSEHOLD_A, null, null);
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.purchase, "create");
    assert.equal(plan.expense, "create");
    assert.equal(plan.allowNewExpense, true);
  });

  it("D: expense_id foreign → reject expense, do not allow purchase create path", () => {
    const plan = planCompoundPurchaseCreate(
      PURCHASE_A,
      EXPENSE_A,
      HOUSEHOLD_A,
      null,
      { id: EXPENSE_A, household_id: HOUSEHOLD_B },
    );
    assert.deepEqual(plan, { ok: false, reason: "foreign_household", reject: "expense" });
  });

  it("E: purchase_id foreign → reject purchase before expense work", () => {
    const plan = planCompoundPurchaseCreate(
      PURCHASE_A,
      EXPENSE_A,
      HOUSEHOLD_A,
      { id: PURCHASE_A, household_id: HOUSEHOLD_B, expense_id: EXPENSE_A },
      null,
    );
    assert.deepEqual(plan, { ok: false, reason: "foreign_household", reject: "purchase" });
  });

  it("compensation delete only when THIS attempt inserted the expense", () => {
    assert.equal(shouldCompensateDeleteExpense(true), true);
    assert.equal(shouldCompensateDeleteExpense(false), false);
  });

  it("same intention after expense-created/purchase-failed still ends as 1+1 plan", () => {
    const afterPartial = planCompoundPurchaseCreate(
      PURCHASE_A,
      EXPENSE_A,
      HOUSEHOLD_A,
      null,
      { id: EXPENSE_A, household_id: HOUSEHOLD_A },
    );
    assert.equal(afterPartial.ok && afterPartial.expense, "reuse");
    assert.equal(afterPartial.ok && afterPartial.purchase, "create");
    assert.equal(afterPartial.ok && afterPartial.allowNewExpense, false);

    const afterComplete = planCompoundPurchaseCreate(
      PURCHASE_A,
      EXPENSE_A,
      HOUSEHOLD_A,
      { id: PURCHASE_A, household_id: HOUSEHOLD_A, expense_id: EXPENSE_A },
      { id: EXPENSE_A, household_id: HOUSEHOLD_A },
    );
    assert.equal(afterComplete.ok && afterComplete.purchase, "reuse");
    assert.equal(afterComplete.ok && afterComplete.allowNewExpense, false);
  });
});

describe("purchase insert collision (23505 on purchase_id)", () => {
  // Under RLS a foreign Purchase is invisible: the re-read after 23505 returns null.
  const hiddenForeign = resolveHouseholdCreateOwnership(PURCHASE_A, HOUSEHOLD_A, null);

  it("A: foreign purchase_id after this attempt inserted the Expense → reject and compensate", () => {
    assert.deepEqual(planPurchaseInsertCollision(hiddenForeign, true), { action: "reject_foreign", compensateExpense: true });
    const visibleForeign = resolveHouseholdCreateOwnership(PURCHASE_A, HOUSEHOLD_A, { id: PURCHASE_A, household_id: HOUSEHOLD_B });
    assert.deepEqual(planPurchaseInsertCollision(visibleForeign, true), { action: "reject_foreign", compensateExpense: true });
  });

  it("B: foreign purchase_id with a reused/pre-existing Expense → reject, never delete it", () => {
    assert.deepEqual(planPurchaseInsertCollision(hiddenForeign, false), { action: "reject_foreign", compensateExpense: false });
  });

  it("C/D: own Purchase already stored (retry / multiclick) → reuse, no compensation", () => {
    const own = resolveHouseholdCreateOwnership(PURCHASE_A, HOUSEHOLD_A, { id: PURCHASE_A, household_id: HOUSEHOLD_A });
    assert.deepEqual(planPurchaseInsertCollision(own, false), { action: "reuse" });
    assert.deepEqual(planPurchaseInsertCollision(own, true), { action: "reuse" });
  });
});

describe("compound purchase wiring (source contracts)", () => {
  const root = process.cwd();
  const actions = readFileSync(join(root, "src/app/(app)/shopping/actions.ts"), "utf8");

  it("uses plan helper and only deletes expense inserted this attempt", () => {
    assert.match(actions, /planCompoundPurchaseCreate/);
    assert.match(actions, /shouldCompensateDeleteExpense/);
    assert.match(actions, /expenseInsertedThisAttempt/);
    assert.doesNotMatch(actions, /if \(expenseOwnership\.status === "create"\) \{\s*await supabase\.from\("expenses"\)\.delete/);
  });

  it("purchase reuse still ensures review when scores are complete (partial review recovery)", () => {
    assert.match(actions, /ensurePurchaseReview/);
    assert.match(actions, /purchasePlan\.purchase === "reuse"/);
    assert.match(actions, /hasAllScores && purchasePlan\.ensureReviewIfScored/);
  });

  it("rejects foreign purchase/expense via compound plan before inserts", () => {
    assert.match(actions, /planCompoundPurchaseCreate/);
    assert.match(actions, /if \(!purchasePlan\.ok\)/);
    assert.match(actions, /foreignIntentErrorMessage/);
  });

  it("purchase 23505 foreign branch compensates the household-scoped Expense before failing", () => {
    const start = actions.indexOf("if (isUniqueViolation(purchaseError))");
    const branch = actions.slice(start, actions.indexOf("return { ok: false, error: purchaseError.message }", start));
    assert.match(branch, /planPurchaseInsertCollision\(retry, expenseInsertedThisAttempt\)/);
    assert.match(
      branch,
      /if \(collision\.compensateExpense\) \{\s*await supabase\.from\("expenses"\)\.delete\(\)\.eq\("id", expenseId\)\.eq\("household_id", household\.id\);\s*\}\s*return \{ ok: false, error: foreignIntentErrorMessage\(\) \};/,
    );
  });
});
