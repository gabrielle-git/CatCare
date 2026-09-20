import { isUuid } from "@/lib/attachments";
import { hygieneStableRecordKey } from "@/lib/hygiene-care";
import { readStableRecordIdForPetType } from "@/lib/health-record-attachment-form";

export type HygieneRecordCreateOwnershipResult =
  | { ok: true; status: "create" | "reuse" }
  | {
      ok: false;
      reason:
        | "invalid_id"
        | "foreign_household"
        | "pet_mismatch"
        | "type_mismatch"
        | "subtype_mismatch";
    };

export type HygieneExistingRow = {
  id: string;
  household_id: string;
  pet_id: string;
  type: string;
  hygiene_subtype: string | null;
};

/**
 * Pure ownership/idempotency for hygiene health_records create retries.
 * Stable id must match household + pet + type=hygiene + exact subtype.
 * Reuse does not authorize field overwrite — edit flow owns mutations.
 */
export function resolveHygieneRecordCreateOwnership(
  recordId: string,
  expectedHouseholdId: string,
  expectedPetId: string,
  expectedSubtype: string,
  existing: HygieneExistingRow | null,
): HygieneRecordCreateOwnershipResult {
  if (!isUuid(recordId)) return { ok: false, reason: "invalid_id" };
  if (!existing) return { ok: true, status: "create" };
  if (existing.household_id !== expectedHouseholdId) return { ok: false, reason: "foreign_household" };
  if (existing.pet_id !== expectedPetId) return { ok: false, reason: "pet_mismatch" };
  if (existing.type !== "hygiene") return { ok: false, reason: "type_mismatch" };
  if (String(existing.hygiene_subtype ?? "").trim() !== String(expectedSubtype).trim()) {
    return { ok: false, reason: "subtype_mismatch" };
  }
  return { ok: true, status: "reuse" };
}

/**
 * Resolve Hygiene create stable ID:
 * 1) preferred hygiene:<subtype>
 * 2) legacy pet×"hygiene" only when exactly one hygiene subtype is being created
 */
export function resolveHygieneCreateStableId(options: {
  formData: FormData;
  petId: string;
  petIds: string[];
  subtype: string;
  hygieneItemCount: number;
}): string | null {
  const stableKey = hygieneStableRecordKey(options.subtype);
  if (!stableKey) return null;
  const specific = readStableRecordIdForPetType(
    options.formData,
    options.petId,
    stableKey,
    options.petIds,
  );
  if (specific) return specific;
  if (options.hygieneItemCount === 1) {
    return readStableRecordIdForPetType(options.formData, options.petId, "hygiene", options.petIds);
  }
  return null;
}
