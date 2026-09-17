import { isUuid } from "@/lib/attachments";

/**
 * Shared create-intent ownership for household-scoped rows with a client-stable id.
 * Domain-specific checks (pet_id, expense_id link, etc.) stay in the caller.
 */
export type HouseholdCreateOwnershipResult =
  | { ok: true; status: "create" | "reuse" }
  | { ok: false; reason: "invalid_id" | "foreign_household" };

export function resolveHouseholdCreateOwnership(
  entityId: string,
  expectedHouseholdId: string,
  existing: { id: string; household_id: string } | null,
): HouseholdCreateOwnershipResult {
  if (!isUuid(entityId)) return { ok: false, reason: "invalid_id" };
  if (!existing) return { ok: true, status: "create" };
  if (existing.household_id !== expectedHouseholdId) return { ok: false, reason: "foreign_household" };
  return { ok: true, status: "reuse" };
}

export function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("duplicate key") || message.includes("unique constraint");
}

/** Safe user-facing message — never reveals foreign household data. */
export function foreignIntentErrorMessage(): string {
  return "Não foi possível reutilizar esta intenção de criação.";
}

export function invalidIntentErrorMessage(): string {
  return "Intenção de criação inválida. Recarregue a página.";
}
