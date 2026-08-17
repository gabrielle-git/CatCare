import type { SupabaseClient } from "@supabase/supabase-js";

export type EntityPetTable = "expense_pets" | "purchase_pets" | "review_pets";
type EntityPetColumn = "expense_id" | "purchase_id" | "review_id";

const entityColumn: Record<EntityPetTable, EntityPetColumn> = {
  expense_pets: "expense_id",
  purchase_pets: "purchase_id",
  review_pets: "review_id",
};

export async function validateEntityPets(supabase: SupabaseClient, householdId: string, petIds: string[]) {
  if (petIds.length === 0) return;
  const { data, error } = await supabase.from("pets").select("id").eq("household_id", householdId).in("id", petIds);
  if (error) throw error;
  if ((data ?? []).length !== petIds.length) throw new Error("Um dos gatinhos selecionados não pertence a esta família.");
}

export async function syncEntityPets(
  supabase: SupabaseClient,
  table: EntityPetTable,
  householdId: string,
  entityId: string,
  petIds: string[],
) {
  const column = entityColumn[table];
  await supabase.from(table).delete().eq(column, entityId).eq("household_id", householdId);
  if (petIds.length === 0) return;
  const { error } = await supabase.from(table).insert(
    petIds.map((petId) => ({ household_id: householdId, [column]: entityId, pet_id: petId })),
  );
  if (error) throw error;
}

export async function loadPetIdsByEntity(
  supabase: SupabaseClient,
  table: EntityPetTable,
  householdId: string,
  entityIds: string[],
) {
  const column = entityColumn[table];
  const map = new Map<string, string[]>();
  if (entityIds.length === 0) return map;
  const { data, error } = await supabase.from(table).select(`${column}, pet_id`).eq("household_id", householdId).in(column, entityIds);
  if (error) throw error;
  for (const row of data ?? []) {
    const record = row as Record<string, string>;
    const entityId = String(record[column]);
    const current = map.get(entityId) ?? [];
    current.push(String(record.pet_id));
    map.set(entityId, current);
  }
  return map;
}

export function resolvePetIdsFromRow(petIds: string[], legacyPetId: string | null) {
  if (petIds.length > 0) return petIds;
  return legacyPetId ? [legacyPetId] : [];
}
