import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  hygieneStableRecordKey,
  mergeCreateStableRecordIds,
} from "./hygiene-care";
import {
  resolveHygieneCreateStableId,
  resolveHygieneRecordCreateOwnership,
} from "./hygiene-record-create";
import { isUniqueViolation } from "./create-idempotency";

const root = process.cwd();
const createActions = readFileSync(join(root, "src/app/(app)/records/new/actions.ts"), "utf8");
const recordFields = readFileSync(join(root, "src/components/record-fields.tsx"), "utf8");
const ensureAttachments = createActions.slice(
  createActions.indexOf("async function ensureHealthRecordAttachments"),
  createActions.indexOf("export async function createRecord"),
);

const HOUSEHOLD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_HOUSEHOLD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PET_A = "11111111-1111-4111-8111-111111111111";
const PET_B = "22222222-2222-4222-8222-222222222222";
const ID_BATH = "33333333-3333-4333-8333-333333333333";
const ID_NAILS = "44444444-4444-4444-8444-444444444444";
const ID_OTHER = "55555555-5555-4555-8555-555555555555";
const ID_LEGACY = "66666666-6666-4666-8666-666666666666";
const ID_WEIGHT = "77777777-7777-4777-8777-777777777777";

function formWithRecordIds(map: Record<string, Record<string, string>>) {
  const form = new FormData();
  form.set("record_ids_json", JSON.stringify(map));
  return form;
}

describe("hygieneStableRecordKey", () => {
  it("builds deterministic flat keys for catalog subtypes", () => {
    assert.equal(hygieneStableRecordKey("bath"), "hygiene:bath");
    assert.equal(hygieneStableRecordKey("nail_trim"), "hygiene:nail_trim");
    assert.equal(hygieneStableRecordKey("other"), "hygiene:other");
    assert.equal(hygieneStableRecordKey("dental_hygiene"), "hygiene:dental_hygiene");
  });

  it("rejects invalid / unsanitized subtypes", () => {
    assert.equal(hygieneStableRecordKey("bath;drop"), null);
    assert.equal(hygieneStableRecordKey("HYGIENE:bath"), null);
    assert.equal(hygieneStableRecordKey(""), null);
    assert.equal(hygieneStableRecordKey(null), null);
    assert.equal(hygieneStableRecordKey("other:Banho terapêutico"), null);
  });
});

describe("mergeCreateStableRecordIds — pet × subtype minting", () => {
  it("mints independent IDs for every pet × subtype combination", () => {
    let n = 0;
    const mintId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    const once = mergeCreateStableRecordIds({}, {
      petIds: [PET_A, PET_B],
      activeTypes: ["hygiene"],
      hygieneSubtypes: ["bath", "nail_trim"],
      mintId,
    });
    assert.ok(once[PET_A]["hygiene:bath"]);
    assert.ok(once[PET_A]["hygiene:nail_trim"]);
    assert.ok(once[PET_B]["hygiene:bath"]);
    assert.ok(once[PET_B]["hygiene:nail_trim"]);
    assert.notEqual(once[PET_A]["hygiene:bath"], once[PET_A]["hygiene:nail_trim"]);
    assert.notEqual(once[PET_A]["hygiene:bath"], once[PET_B]["hygiene:bath"]);
    assert.ok(once[PET_A].hygiene);
  });

  it("1 pet × 1 subtype and multi-subtype keep distinct keys", () => {
    let n = 0;
    const mintId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    const one = mergeCreateStableRecordIds({}, {
      petIds: [PET_A],
      activeTypes: ["hygiene"],
      hygieneSubtypes: ["bath"],
      mintId,
    });
    assert.ok(one[PET_A]["hygiene:bath"]);
    const multi = mergeCreateStableRecordIds(one, {
      petIds: [PET_A],
      activeTypes: ["hygiene"],
      hygieneSubtypes: ["bath", "nail_trim"],
      mintId,
    });
    assert.equal(multi[PET_A]["hygiene:bath"], one[PET_A]["hygiene:bath"]);
    assert.ok(multi[PET_A]["hygiene:nail_trim"]);
  });

  it("deselect/reselect subtype and pet reuse the same IDs (10 merges)", () => {
    let n = 0;
    const mintId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    let state = mergeCreateStableRecordIds({}, {
      petIds: [PET_A, PET_B],
      activeTypes: ["hygiene"],
      hygieneSubtypes: ["bath", "nail_trim"],
      mintId,
    });
    const bathA = state[PET_A]["hygiene:bath"];
    const nailsA = state[PET_A]["hygiene:nail_trim"];
    const bathB = state[PET_B]["hygiene:bath"];
    // Deselect nails + pet B
    state = mergeCreateStableRecordIds(state, {
      petIds: [PET_A],
      activeTypes: ["hygiene"],
      hygieneSubtypes: ["bath"],
      mintId,
    });
    assert.equal(state[PET_A]["hygiene:bath"], bathA);
    assert.equal(state[PET_A]["hygiene:nail_trim"], nailsA);
    assert.equal(state[PET_B]["hygiene:bath"], bathB);
    // Reselect all — 10 intentional merges like retry/multiclick
    for (let i = 0; i < 10; i += 1) {
      state = mergeCreateStableRecordIds(state, {
        petIds: [PET_A, PET_B],
        activeTypes: ["hygiene"],
        hygieneSubtypes: ["bath", "nail_trim"],
        mintId,
      });
    }
    assert.equal(state[PET_A]["hygiene:bath"], bathA);
    assert.equal(state[PET_A]["hygiene:nail_trim"], nailsA);
    assert.equal(state[PET_B]["hygiene:bath"], bathB);
  });

  it("multi-type create keeps sibling care keys untouched", () => {
    let n = 0;
    const mintId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    const state = mergeCreateStableRecordIds(
      { [PET_A]: { weight: ID_WEIGHT } },
      {
        petIds: [PET_A],
        activeTypes: ["hygiene", "weight"],
        hygieneSubtypes: ["bath"],
        mintId,
      },
    );
    assert.equal(state[PET_A].weight, ID_WEIGHT);
    assert.ok(state[PET_A]["hygiene:bath"]);
    assert.notEqual(state[PET_A]["hygiene:bath"], ID_WEIGHT);
  });
});

describe("resolveHygieneCreateStableId + ownership", () => {
  it("prefers hygiene:<subtype>; legacy hygiene only for single-subtype", () => {
    const multi = formWithRecordIds({
      [PET_A]: {
        hygiene: ID_LEGACY,
        "hygiene:bath": ID_BATH,
        "hygiene:nail_trim": ID_NAILS,
      },
    });
    assert.equal(
      resolveHygieneCreateStableId({
        formData: multi,
        petId: PET_A,
        petIds: [PET_A],
        subtype: "bath",
        hygieneItemCount: 2,
      }),
      ID_BATH,
    );
    assert.equal(
      resolveHygieneCreateStableId({
        formData: multi,
        petId: PET_A,
        petIds: [PET_A],
        subtype: "nail_trim",
        hygieneItemCount: 2,
      }),
      ID_NAILS,
    );
    // Multi-subtype without specific key must fail closed (no shared legacy).
    const legacyOnly = formWithRecordIds({ [PET_A]: { hygiene: ID_LEGACY } });
    assert.equal(
      resolveHygieneCreateStableId({
        formData: legacyOnly,
        petId: PET_A,
        petIds: [PET_A],
        subtype: "bath",
        hygieneItemCount: 2,
      }),
      null,
    );
    assert.equal(
      resolveHygieneCreateStableId({
        formData: legacyOnly,
        petId: PET_A,
        petIds: [PET_A],
        subtype: "bath",
        hygieneItemCount: 1,
      }),
      ID_LEGACY,
    );
  });

  it("other identity ignores custom label text", () => {
    assert.equal(hygieneStableRecordKey("other"), "hygiene:other");
    const form = formWithRecordIds({ [PET_A]: { "hygiene:other": ID_OTHER } });
    assert.equal(
      resolveHygieneCreateStableId({
        formData: form,
        petId: PET_A,
        petIds: [PET_A],
        subtype: "other",
        hygieneItemCount: 1,
      }),
      ID_OTHER,
    );
  });

  it("create / reuse / reject matrix including subtype mismatch", () => {
    assert.deepEqual(
      resolveHygieneRecordCreateOwnership(ID_BATH, HOUSEHOLD, PET_A, "bath", null),
      { ok: true, status: "create" },
    );
    assert.deepEqual(
      resolveHygieneRecordCreateOwnership(ID_BATH, HOUSEHOLD, PET_A, "bath", {
        id: ID_BATH,
        household_id: HOUSEHOLD,
        pet_id: PET_A,
        type: "hygiene",
        hygiene_subtype: "bath",
      }),
      { ok: true, status: "reuse" },
    );
    assert.equal(
      resolveHygieneRecordCreateOwnership(ID_BATH, OTHER_HOUSEHOLD, PET_A, "bath", {
        id: ID_BATH,
        household_id: HOUSEHOLD,
        pet_id: PET_A,
        type: "hygiene",
        hygiene_subtype: "bath",
      }).ok,
      false,
    );
    assert.equal(
      resolveHygieneRecordCreateOwnership(ID_BATH, HOUSEHOLD, PET_B, "bath", {
        id: ID_BATH,
        household_id: HOUSEHOLD,
        pet_id: PET_A,
        type: "hygiene",
        hygiene_subtype: "bath",
      }).ok,
      false,
    );
    assert.deepEqual(
      resolveHygieneRecordCreateOwnership(ID_BATH, HOUSEHOLD, PET_A, "bath", {
        id: ID_BATH,
        household_id: HOUSEHOLD,
        pet_id: PET_A,
        type: "vaccine",
        hygiene_subtype: "bath",
      }),
      { ok: false, reason: "type_mismatch" },
    );
    assert.deepEqual(
      resolveHygieneRecordCreateOwnership(ID_BATH, HOUSEHOLD, PET_A, "bath", {
        id: ID_BATH,
        household_id: HOUSEHOLD,
        pet_id: PET_A,
        type: "hygiene",
        hygiene_subtype: "nail_trim",
      }),
      { ok: false, reason: "subtype_mismatch" },
    );
  });

  it("partial success retry: bath reused, nails created (created count = 2)", () => {
    const bathDecision = resolveHygieneRecordCreateOwnership(ID_BATH, HOUSEHOLD, PET_A, "bath", {
      id: ID_BATH,
      household_id: HOUSEHOLD,
      pet_id: PET_A,
      type: "hygiene",
      hygiene_subtype: "bath",
    });
    const nailsDecision = resolveHygieneRecordCreateOwnership(ID_NAILS, HOUSEHOLD, PET_A, "nail_trim", null);
    assert.equal(bathDecision.ok && bathDecision.status, "reuse");
    assert.equal(nailsDecision.ok && nailsDecision.status, "create");
    let created = 0;
    if (bathDecision.ok) created += 1;
    if (nailsDecision.ok) created += 1;
    assert.equal(created, 2);
  });

  it("23505-style unique violation helper still recognized for re-read path", () => {
    assert.equal(isUniqueViolation({ code: "23505", message: "duplicate key" }), true);
    assert.match(createActions, /isUniqueViolation\(error\)/);
    assert.match(createActions, /resolveHygieneRecordCreateOwnership/);
  });
});

describe("hygiene create wiring (Phase B)", () => {
  it("server always resolves pet×subtype stable IDs (no 1×1-only gate)", () => {
    assert.match(createActions, /resolveHygieneCreateStableId/);
    assert.match(createActions, /hygieneItemCount: hygieneItems\.length/);
    assert.doesNotMatch(createActions, /hygieneItems\.length === 1 && pets\.length === 1/);
    assert.match(createActions, /id: stableId/);
    assert.match(createActions, /type: "hygiene"/);
  });

  it("client uses mergeCreateStableRecordIds / hygieneStableRecordKey path", () => {
    assert.match(recordFields, /mergeCreateStableRecordIds/);
    assert.match(recordFields, /hygieneSubtypes/);
    assert.doesNotMatch(recordFields, /nextPet\[type\] = prevPet\[type\] \?\? crypto\.randomUUID\(\)/);
  });

  it("attachments stay scoped to careType hygiene and still run after create/reuse", () => {
    assert.match(createActions, /hygieneItems\.length === 1 && isAttachableQuickRecordType\("hygiene"\)/);
    assert.match(createActions, /ensureHealthRecordAttachments\([\s\S]*"hygiene"/);
    assert.match(ensureAttachments, /alreadyLinkedIds|linkedIds/);
    assert.doesNotMatch(createActions, /ensureHealthRecordAttachments\([\s\S]*"hygiene:/);
  });

  it("reuse is not an edit overwrite path", () => {
    assert.match(createActions, /ownership\.status === "reuse"[\s\S]*recordId = stableId/);
    assert.doesNotMatch(
      createActions,
      /ownership\.status === "reuse"[\s\S]{0,200}\.update\(/,
    );
  });

  it("no migration 0037; edit/delete stay on health_records", () => {
    const migrations = readdirSync(join(root, "supabase/migrations"));
    assert.equal(migrations.some((name) => name.includes("0037")), false);
    const updateActions = readFileSync(join(root, "src/app/(app)/records/actions.ts"), "utf8");
    assert.match(updateActions, /type === "hygiene"/);
    assert.doesNotMatch(updateActions, /hygiene_sessions|hygieneStableRecordKey/);
  });
});
