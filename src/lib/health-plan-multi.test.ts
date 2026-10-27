import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  countPetsWithActivePlan,
  groupHealthPlansByPet,
  healthPlanCreateSnapshotsMatch,
  resolveCopayCreateRetry,
  resolveCopayUpdate,
  resolveHealthPlanCreateOwnership,
  type HealthPlanCreateSnapshot,
} from "@/lib/health-plan";
import { mapPetlovePlanPositions, resolveMonthlyFeeField, resolvePetlovePlanPosition, type ExistingHealthPlanRef } from "@/lib/health-plan-templates";

const root = process.cwd();
const planA = "11111111-1111-4111-8111-111111111111";
const planB = "22222222-2222-4222-8222-222222222222";
const household = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const pet1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const pet2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function plan(partial: Partial<ExistingHealthPlanRef> & Pick<ExistingHealthPlanRef, "pet_id">): ExistingHealthPlanRef {
  return {
    provider: "petlove",
    plan_name: "Petlove Leve",
    active: true,
    started_at: "2026-01-01",
    ...partial,
  };
}

describe("multi-plan health application", () => {
  it("lists zero, one and many plans per pet, including inactive", () => {
    const plans = [
      { pet_id: pet1, active: true },
      { pet_id: pet1, active: false },
      { pet_id: pet2, active: true },
    ];
    const grouped = groupHealthPlansByPet(plans);
    assert.equal(grouped.get(pet1)?.length, 2);
    assert.equal(grouped.get(pet2)?.length, 1);
    assert.equal(groupHealthPlansByPet([]).size, 0);
    assert.equal(countPetsWithActivePlan(plans), 2);
    assert.equal(countPetsWithActivePlan([{ pet_id: pet1, active: false }]), 0);
  });

  it("reuses a stable id and rejects another household", () => {
    assert.deepEqual(resolveHealthPlanCreateOwnership(planA, household, pet1, null), { ok: true, status: "create" });
    assert.deepEqual(
      resolveHealthPlanCreateOwnership(planA, household, pet1, { id: planA, household_id: household, pet_id: pet1 }),
      { ok: true, status: "reuse" },
    );
    assert.equal(
      resolveHealthPlanCreateOwnership(planA, household, pet1, { id: planA, household_id: "other", pet_id: pet1 }).ok,
      false,
    );
    assert.equal(resolveHealthPlanCreateOwnership("not-a-uuid", household, pet1, null).ok, false);
    const secondPlan = resolveHealthPlanCreateOwnership(planB, household, pet2, null);
    assert.equal(secondPlan.ok && secondPlan.status, "create");
    assert.equal(
      resolveHealthPlanCreateOwnership(planA, household, pet2, { id: planA, household_id: household, pet_id: pet1 }).ok,
      false,
    );
  });

  it("a matching retry is a no-op and a divergent retry is a conflict", () => {
    const stored = snapshot();
    assert.equal(healthPlanCreateSnapshotsMatch(stored, snapshot()), true);
    assert.equal(healthPlanCreateSnapshotsMatch(stored, snapshot({ monthly_fee_cents: 100 })), false);
    assert.equal(healthPlanCreateSnapshotsMatch(stored, snapshot({ active: false, ended_at: "2026-10-01" })), false);
    assert.equal(healthPlanCreateSnapshotsMatch({ ...stored, ended_at: "2026-10-01", active: false }, snapshot()), false);
    assert.deepEqual(resolveCopayCreateRetry([copay("consulta")], [copay("consulta")]), { action: "noop" });
    assert.equal(resolveCopayCreateRetry([copay("consulta", 500)], [copay("consulta")]).action, "conflict");
    assert.equal(resolveCopayCreateRetry([copay("consulta"), copay("extra")], [copay("consulta")]).action, "conflict");
  });

  it("refuses a retry that would restore a copay removed after creation", () => {
    const created = [copay("consulta"), copay("vacina")];
    assert.equal(resolveCopayCreateRetry(created, created).action, "noop");
    const afterRemoval = [copay("consulta")];
    assert.equal(resolveCopayCreateRetry(afterRemoval, created).action, "conflict");
    assert.equal(resolveCopayCreateRetry([], created).action, "conflict");
  });

  it("counts distinct active pets for Petlove discount, not duplicate plans", () => {
    const plans = [
      plan({ id: planA, pet_id: pet1, pet_name: "A", started_at: "2026-01-01" }),
      plan({ id: "33333333-3333-4333-8333-333333333333", pet_id: pet1, pet_name: "A", started_at: "2026-02-01", plan_name: "Leve" }),
      plan({ id: planB, pet_id: pet2, pet_name: "B", started_at: "2026-03-01" }),
    ];
    const created = resolvePetlovePlanPosition(plans, "petlove", "Petlove Leve", pet2, "edit");
    assert.equal(created.position, 2);
    const positions = mapPetlovePlanPositions(plans);
    assert.equal(positions.get(planA)?.position, 1);
    assert.equal(positions.get(planB)?.position, 2);
    assert.equal(positions.get(planB)?.discountPercent, 10);
  });

  it("labels each Petlove product on its own, including two plans for one pet", () => {
    const leve = plan({ id: planA, pet_id: pet1, plan_name: "Petlove Leve" });
    const total = plan({ id: planB, pet_id: pet1, plan_name: "Petlove Total", started_at: "2026-05-01" });
    const secondPet = plan({ id: "33333333-3333-4333-8333-333333333333", pet_id: pet2, plan_name: "Petlove Leve", started_at: "2026-06-01" });
    const positions = mapPetlovePlanPositions([leve, total, secondPet]);
    assert.equal(positions.get(planA)?.position, 1);
    assert.equal(positions.get(planA)?.discountPercent, 0);
    assert.equal(positions.get(secondPet.id!)?.position, 2);
    assert.equal(positions.get(secondPet.id!)?.discountPercent, 10);
    assert.equal(positions.get(planB)?.position, 1);
    assert.equal(positions.get(planB)?.discountPercent, 0);

    const duplicate = plan({ id: "44444444-4444-4444-8444-444444444444", pet_id: pet1, started_at: "2026-08-01" });
    const sameProduct = mapPetlovePlanPositions([leve, duplicate]);
    assert.equal(sameProduct.get(planA)?.position, 1);
    assert.equal(sameProduct.get(duplicate.id!)?.position, 1);

    const inactive = plan({ id: planA, pet_id: pet1, active: false });
    assert.equal(mapPetlovePlanPositions([inactive]).has(planA), false);
  });

  it("a plan edit without copay fields preserves rules, and an explicit editor can clear them", () => {
    const stored = { service_type: "exam", copay_cents: 1200, notes: "legado exame", coverage_status: "covered", coverage_notes: null, sort_order: 0 };
    const absent = resolveCopayUpdate({ submitted: false, rules: [{ skip: true }] });
    assert.deepEqual(absent, { action: "preserve" });
    assert.equal("rules" in absent, false);

    const invalid = resolveCopayUpdate({ submitted: true, rules: [null] });
    assert.deepEqual(invalid, { action: "invalid" });

    const cleared = resolveCopayUpdate({ submitted: true, rules: [{ skip: true }] });
    assert.deepEqual(cleared, { action: "replace", rules: [] });

    const kept = resolveCopayUpdate({ submitted: true, rules: [stored, { skip: true }] });
    assert.deepEqual(kept, { action: "replace", rules: [stored] });

    const source = readFileSync(join(root, "src/app/(app)/health-plan/actions.ts"), "utf8");
    const update = source.slice(source.indexOf("export async function updateHealthPlan"), source.indexOf("export async function endHealthPlan"));
    assert.match(update, /copay_rules_submitted/);
    assert.match(update, /copayDecision\.action === "replace"/);
    assert.match(update, /not one transaction/);
    const editor = readFileSync(join(root, "src/components/health-plan-copay.tsx"), "utf8");
    assert.match(editor, /name="copay_rules_submitted"/);
  });

  it("shows the Petlove table suggestion in the fee field before the person types", () => {
    const third = resolveMonthlyFeeField({ mode: "create", provider: "petlove", position: 3, touched: false, manualFee: "17.90" });
    assert.equal(third, "14.32");
    const second = resolveMonthlyFeeField({ mode: "create", provider: "petlove", position: 2, touched: false, manualFee: "17.90" });
    assert.equal(second, "16.11");
    const first = resolveMonthlyFeeField({ mode: "create", provider: "petlove", position: 1, touched: false, manualFee: "17.90" });
    assert.equal(first, "17.90");
    assert.equal(
      resolveMonthlyFeeField({ mode: "create", provider: "petlove", position: 3, touched: true, manualFee: "20.00" }),
      "20.00",
    );
    assert.equal(
      resolveMonthlyFeeField({ mode: "edit", provider: "petlove", position: 3, touched: false, manualFee: "17.90" }),
      "17.90",
    );
    assert.equal(
      resolveMonthlyFeeField({ mode: "create", provider: "other", position: 3, touched: false, manualFee: "25.00" }),
      "25.00",
    );
  });

  it("an inactive plan does not inflate the Petlove pet count", () => {
    const plans = [
      plan({ pet_id: pet1, active: false }),
      plan({ pet_id: pet2, active: true, started_at: "2026-04-01" }),
    ];
    const position = resolvePetlovePlanPosition(plans, "petlove", "Petlove Leve", pet2, "edit");
    assert.equal(position.position, 1);
    assert.equal(position.others.length, 0);
  });

  it("actions keep end and delete apart and replace copays without deleting first", () => {
    const source = readFileSync(join(root, "src/app/(app)/health-plan/actions.ts"), "utf8");
    assert.match(source, /export async function endHealthPlan/);
    assert.match(source, /active: false/);
    assert.match(source, /confirm_incorrect/);
    assert.doesNotMatch(source, /Este pet já tem plano/);
    assert.doesNotMatch(source, /syncTemplateCoverageToPlans/);
    const replaceStart = source.indexOf("async function replaceCopayRules");
    const replaceEnd = source.indexOf("function parsePromoFields", replaceStart);
    const replace = source.slice(replaceStart, replaceEnd);
    assert.ok(replace.indexOf(".upsert(") < replace.indexOf(".delete()"));
    const endStart = source.indexOf("export async function endHealthPlan");
    const endEnd = source.indexOf("export async function deleteHealthPlan");
    assert.doesNotMatch(source.slice(endStart, endEnd), /health_plan_copay_rules/);
    const create = source.slice(source.indexOf("export async function createHealthPlan"), source.indexOf("export async function updateHealthPlan"));
    assert.doesNotMatch(create, /\.from\("health_plans"\)\s*\.update\(/);
    assert.doesNotMatch(create, /insert-missing/);
    assert.match(create, /ended_at: null/);
    const update = source.slice(source.indexOf("export async function updateHealthPlan"), endStart);
    assert.match(update, /Reabrir um plano encerrado ainda não está definido/);
    assert.doesNotMatch(update, /ended_at:/);
  });
});

function snapshot(partial: Partial<HealthPlanCreateSnapshot> = {}): HealthPlanCreateSnapshot {
  return {
    provider: "petlove",
    plan_name: "Petlove Leve",
    monthly_fee_cents: 5000,
    started_at: "2026-01-01",
    active: true,
    ended_at: null,
    notes: null,
    coverage_summary: null,
    promo_coupon_code: null,
    zero_waiting_consultation: false,
    zero_waiting_vaccine: false,
    promo_notes: null,
    ...partial,
  };
}

function copay(service_type: string, copay_cents: number | null = null) {
  return { service_type, copay_cents, notes: null, coverage_status: null, coverage_notes: null };
}
