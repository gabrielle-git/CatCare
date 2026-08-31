"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureHousehold } from "@/lib/households";
import { parsePetIds } from "@/lib/pet-form";
import { parseRoutineForm } from "@/lib/routine-form";
import { assertCanEdit } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { supabase, household, userId: data.user.id };
}

function revalidateRoutinePaths() {
  revalidatePath("/routines");
  revalidatePath("/");
}

async function syncRoutinePets(
  supabase: Awaited<ReturnType<typeof authContext>>["supabase"],
  householdId: string,
  routineId: string,
  petIds: string[],
) {
  const { data: existing } = await supabase
    .from("care_routine_pets")
    .select("pet_id")
    .eq("household_id", householdId)
    .eq("routine_id", routineId);
  const current = new Set((existing ?? []).map((row) => row.pet_id));
  const next = new Set(petIds);
  const toRemove = [...current].filter((id) => !next.has(id));
  const toAdd = [...next].filter((id) => !current.has(id));

  if (toRemove.length > 0) {
    await supabase
      .from("care_routine_pets")
      .delete()
      .eq("household_id", householdId)
      .eq("routine_id", routineId)
      .in("pet_id", toRemove);
  }
  if (toAdd.length > 0) {
    await supabase.from("care_routine_pets").insert(
      toAdd.map((pet_id) => ({ household_id: householdId, routine_id: routineId, pet_id })),
    );
  }
}

export async function createRoutine(formData: FormData) {
  const parsed = parseRoutineForm(formData);
  if ("error" in parsed) redirect(`/routines/new?error=${encodeURIComponent(parsed.error ?? "Dados inválidos.")}`);

  const petIds = parsePetIds(formData);
  if (petIds.length === 0) redirect(`/routines/new?error=${encodeURIComponent("Selecione ao menos um pet.")}`);

  const { supabase, household, userId } = await authContext();
  const { data: pets } = await supabase
    .from("pets")
    .select("id")
    .eq("household_id", household.id)
    .in("id", petIds)
    .is("archived_at", null);
  if (!pets || pets.length !== petIds.length) {
    redirect(`/routines/new?error=${encodeURIComponent("Pet não encontrado.")}`);
  }

  const { data: routine, error } = await supabase
    .from("care_routines")
    .insert({
      household_id: household.id,
      title: parsed.title,
      icon_key: parsed.icon_key,
      instructions: parsed.instructions,
      recurrence_days: parsed.recurrence_days,
      preferred_time: parsed.preferred_time,
      starts_on: parsed.starts_on,
      active: parsed.active,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !routine) redirect(`/routines/new?error=${encodeURIComponent(error?.message ?? "Erro ao salvar.")}`);

  await supabase.from("care_routine_pets").insert(
    petIds.map((pet_id) => ({ household_id: household.id, routine_id: routine.id, pet_id })),
  );

  revalidateRoutinePaths();
  redirect("/routines?saved=1");
}

export async function updateRoutine(routineId: string, formData: FormData) {
  const parsed = parseRoutineForm(formData);
  if ("error" in parsed) redirect(`/routines/${routineId}/edit?error=${encodeURIComponent(parsed.error ?? "Dados inválidos.")}`);

  const petIds = parsePetIds(formData);
  if (petIds.length === 0) redirect(`/routines/${routineId}/edit?error=${encodeURIComponent("Selecione ao menos um pet.")}`);

  const { supabase, household } = await authContext();
  const { data: pets } = await supabase
    .from("pets")
    .select("id")
    .eq("household_id", household.id)
    .in("id", petIds)
    .is("archived_at", null);
  if (!pets || pets.length !== petIds.length) {
    redirect(`/routines/${routineId}/edit?error=${encodeURIComponent("Pet não encontrado.")}`);
  }

  const { error } = await supabase
    .from("care_routines")
    .update({
      title: parsed.title,
      icon_key: parsed.icon_key,
      instructions: parsed.instructions,
      recurrence_days: parsed.recurrence_days,
      preferred_time: parsed.preferred_time,
      starts_on: parsed.starts_on,
      active: parsed.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", routineId)
    .eq("household_id", household.id);
  if (error) redirect(`/routines/${routineId}/edit?error=${encodeURIComponent(error.message)}`);

  await syncRoutinePets(supabase, household.id, routineId, petIds);
  revalidateRoutinePaths();
  redirect(`/routines/${routineId}?updated=1`);
}

export async function completeRoutine(routineId: string, formData: FormData) {
  const { supabase, household, userId } = await authContext();
  const petIds = parsePetIds(formData);
  if (petIds.length === 0) redirect(`/routines?error=${encodeURIComponent("Selecione ao menos um pet.")}`);

  const { data: routine } = await supabase
    .from("care_routines")
    .select("id")
    .eq("id", routineId)
    .eq("household_id", household.id)
    .maybeSingle();
  if (!routine) redirect(`/routines?error=${encodeURIComponent("Rotina não encontrada.")}`);

  const { data: linked } = await supabase
    .from("care_routine_pets")
    .select("pet_id")
    .eq("household_id", household.id)
    .eq("routine_id", routineId)
    .in("pet_id", petIds);
  if (!linked || linked.length !== petIds.length) {
    redirect(`/routines?error=${encodeURIComponent("Pet não pertence a esta rotina.")}`);
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("care_routine_completions").insert(
    petIds.map((pet_id) => ({
      household_id: household.id,
      routine_id: routineId,
      pet_id,
      completed_at: now,
      completed_by: userId,
    })),
  );
  if (error) redirect(`/routines?error=${encodeURIComponent(error.message)}`);

  revalidateRoutinePaths();
  redirect(`/routines?completed=${petIds.length}`);
}

export async function setRoutineActive(routineId: string, active: boolean) {
  const { supabase, household } = await authContext();
  const { error } = await supabase
    .from("care_routines")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", routineId)
    .eq("household_id", household.id);
  if (error) redirect(`/routines?error=${encodeURIComponent(error.message)}`);
  revalidateRoutinePaths();
  redirect(`/routines/${routineId}?${active ? "reactivated=1" : "paused=1"}`);
}
