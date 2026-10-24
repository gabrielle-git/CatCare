import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  countPetsWithActivePlan,
  groupHealthPlansByPet,
  resolveHealthPlanCreateOwnership,
} from "@/lib/health-plan";
import { mapPetlovePlanPositions, resolvePetlovePlanPosition, type ExistingHealthPlanRef } from "@/lib/health-plan-templates";

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
  });

  it("counts distinct active pets for Petlove discount, not duplicate plans", () => {
    const plans = [
      plan({ pet_id: pet1, pet_name: "A", started_at: "2026-01-01" }),
      plan({ pet_id: pet1, pet_name: "A", started_at: "2026-02-01", plan_name: "Leve" }),
      plan({ pet_id: pet2, pet_name: "B", started_at: "2026-03-01" }),
    ];
    const created = resolvePetlovePlanPosition(plans, "petlove", "Petlove Leve", pet2, "edit");
    assert.equal(created.position, 2);
    const positions = mapPetlovePlanPositions(plans);
    assert.equal(positions.get(pet1)?.position, 1);
    assert.equal(positions.get(pet2)?.position, 2);
    assert.equal(positions.get(pet2)?.discountPercent, 10);
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
  });
});
