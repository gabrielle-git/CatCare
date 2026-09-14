import { isUuid } from "@/lib/attachments";

/** Normalize pet name for active-homonym comparison (not uniqueness). */
export function normalizePetNameForComparison(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/g, " ");
}

export type PetCreateOwnershipResult =
  | { ok: true; status: "create" | "reuse" }
  | { ok: false; reason: "invalid_id" | "foreign_household" };

/**
 * Pure ownership/idempotency decision for create retries with a stable pet_id.
 * Name equality is never used as idempotency.
 */
export function resolvePetCreateOwnership(
  petId: string,
  expectedHouseholdId: string,
  existing: { id: string; household_id: string } | null,
): PetCreateOwnershipResult {
  if (!isUuid(petId)) return { ok: false, reason: "invalid_id" };
  if (!existing) return { ok: true, status: "create" };
  if (existing.household_id !== expectedHouseholdId) return { ok: false, reason: "foreign_household" };
  return { ok: true, status: "reuse" };
}

export type WeightCreateOwnershipResult =
  | { ok: true; status: "create" | "reuse" }
  | { ok: false; reason: "invalid_id" | "foreign_household" | "pet_mismatch" };

/** Idempotency for optional initial weight_record tied to a stable id. */
export function resolveInitialWeightOwnership(
  weightRecordId: string,
  expectedHouseholdId: string,
  expectedPetId: string,
  existing: { id: string; household_id: string; pet_id: string } | null,
): WeightCreateOwnershipResult {
  if (!isUuid(weightRecordId)) return { ok: false, reason: "invalid_id" };
  if (!existing) return { ok: true, status: "create" };
  if (existing.household_id !== expectedHouseholdId) return { ok: false, reason: "foreign_household" };
  if (existing.pet_id !== expectedPetId) return { ok: false, reason: "pet_mismatch" };
  return { ok: true, status: "reuse" };
}

export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("duplicate key") || message.includes("unique constraint");
}

/** Find active pets whose normalized name matches (excluding the intent pet_id). */
export function findActiveHomonymPets<T extends { id: string; name: string; archived_at: string | null }>(
  pets: T[],
  candidateName: string,
  intentPetId: string,
): T[] {
  const needle = normalizePetNameForComparison(candidateName);
  if (!needle) return [];
  return pets.filter((pet) => {
    if (pet.id === intentPetId) return false;
    if (pet.archived_at) return false;
    return normalizePetNameForComparison(pet.name) === needle;
  });
}
