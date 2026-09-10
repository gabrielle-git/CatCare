import { isUuid } from "@/lib/attachments";
import type { HealthRecordType } from "@/types/database";

/** Types accepted by health_records.type CHECK (and preserved by mappers). */
export const HEALTH_RECORD_SCHEMA_TYPES = new Set<HealthRecordType>([
  "vaccine",
  "consultation",
  "exam",
  "medication",
  "disease",
  "allergy",
  "surgery",
  "deworming",
  "other",
  "hygiene",
]);

/**
 * Map UI / form type → health_records.type.
 * Valid schema types round-trip (never silently collapse to other).
 * UI "observation" continues to mean health_records.type = other.
 */
export function mapFormTypeToHealthRecordType(type: string): HealthRecordType {
  if (type === "observation") return "other";
  if (HEALTH_RECORD_SCHEMA_TYPES.has(type as HealthRecordType)) {
    return type as HealthRecordType;
  }
  return "other";
}

export type HealthRecordCreateOwnershipResult =
  | { ok: true; status: "create" | "reuse" }
  | { ok: false; reason: "invalid_id" | "foreign_household" | "pet_mismatch" };

/** Pure ownership/idempotency decision for create retries with a stable record_id. */
export function resolveHealthRecordCreateOwnership(
  recordId: string,
  expectedHouseholdId: string,
  expectedPetId: string,
  existing: { id: string; household_id: string; pet_id: string } | null,
): HealthRecordCreateOwnershipResult {
  if (!isUuid(recordId)) return { ok: false, reason: "invalid_id" };
  if (!existing) return { ok: true, status: "create" };
  if (existing.household_id !== expectedHouseholdId) return { ok: false, reason: "foreign_household" };
  if (existing.pet_id !== expectedPetId) return { ok: false, reason: "pet_mismatch" };
  return { ok: true, status: "reuse" };
}

/** Quick-register types that may carry health_record_attachments in V1 UI. */
export const ATTACHABLE_QUICK_RECORD_TYPES = new Set([
  "vaccine",
  "deworming",
  "medication",
  "consultation",
  "exam",
  "observation",
  "hygiene",
]);

export function isAttachableQuickRecordType(type: string): boolean {
  return ATTACHABLE_QUICK_RECORD_TYPES.has(type);
}
