import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  RecordCreateFailure,
  formIntentAfterStructuredCreateFailure,
  isCreateRecordFailureResult,
  mapCreateRecordCaughtError,
  resolveDirectUploadActionOutcome,
  sameRecordIdsJson,
  shouldCompensateUploadedPaths,
  toCreateRecordFailureResult,
  type CreateFormIntentSnapshot,
} from "./record-create-result";

const root = process.cwd();
const createActions = readFileSync(join(root, "src/app/(app)/records/new/actions.ts"), "utf8");
const directForm = readFileSync(join(root, "src/components/direct-upload-form.tsx"), "utf8");
const recordFields = readFileSync(join(root, "src/components/record-fields.tsx"), "utf8");

describe("record create recoverable result contract", () => {
  it("RecordCreateFailure → structured { ok:false, error }", () => {
    const result = toCreateRecordFailureResult(new RecordCreateFailure("Pet não encontrado."));
    assert.deepEqual(result, { ok: false, error: "Pet não encontrado." });
    assert.equal(isCreateRecordFailureResult(result), true);
    assert.equal(isCreateRecordFailureResult({ ok: true }), false);
    assert.equal(isCreateRecordFailureResult({ ok: false }), false);
    assert.equal(isCreateRecordFailureResult(undefined), false);
  });

  it("createRecord catches only RecordCreateFailure and returns structured result", () => {
    assert.match(createActions, /export async function createRecord[\s\S]*mapCreateRecordCaughtError/);
    assert.match(createActions, /if \(mapped !== "rethrow"\) return mapped/);
    assert.match(createActions, /throw error/);
    assert.match(createActions, /failHere[\s\S]*throw new RecordCreateFailure/);
    assert.doesNotMatch(createActions, /redirect\(`\/records\/new\?/);
  });

  it("successful create still redirects via redirectAfterSave", () => {
    assert.match(createActions, /redirectAfterSave\(/);
    assert.match(createActions, /function redirectAfterSave[\s\S]*redirect\(/);
  });

  it("auth redirect to /login is preserved (not structured)", () => {
    assert.match(createActions, /if \(!auth\.user\) redirect\("\/login"\)/);
    assert.doesNotMatch(
      createActions,
      /if \(!auth\.user\)[\s\S]{0,80}RecordCreateFailure|if \(!auth\.user\)[\s\S]{0,80}\{ ok: false/,
    );
  });

  it("unexpected exceptions are rethrown (not converted)", () => {
    assert.deepEqual(
      mapCreateRecordCaughtError(new RecordCreateFailure("x")),
      { ok: false, error: "x" },
    );
    assert.equal(mapCreateRecordCaughtError(new Error("boom")), "rethrow");
    assert.equal(mapCreateRecordCaughtError({ digest: "NEXT_REDIRECT;replace;/login;307;" }), "rethrow");
    assert.match(createActions, /mapCreateRecordCaughtError\(error\)/);
    assert.match(createActions, /if \(mapped !== "rethrow"\) return mapped/);
    assert.match(createActions, /throw error/);
  });

  it("binary File guard uses RecordCreateFailure (recoverable, no remount redirect)", () => {
    assert.match(createActions, /instanceof File[\s\S]*throw new RecordCreateFailure/);
  });
});

describe("DirectUploadForm structured error handling", () => {
  it("recognizes structured create failure and keeps custom onActionResult intact", () => {
    const failure = { ok: false as const, error: "Informe uma data e hora válidas." };
    assert.deepEqual(
      resolveDirectUploadActionOutcome(failure, false),
      { kind: "structured_error", error: "Informe uma data e hora válidas." },
    );
    assert.deepEqual(
      resolveDirectUploadActionOutcome(failure, true),
      { kind: "custom", result: failure },
    );
    assert.deepEqual(resolveDirectUploadActionOutcome(undefined, false), { kind: "noop" });
    assert.deepEqual(resolveDirectUploadActionOutcome({ ok: true, redirectTo: "/x" }, true), {
      kind: "custom",
      result: { ok: true, redirectTo: "/x" },
    });
  });

  it("wires resolveDirectUploadActionOutcome and displays inline error without navigation", () => {
    assert.match(directForm, /resolveDirectUploadActionOutcome/);
    assert.match(directForm, /structured_error/);
    assert.match(directForm, /setError\(outcome\.error\)/);
    assert.match(directForm, /NEXT_REDIRECT/);
    assert.doesNotMatch(directForm, /router\.(push|replace)|window\.location/);
  });

  it("structured error does not compensate uploaded paths; pre-action failure still does", () => {
    assert.equal(
      shouldCompensateUploadedPaths({ phase: "after_action", structuredFailure: true }),
      false,
    );
    assert.equal(
      shouldCompensateUploadedPaths({ phase: "before_action" }),
      true,
    );
    assert.equal(
      shouldCompensateUploadedPaths({ phase: "after_action", structuredFailure: false }),
      true,
    );
    // Implementation: structured branch returns before catch compensation.
    assert.match(
      directForm,
      /structured_error[\s\S]*setError\(outcome\.error\)[\s\S]*return;/,
    );
    assert.match(directForm, /catch \(cause\)[\s\S]*compensateIfNeeded\(newlyCreatedPaths\)/);
  });
});

describe("create form intention survives structured recoverable error", () => {
  it("RecordFields stays mounted: DirectUploadForm does not remount children on structured error", () => {
    // Children are rendered as stable descendants; structured path only setError/setStatus.
    assert.match(directForm, /\{children\}/);
    assert.doesNotMatch(directForm, /key=\{.*error|setChildren|remount/);
    assert.match(directForm, /if \(outcome\.kind === "structured_error"\) \{\s*[\s\S]*?return;/);
  });

  it("record_ids_json / pets / hygiene selections survive structured failure (identity proof)", () => {
    const intent: CreateFormIntentSnapshot = {
      recordIdsByPetType: {
        "pet-a": { hygiene: "11111111-1111-4111-8111-111111111111", weight: "22222222-2222-4222-8222-222222222222" },
        "pet-b": { hygiene: "33333333-3333-4333-8333-333333333333" },
      },
      selectedPetIds: ["pet-a", "pet-b"],
      activeTypes: ["hygiene"],
      hygieneSubtypes: ["bath", "nail_trim"],
    };
    const after = formIntentAfterStructuredCreateFailure(intent);
    assert.equal(sameRecordIdsJson(intent.recordIdsByPetType, after.recordIdsByPetType), true);
    assert.deepEqual(after.selectedPetIds, ["pet-a", "pet-b"]);
    assert.deepEqual(after.hygieneSubtypes, ["bath", "nail_trim"]);
    assert.deepEqual(after.activeTypes, ["hygiene"]);
    // Second submit FormData would serialize the same map.
    assert.equal(
      JSON.stringify(after.recordIdsByPetType),
      JSON.stringify(intent.recordIdsByPetType),
    );
  });

  it("RecordFields still mints stable IDs once per mounted intention (reuse on retry)", () => {
    assert.match(recordFields, /mergeCreateStableRecordIds/);
    assert.doesNotMatch(recordFields, /setRecordIdsByPetType\(\{\}\)/);
    assert.match(recordFields, /name="record_ids_json"/);
  });
});

describe("phase A scope preserved alongside Phase B Hygiene keys", () => {
  it("keeps Phase A recoverable result helpers and allows hygiene subtype stable keys", () => {
    assert.match(createActions, /RecordCreateFailure|mapCreateRecordCaughtError/);
    assert.match(readFileSync(join(root, "src/lib/hygiene-care.ts"), "utf8"), /hygieneStableRecordKey/);
    assert.equal(
      readFileSync(join(root, "src/lib/record-create-result.ts"), "utf8").includes("0037"),
      false,
    );
  });
});
