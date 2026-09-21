/**
 * Recoverable create-record failure: keep the form mounted and preserve intention IDs.
 * Success and auth still use Next.js redirect (NEXT_REDIRECT) and must not be converted here.
 */

export type CreateRecordResult = { ok: false; error: string };

export class RecordCreateFailure extends Error {
  readonly name = "RecordCreateFailure";

  constructor(message: string) {
    super(message);
  }
}

export function isCreateRecordFailureResult(result: unknown): result is CreateRecordResult {
  if (typeof result !== "object" || result === null) return false;
  const row = result as { ok?: unknown; error?: unknown };
  return row.ok === false && typeof row.error === "string";
}

export function toCreateRecordFailureResult(error: RecordCreateFailure): CreateRecordResult {
  return { ok: false, error: error.message };
}

export function mapCreateRecordCaughtError(error: unknown): CreateRecordResult | "rethrow" {
  if (error instanceof RecordCreateFailure) return toCreateRecordFailureResult(error);
  return "rethrow";
}

/** Outcome after a factual server action returns (uploads already finished). */
export type DirectUploadActionOutcome =
  | { kind: "custom"; result: unknown }
  | { kind: "structured_error"; error: string }
  | { kind: "noop" };

/**
 * Decide how DirectUploadForm should treat an action return value.
 * Structured create failures stay inline — no navigation, no upload compensation.
 */
export function resolveDirectUploadActionOutcome(
  result: unknown,
  hasCustomHandler: boolean,
): DirectUploadActionOutcome {
  if (hasCustomHandler) return { kind: "custom", result };
  if (isCreateRecordFailureResult(result)) {
    return { kind: "structured_error", error: result.error };
  }
  return { kind: "noop" };
}

/**
 * Compensation of newly uploaded Storage paths:
 * - before the factual action (upload/client failure): yes
 * - after structured factual `{ ok:false }`: no (partial server work may already link intents)
 * - after thrown/unexpected client-visible errors post-action: yes (legacy catch path)
 */
export function shouldCompensateUploadedPaths(options: {
  phase: "before_action" | "after_action";
  structuredFailure?: boolean;
}): boolean {
  if (options.phase === "before_action") return true;
  if (options.structuredFailure) return false;
  return true;
}

/** Snapshot used to prove client intention survives a structured error (no remount/reset). */
export type CreateFormIntentSnapshot = {
  recordIdsByPetType: Record<string, Record<string, string>>;
  selectedPetIds: string[];
  activeTypes: string[];
  hygieneSubtypes: string[];
};

export function formIntentAfterStructuredCreateFailure(
  previous: CreateFormIntentSnapshot,
): CreateFormIntentSnapshot {
  // Structured failure must not remount RecordFields or rewrite hidden record_ids_json.
  return {
    recordIdsByPetType: previous.recordIdsByPetType,
    selectedPetIds: previous.selectedPetIds,
    activeTypes: previous.activeTypes,
    hygieneSubtypes: previous.hygieneSubtypes,
  };
}

export function sameRecordIdsJson(
  a: Record<string, Record<string, string>>,
  b: Record<string, Record<string, string>>,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
