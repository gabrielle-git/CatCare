import { isUuid } from "@/lib/attachments";
import {
  isUniqueViolation,
  resolveHouseholdCreateOwnership,
  type HouseholdCreateOwnershipResult,
} from "@/lib/create-idempotency";

export { isUniqueViolation };

/** Normalize pet name for active-homonym comparison (not uniqueness). */
export function normalizePetNameForComparison(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/g, " ");
}

export type PetCreateOwnershipResult = HouseholdCreateOwnershipResult;

/**
 * Pure ownership/idempotency decision for create retries with a stable pet_id.
 * Name equality is never used as idempotency.
 */
export function resolvePetCreateOwnership(
  petId: string,
  expectedHouseholdId: string,
  existing: { id: string; household_id: string } | null,
): PetCreateOwnershipResult {
  return resolveHouseholdCreateOwnership(petId, expectedHouseholdId, existing);
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

const draftValue = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

/** Snapshot of create-pet fields for restoring UI after a soft server response (homonym warning). */
export type PetCreateFormDraft = {
  name: string;
  sex: string;
  birth_date: string;
  birth_date_estimated: boolean;
  breed: string;
  color: string;
  initial_weight_kg: string;
  neutered: boolean;
  neutered_at: string;
  neutered_place: string;
  has_microchip: boolean;
  microchip_number: string;
  microchip_implanted_at: string;
  microchip_location: string;
  notes: string;
  pet_id: string;
  initial_weight_record_id: string;
};

/**
 * Capture submitted create-pet values before React may reset the uncontrolled form.
 * Intent IDs are included so confirm/cancel keep the same intention.
 */
export function readPetCreateFormDraft(formData: FormData): PetCreateFormDraft {
  return {
    name: draftValue(formData, "name"),
    sex: draftValue(formData, "sex") || "unknown",
    birth_date: draftValue(formData, "birth_date"),
    birth_date_estimated: formData.get("birth_date_estimated") === "on",
    breed: draftValue(formData, "breed"),
    color: draftValue(formData, "color"),
    initial_weight_kg: draftValue(formData, "initial_weight_kg"),
    neutered: formData.get("neutered") === "on",
    neutered_at: draftValue(formData, "neutered_at"),
    neutered_place: draftValue(formData, "neutered_place"),
    has_microchip: formData.get("has_microchip") === "on",
    microchip_number: draftValue(formData, "microchip_number"),
    microchip_implanted_at: draftValue(formData, "microchip_implanted_at"),
    microchip_location: draftValue(formData, "microchip_location"),
    notes: draftValue(formData, "notes"),
    pet_id: draftValue(formData, "pet_id"),
    initial_weight_record_id: draftValue(formData, "initial_weight_record_id"),
  };
}
