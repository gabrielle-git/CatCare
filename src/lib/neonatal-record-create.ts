import { isUuid } from "@/lib/attachments";
import type { NeonatalRecordType } from "@/types/database";

export type NeonatalRecordCreateOwnershipResult =
  | { ok: true; status: "create" | "reuse" }
  | { ok: false; reason: "invalid_id" | "foreign_household" | "pet_mismatch" | "type_mismatch" };

/**
 * Pure ownership/idempotency for neonatal_records create retries.
 * Stable id must match household + pet + neonatal type (independent facts).
 */
export function resolveNeonatalRecordCreateOwnership(
  recordId: string,
  expectedHouseholdId: string,
  expectedPetId: string,
  expectedType: NeonatalRecordType,
  existing: { id: string; household_id: string; pet_id: string; type: string } | null,
): NeonatalRecordCreateOwnershipResult {
  if (!isUuid(recordId)) return { ok: false, reason: "invalid_id" };
  if (!existing) return { ok: true, status: "create" };
  if (existing.household_id !== expectedHouseholdId) return { ok: false, reason: "foreign_household" };
  if (existing.pet_id !== expectedPetId) return { ok: false, reason: "pet_mismatch" };
  if (existing.type !== expectedType) return { ok: false, reason: "type_mismatch" };
  return { ok: true, status: "reuse" };
}
