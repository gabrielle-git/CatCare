import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/attachments";
import { syncEntityPets, validateEntityPets } from "@/lib/entity-pets";

export const REVIEW_NOT_FOUND_MESSAGE = "Avaliação não encontrada.";

export type HouseholdRowUpdateResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "error"; message: string };

/**
 * Household-scoped update that only reports success for a row it actually changed.
 * Foreign and missing ids are indistinguishable (both not_found): RLS hides foreign rows.
 */
export async function updateHouseholdRow(
  supabase: SupabaseClient,
  table: "products" | "product_reviews",
  id: string,
  householdId: string,
  patch: Record<string, unknown>,
): Promise<HouseholdRowUpdateResult> {
  if (!isUuid(id)) return { ok: false, reason: "not_found" };
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq("id", id)
    .eq("household_id", householdId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, reason: "error", message: error.message };
  if (!data) return { ok: false, reason: "not_found" };
  return { ok: true };
}

/** review_pets.review_id is not household-scoped in the schema: pets sync only after the household's own Review was updated. */
export async function updateProductReviewWithPets(
  supabase: SupabaseClient,
  householdId: string,
  reviewId: string,
  patch: Record<string, unknown>,
  petIds: string[],
): Promise<HouseholdRowUpdateResult> {
  const updated = await updateHouseholdRow(supabase, "product_reviews", reviewId, householdId, patch);
  if (!updated.ok) return updated;
  try {
    await validateEntityPets(supabase, householdId, petIds);
    await syncEntityPets(supabase, "review_pets", householdId, reviewId, petIds);
  } catch (petError) {
    return { ok: false, reason: "error", message: petError instanceof Error ? petError.message : "Não foi possível vincular os pets." };
  }
  return { ok: true };
}
