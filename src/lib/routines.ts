import type { SupabaseClient } from "@supabase/supabase-js";
import type { CareRoutine, CareRoutineCompletion, CareRoutineWithPets } from "@/types/database";

export async function listCareRoutines(supabase: SupabaseClient, householdId: string): Promise<CareRoutineWithPets[]> {
  const { data: routines, error } = await supabase
    .from("care_routines")
    .select("*")
    .eq("household_id", householdId)
    .order("active", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!routines?.length) return [];

  const ids = routines.map((r) => r.id);
  const { data: links, error: linkError } = await supabase
    .from("care_routine_pets")
    .select("routine_id, pet_id")
    .eq("household_id", householdId)
    .in("routine_id", ids);
  if (linkError) throw linkError;

  const petsByRoutine = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = petsByRoutine.get(link.routine_id) ?? [];
    list.push(link.pet_id);
    petsByRoutine.set(link.routine_id, list);
  }

  return (routines as CareRoutine[]).map((routine) => ({
    ...routine,
    pet_ids: petsByRoutine.get(routine.id) ?? [],
  }));
}

export async function getCareRoutine(supabase: SupabaseClient, householdId: string, routineId: string) {
  const { data, error } = await supabase
    .from("care_routines")
    .select("*")
    .eq("household_id", householdId)
    .eq("id", routineId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: links, error: linkError } = await supabase
    .from("care_routine_pets")
    .select("pet_id")
    .eq("household_id", householdId)
    .eq("routine_id", routineId);
  if (linkError) throw linkError;

  return { ...(data as CareRoutine), pet_ids: (links ?? []).map((l) => l.pet_id) } satisfies CareRoutineWithPets;
}

export async function listRoutineCompletions(
  supabase: SupabaseClient,
  householdId: string,
  routineId: string,
  limit = 30,
): Promise<CareRoutineCompletion[]> {
  const { data, error } = await supabase
    .from("care_routine_completions")
    .select("*")
    .eq("household_id", householdId)
    .eq("routine_id", routineId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CareRoutineCompletion[];
}

export async function listLatestCompletionsByRoutine(
  supabase: SupabaseClient,
  householdId: string,
  routineIds: string[],
): Promise<Map<string, Map<string, CareRoutineCompletion>>> {
  const result = new Map<string, Map<string, CareRoutineCompletion>>();
  if (routineIds.length === 0) return result;

  const { data, error } = await supabase
    .from("care_routine_completions")
    .select("*")
    .eq("household_id", householdId)
    .in("routine_id", routineIds)
    .order("completed_at", { ascending: false });
  if (error) throw error;

  for (const row of (data ?? []) as CareRoutineCompletion[]) {
    const byPet = result.get(row.routine_id) ?? new Map<string, CareRoutineCompletion>();
    if (!byPet.has(row.pet_id)) byPet.set(row.pet_id, row);
    result.set(row.routine_id, byPet);
  }
  return result;
}

export async function listRecentCompletionsForHousehold(
  supabase: SupabaseClient,
  householdId: string,
  limit = 50,
): Promise<CareRoutineCompletion[]> {
  const { data, error } = await supabase
    .from("care_routine_completions")
    .select("*")
    .eq("household_id", householdId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CareRoutineCompletion[];
}
