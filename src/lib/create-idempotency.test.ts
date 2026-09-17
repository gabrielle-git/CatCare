import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  foreignIntentErrorMessage,
  invalidIntentErrorMessage,
  isUniqueViolation,
  resolveHouseholdCreateOwnership,
} from "@/lib/create-idempotency";

const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const ENTITY_A = "33333333-3333-4333-8333-333333333333";

describe("resolveHouseholdCreateOwnership", () => {
  it("creates when missing, reuses same household, rejects foreign and invalid", () => {
    assert.deepEqual(resolveHouseholdCreateOwnership(ENTITY_A, HOUSEHOLD_A, null), { ok: true, status: "create" });
    assert.deepEqual(
      resolveHouseholdCreateOwnership(ENTITY_A, HOUSEHOLD_A, { id: ENTITY_A, household_id: HOUSEHOLD_A }),
      { ok: true, status: "reuse" },
    );
    assert.deepEqual(
      resolveHouseholdCreateOwnership(ENTITY_A, HOUSEHOLD_A, { id: ENTITY_A, household_id: HOUSEHOLD_B }),
      { ok: false, reason: "foreign_household" },
    );
    assert.deepEqual(resolveHouseholdCreateOwnership("not-a-uuid", HOUSEHOLD_A, null), {
      ok: false,
      reason: "invalid_id",
    });
  });

  it("same id submitted many times stays one create then reuse", () => {
    const first = resolveHouseholdCreateOwnership(ENTITY_A, HOUSEHOLD_A, null);
    const second = resolveHouseholdCreateOwnership(ENTITY_A, HOUSEHOLD_A, {
      id: ENTITY_A,
      household_id: HOUSEHOLD_A,
    });
    assert.equal(first.ok && first.status, "create");
    assert.equal(second.ok && second.status, "reuse");
  });
});

describe("isUniqueViolation + safe messages", () => {
  it("detects 23505 and does not leak foreign data in messages", () => {
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    assert.equal(isUniqueViolation({ message: "duplicate key value violates unique constraint" }), true);
    assert.equal(isUniqueViolation({ code: "42P01" }), false);
    assert.match(foreignIntentErrorMessage(), /intenção/i);
    assert.doesNotMatch(foreignIntentErrorMessage(), /household|HOUSEHOLD|uuid/i);
    assert.match(invalidIntentErrorMessage(), /Recarregue/i);
  });
});

describe("wave-1 create wiring (source contracts)", () => {
  const root = process.cwd();
  const expenseActions = readFileSync(join(root, "src/app/(app)/expenses/actions.ts"), "utf8");
  const expenseForm = readFileSync(join(root, "src/components/create-expense-form.tsx"), "utf8");
  const expensePage = readFileSync(join(root, "src/app/(app)/expenses/new/page.tsx"), "utf8");
  const purchaseActions = readFileSync(join(root, "src/app/(app)/shopping/actions.ts"), "utf8");
  const purchaseForm = readFileSync(join(root, "src/components/create-purchase-form.tsx"), "utf8");
  const purchasePage = readFileSync(join(root, "src/app/(app)/shopping/new/page.tsx"), "utf8");
  const reminderActions = readFileSync(join(root, "src/app/(app)/agenda/actions.ts"), "utf8");
  const reminderForm = readFileSync(join(root, "src/components/create-reminder-form.tsx"), "utf8");
  const reminderPage = readFileSync(join(root, "src/app/(app)/agenda/new/page.tsx"), "utf8");
  const routineActions = readFileSync(join(root, "src/app/(app)/routines/actions.ts"), "utf8");
  const routineForm = readFileSync(join(root, "src/components/create-routine-form.tsx"), "utf8");
  const routinePage = readFileSync(join(root, "src/app/(app)/routines/new/page.tsx"), "utf8");
  const petActions = readFileSync(join(root, "src/app/(app)/pets/actions.ts"), "utf8");
  const petCreate = readFileSync(join(root, "src/lib/pet-create.ts"), "utf8");

  it("expense: stable id + ownership + pending UX + structured result", () => {
    assert.match(expenseActions, /Promise<CreateExpenseResult>/);
    assert.match(expenseActions, /id: expenseId/);
    assert.match(expenseActions, /resolveHouseholdCreateOwnership/);
    assert.match(expenseActions, /isUniqueViolation/);
    assert.match(expenseForm, /useState\(\(\) => crypto\.randomUUID\(\)\)/);
    assert.match(expenseForm, /useTransition/);
    assert.match(expenseForm, /Salvando\.\.\./);
    assert.match(expenseForm, /event\.preventDefault\(\)/);
    assert.match(expenseForm, /formData\.set\("expense_id", expenseId\)/);
    assert.doesNotMatch(expenseForm, /setExpenseId/);
    assert.match(expensePage, /CreateExpenseForm/);
  });

  it("purchase: compound purchase_id + expense_id (+ product/review) stay idempotent", () => {
    assert.match(purchaseActions, /Promise<CreatePurchaseResult>/);
    assert.match(purchaseActions, /purchase_id/);
    assert.match(purchaseActions, /expense_id/);
    assert.match(purchaseActions, /new_product_id/);
    assert.match(purchaseActions, /review_id/);
    assert.match(purchaseActions, /resolveHouseholdCreateOwnership/);
    assert.match(purchaseActions, /isUniqueViolation/);
    assert.match(purchaseForm, /purchaseId/);
    assert.match(purchaseForm, /expenseId/);
    assert.match(purchaseForm, /newProductId/);
    assert.match(purchaseForm, /reviewId/);
    assert.equal((purchaseForm.match(/crypto\.randomUUID\(\)/g) ?? []).length, 4);
    assert.match(purchaseForm, /useTransition/);
    assert.match(purchaseForm, /Salvando\.\.\./);
    assert.match(purchasePage, /CreatePurchaseForm/);
  });

  it("reminder: manual create uses stable per-target ids; pending UX", () => {
    assert.match(reminderActions, /Promise<CreateReminderResult>/);
    assert.match(reminderActions, /reminder_ids_json/);
    assert.match(reminderActions, /resolveHouseholdCreateOwnership/);
    assert.match(reminderForm, /ensureReminderIds/);
    assert.match(reminderForm, /reminder_ids_json/);
    assert.match(reminderForm, /useTransition/);
    assert.match(reminderForm, /Salvando\.\.\./);
    assert.match(reminderPage, /CreateReminderForm/);
  });

  it("routine: stable routine_id + ownership + pending UX", () => {
    assert.match(routineActions, /Promise<CreateRoutineResult>/);
    assert.match(routineActions, /id: routineId/);
    assert.match(routineActions, /resolveHouseholdCreateOwnership/);
    assert.match(routineForm, /crypto\.randomUUID\(\)/);
    assert.match(routineForm, /routine_id/);
    assert.match(routineForm, /useTransition/);
    assert.match(routinePage, /CreateRoutineForm/);
  });

  it("pet create remains PR #34 pattern (regression)", () => {
    assert.match(petActions, /resolvePetCreateOwnership/);
    assert.match(petActions, /Promise<CreatePetResult>/);
    assert.match(petCreate, /resolveHouseholdCreateOwnership/);
    assert.match(petCreate, /export \{ isUniqueViolation \}/);
  });

  it("wave-1 does not invent migration 0036 or touch clinical attachment paths", () => {
    assert.doesNotMatch(expenseActions + purchaseActions + reminderActions + routineActions, /0036/);
    assert.doesNotMatch(purchaseActions, /health_record_attachments|memory_media/);
  });
});
