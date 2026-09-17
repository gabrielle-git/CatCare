import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { isUniqueViolation } from "@/lib/create-idempotency";
import { readStableRecordIdForPetType } from "@/lib/health-record-attachment-form";
import { resolveNeonatalRecordCreateOwnership } from "@/lib/neonatal-record-create";
import { resolveInitialWeightOwnership } from "@/lib/pet-create";

const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const PET_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PET_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const WEIGHT_A = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const WEIGHT_B = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const URINE_A = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const STOOL_A = "dddddddd-dddd-4ddd-8ddd-ddddddddddd2";
const TEMP_A = "dddddddd-dddd-4ddd-8ddd-ddddddddddd3";
const OBS_A = "dddddddd-dddd-4ddd-8ddd-ddddddddddd4";
const URINE_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

describe("wave-2a weight create ownership", () => {
  it("creates when missing and reuses same household+pet", () => {
    assert.deepEqual(resolveInitialWeightOwnership(WEIGHT_A, HOUSEHOLD_A, PET_A, null), {
      ok: true,
      status: "create",
    });
    assert.deepEqual(
      resolveInitialWeightOwnership(WEIGHT_A, HOUSEHOLD_A, PET_A, {
        id: WEIGHT_A,
        household_id: HOUSEHOLD_A,
        pet_id: PET_A,
      }),
      { ok: true, status: "reuse" },
    );
  });

  it("rejects foreign household and other pet without leaking context", () => {
    assert.deepEqual(
      resolveInitialWeightOwnership(WEIGHT_A, HOUSEHOLD_A, PET_A, {
        id: WEIGHT_A,
        household_id: HOUSEHOLD_B,
        pet_id: PET_A,
      }),
      { ok: false, reason: "foreign_household" },
    );
    assert.deepEqual(
      resolveInitialWeightOwnership(WEIGHT_A, HOUSEHOLD_A, PET_A, {
        id: WEIGHT_A,
        household_id: HOUSEHOLD_A,
        pet_id: PET_B,
      }),
      { ok: false, reason: "pet_mismatch" },
    );
    assert.deepEqual(resolveInitialWeightOwnership("bad", HOUSEHOLD_A, PET_A, null), {
      ok: false,
      reason: "invalid_id",
    });
  });

  it("10 retries with same ownership stay create then reuse", () => {
    let existing: { id: string; household_id: string; pet_id: string } | null = null;
    const outcomes: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const result = resolveInitialWeightOwnership(WEIGHT_A, HOUSEHOLD_A, PET_A, existing);
      assert.equal(result.ok, true);
      if (result.ok) {
        outcomes.push(result.status);
        if (result.status === "create") {
          existing = { id: WEIGHT_A, household_id: HOUSEHOLD_A, pet_id: PET_A };
        }
      }
    }
    assert.deepEqual(outcomes, [
      "create",
      "reuse",
      "reuse",
      "reuse",
      "reuse",
      "reuse",
      "reuse",
      "reuse",
      "reuse",
      "reuse",
    ]);
  });
});

describe("wave-2a neonatal create ownership", () => {
  it("creates/reuses per pet×type and rejects mismatches", () => {
    assert.deepEqual(
      resolveNeonatalRecordCreateOwnership(URINE_A, HOUSEHOLD_A, PET_A, "urine", null),
      { ok: true, status: "create" },
    );
    assert.deepEqual(
      resolveNeonatalRecordCreateOwnership(URINE_A, HOUSEHOLD_A, PET_A, "urine", {
        id: URINE_A,
        household_id: HOUSEHOLD_A,
        pet_id: PET_A,
        type: "urine",
      }),
      { ok: true, status: "reuse" },
    );
    assert.deepEqual(
      resolveNeonatalRecordCreateOwnership(URINE_A, HOUSEHOLD_A, PET_A, "urine", {
        id: URINE_A,
        household_id: HOUSEHOLD_B,
        pet_id: PET_A,
        type: "urine",
      }),
      { ok: false, reason: "foreign_household" },
    );
    assert.deepEqual(
      resolveNeonatalRecordCreateOwnership(URINE_A, HOUSEHOLD_A, PET_A, "urine", {
        id: URINE_A,
        household_id: HOUSEHOLD_A,
        pet_id: PET_B,
        type: "urine",
      }),
      { ok: false, reason: "pet_mismatch" },
    );
    assert.deepEqual(
      resolveNeonatalRecordCreateOwnership(URINE_A, HOUSEHOLD_A, PET_A, "urine", {
        id: URINE_A,
        household_id: HOUSEHOLD_A,
        pet_id: PET_A,
        type: "stool",
      }),
      { ok: false, reason: "type_mismatch" },
    );
  });

  it("urine/stool/temperature/observation keep independent retry semantics", () => {
    for (const [id, type] of [
      [URINE_A, "urine"],
      [STOOL_A, "stool"],
      [TEMP_A, "temperature"],
      [OBS_A, "observation"],
    ] as const) {
      const first = resolveNeonatalRecordCreateOwnership(id, HOUSEHOLD_A, PET_A, type, null);
      const second = resolveNeonatalRecordCreateOwnership(id, HOUSEHOLD_A, PET_A, type, {
        id,
        household_id: HOUSEHOLD_A,
        pet_id: PET_A,
        type,
      });
      assert.equal(first.ok && first.status, "create");
      assert.equal(second.ok && second.status, "reuse");
    }
  });
});

describe("wave-2a stable record_ids_json for weight + neonatal", () => {
  it("uses nested record_ids_json[petId][type] — weight and neonatal types are independent", () => {
    const form = new FormData();
    form.set(
      "record_ids_json",
      JSON.stringify({
        [PET_A]: {
          weight: WEIGHT_A,
          urine: URINE_A,
          stool: STOOL_A,
          temperature: TEMP_A,
          observation: OBS_A,
        },
        [PET_B]: {
          weight: WEIGHT_B,
          urine: URINE_B,
        },
      }),
    );
    const pets = [PET_A, PET_B];
    assert.equal(readStableRecordIdForPetType(form, PET_A, "weight", pets), WEIGHT_A);
    assert.equal(readStableRecordIdForPetType(form, PET_A, "urine", pets), URINE_A);
    assert.equal(readStableRecordIdForPetType(form, PET_A, "stool", pets), STOOL_A);
    assert.equal(readStableRecordIdForPetType(form, PET_A, "temperature", pets), TEMP_A);
    assert.equal(readStableRecordIdForPetType(form, PET_A, "observation", pets), OBS_A);
    assert.equal(readStableRecordIdForPetType(form, PET_B, "weight", pets), WEIGHT_B);
    assert.equal(readStableRecordIdForPetType(form, PET_B, "urine", pets), URINE_B);
    assert.notEqual(
      readStableRecordIdForPetType(form, PET_A, "urine", pets),
      readStableRecordIdForPetType(form, PET_A, "stool", pets),
    );
    assert.notEqual(
      readStableRecordIdForPetType(form, PET_A, "weight", pets),
      readStableRecordIdForPetType(form, PET_B, "weight", pets),
    );
  });

  it("partial success matrix: reuse saved facts, create only missing", () => {
    // Pet A weight + urine already exist; pet B weight missing; stool missing for A.
    const saved = new Map<string, { household_id: string; pet_id: string; type?: string }>([
      [WEIGHT_A, { household_id: HOUSEHOLD_A, pet_id: PET_A }],
      [URINE_A, { household_id: HOUSEHOLD_A, pet_id: PET_A, type: "urine" }],
    ]);

    const weightA = resolveInitialWeightOwnership(
      WEIGHT_A,
      HOUSEHOLD_A,
      PET_A,
      saved.has(WEIGHT_A)
        ? { id: WEIGHT_A, household_id: HOUSEHOLD_A, pet_id: PET_A }
        : null,
    );
    const weightB = resolveInitialWeightOwnership(WEIGHT_B, HOUSEHOLD_A, PET_B, null);
    const urineA = resolveNeonatalRecordCreateOwnership(
      URINE_A,
      HOUSEHOLD_A,
      PET_A,
      "urine",
      saved.has(URINE_A)
        ? { id: URINE_A, household_id: HOUSEHOLD_A, pet_id: PET_A, type: "urine" }
        : null,
    );
    const stoolA = resolveNeonatalRecordCreateOwnership(STOOL_A, HOUSEHOLD_A, PET_A, "stool", null);

    assert.equal(weightA.ok && weightA.status, "reuse");
    assert.equal(weightB.ok && weightB.status, "create");
    assert.equal(urineA.ok && urineA.status, "reuse");
    assert.equal(stoolA.ok && stoolA.status, "create");
  });

  it("23505 + legit ownership → reuse; mismatched → reject", () => {
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    const legit = resolveInitialWeightOwnership(WEIGHT_A, HOUSEHOLD_A, PET_A, {
      id: WEIGHT_A,
      household_id: HOUSEHOLD_A,
      pet_id: PET_A,
    });
    const foreign = resolveInitialWeightOwnership(WEIGHT_A, HOUSEHOLD_A, PET_A, {
      id: WEIGHT_A,
      household_id: HOUSEHOLD_B,
      pet_id: PET_A,
    });
    const typeMismatch = resolveNeonatalRecordCreateOwnership(URINE_A, HOUSEHOLD_A, PET_A, "urine", {
      id: URINE_A,
      household_id: HOUSEHOLD_A,
      pet_id: PET_A,
      type: "temperature",
    });
    assert.equal(legit.ok && legit.status, "reuse");
    assert.equal(foreign.ok, false);
    assert.equal(typeMismatch.ok, false);
  });
});

describe("wave-2a createRecord wiring (source contracts)", () => {
  const root = process.cwd();
  const actions = readFileSync(join(root, "src/app/(app)/records/new/actions.ts"), "utf8");
  const recordFields = readFileSync(join(root, "src/components/record-fields.tsx"), "utf8");
  const page = readFileSync(join(root, "src/app/(app)/records/new/page.tsx"), "utf8");
  const neonatalLib = readFileSync(join(root, "src/lib/neonatal-record-create.ts"), "utf8");
  const healthActionsSnippet = actions;

  it("weight insert uses stable id + ownership + 23505 relire", () => {
    assert.match(actions, /readStableRecordIdForPetType\(formData, pet\.id, "weight"/);
    assert.match(actions, /resolveInitialWeightOwnership/);
    assert.match(actions, /from\("weight_records"\)\.insert\(\{[\s\S]*?id: stableId/);
    assert.match(actions, /isUniqueViolation/);
    assert.match(actions, /current_weight_grams/);
  });

  it("neonatal inserts use stable id per pet×type with ownership", () => {
    assert.match(actions, /createNeonatalRecordIdempotent/);
    assert.match(actions, /resolveNeonatalRecordCreateOwnership/);
    assert.match(neonatalLib, /type_mismatch/);
    assert.match(actions, /formCareType: type/);
    assert.match(actions, /formCareType: "observation"/);
    assert.match(actions, /from\("neonatal_records"\)\.insert\(\{[\s\S]*?id: stableId/);
  });

  it("client keeps record_ids_json stable across retries; pending UX present", () => {
    assert.match(recordFields, /recordIdsByPetType/);
    assert.match(recordFields, /record_ids_json/);
    assert.match(recordFields, /prevPet\[type\] \?\? crypto\.randomUUID\(\)/);
    assert.doesNotMatch(recordFields, /setRecordIdsByPetType\(\{\}\)/);
    assert.match(recordFields, /pendingLabel="Salvando\.\.\."/);
    assert.match(page, /DirectUploadForm/);
    assert.match(page, /createRecord/);
  });

  it("health / attachments / exam / hygiene paths remain intact", () => {
    assert.match(healthActionsSnippet, /resolveHealthRecordCreateOwnership/);
    assert.match(healthActionsSnippet, /ensureHealthRecordAttachments/);
    assert.match(healthActionsSnippet, /add_health_record_attachments/);
    assert.match(healthActionsSnippet, /type === "hygiene"/);
    assert.match(healthActionsSnippet, /type === "vaccine"/);
    assert.match(healthActionsSnippet, /isAttachableQuickRecordType/);
  });

  it("does not touch feeding RPC, memory, pet photo, or invent 0036", () => {
    assert.match(actions, /create_feeding_sessions_batch/);
    assert.doesNotMatch(actions, /p_session_id/);
    assert.doesNotMatch(actions, /memory_media|createMemory|photo_path/);
    assert.doesNotMatch(actions + neonatalLib, /0036/);
  });
});

describe("wave-2a scope guards", () => {
  it("no migration 0036 file and wave-1 create helpers still present", () => {
    const root = process.cwd();
    let has0036 = false;
    try {
      readFileSync(join(root, "supabase/migrations/0036_feeding_idempotency.sql"));
      has0036 = true;
    } catch {
      has0036 = false;
    }
    assert.equal(has0036, false);

    const expense = readFileSync(join(root, "src/app/(app)/expenses/actions.ts"), "utf8");
    const purchase = readFileSync(join(root, "src/app/(app)/shopping/actions.ts"), "utf8");
    const reminder = readFileSync(join(root, "src/app/(app)/agenda/actions.ts"), "utf8");
    const routine = readFileSync(join(root, "src/app/(app)/routines/actions.ts"), "utf8");
    assert.match(expense, /resolveHouseholdCreateOwnership/);
    assert.match(purchase, /resolveHouseholdCreateOwnership/);
    assert.match(reminder, /resolveHouseholdCreateOwnership/);
    assert.match(routine, /resolveHouseholdCreateOwnership/);
  });
});
