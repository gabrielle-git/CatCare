"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/attachments";
import { compensateNewStoragePaths } from "@/lib/attachment-direct-upload";
import {
  foreignIntentErrorMessage,
  invalidIntentErrorMessage,
} from "@/lib/create-idempotency";
import { ensureHousehold } from "@/lib/households";
import { validateFactualDateTimeLocal } from "@/lib/factual-datetime";
import {
  assertUniqueMediaIds,
  isUniqueViolation,
  MEMORY_MEDIA_MAX_PHOTOS,
  memoryMediaPayloadFieldName,
  parseMemoryMediaPayload,
  resolveMemoryCreateOwnership,
  validateStoredMemoryMediaObject,
  type MemoryMediaUploadIntent,
} from "@/lib/memory-media-upload";
import { PET_MEDIA_BUCKET } from "@/lib/pets";
import { assertCanEdit } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { MemoryType } from "@/types/database";

const memoryTypes = new Set<MemoryType>(["diary", "milestone", "photo"]);
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function readFields(formData: FormData) {
  const type = value(formData, "type") as MemoryType;
  const title = value(formData, "title");
  const occurredAt = value(formData, "occurred_at");
  const petIds = [...new Set(formData.getAll("pet_ids").map((entry) => String(entry).trim()).filter(Boolean))];
  if (!memoryTypes.has(type) || !title || title.length > 120 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(occurredAt) || petIds.length === 0) {
    throw new Error("Confira o tipo, título, data e escolha ao menos um pet.");
  }
  const occurredCheck = validateFactualDateTimeLocal(occurredAt);
  if (!occurredCheck.ok) throw new Error(occurredCheck.message);
  const body = value(formData, "body");
  if (body.length > 2000) throw new Error("O texto da memória está muito longo.");
  return { type, title, body: body || null, occurred_at: `${occurredAt}:00-03:00`, petIds };
}

function rejectBinaryFiles(formData: FormData) {
  for (const entry of formData.values()) {
    if (typeof File !== "undefined" && entry instanceof File && entry.size > 0) {
      throw new Error("Envie as fotos pelo fluxo de upload direto. Recarregue a página e tente de novo.");
    }
  }
}

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { supabase, household };
}

async function validatePets(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string, petIds: string[]) {
  const { data, error } = await supabase.from("pets").select("id").eq("household_id", householdId).in("id", petIds);
  if (error || (data ?? []).length !== petIds.length) {
    throw new Error("Um dos pets selecionados não pertence a esta família.");
  }
}

async function ensureMemoryPets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  memoryId: string,
  petIds: string[],
) {
  const { data: existing } = await supabase
    .from("memory_pets")
    .select("pet_id")
    .eq("memory_id", memoryId)
    .eq("household_id", householdId);
  const have = new Set((existing ?? []).map((row) => row.pet_id));
  const missing = petIds.filter((petId) => !have.has(petId));
  if (missing.length === 0) return;
  const { error } = await supabase.from("memory_pets").insert(
    missing.map((petId) => ({ household_id: householdId, memory_id: memoryId, pet_id: petId })),
  );
  if (error) {
    if (isUniqueViolation(error)) return;
    throw error;
  }
}

async function ensureMemoryMediaRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  memoryId: string,
  intents: MemoryMediaUploadIntent[],
): Promise<{ coverPath: string; invalidPaths: string[] }> {
  const invalidPaths: string[] = [];
  const sorted = [...intents].sort((a, b) => a.position - b.position);
  let coverPath = "";

  for (const intent of sorted) {
    const { data: existing } = await supabase
      .from("memory_media")
      .select("id, storage_path, household_id, memory_id")
      .eq("id", intent.media_id)
      .maybeSingle();

    if (existing) {
      if (existing.household_id !== householdId || existing.memory_id !== memoryId) {
        throw new Error(foreignIntentErrorMessage());
      }
      if (!coverPath) coverPath = existing.storage_path;
      continue;
    }

    const validated = await validateStoredMemoryMediaObject(supabase, householdId, memoryId, intent);
    if (!validated.ok) {
      invalidPaths.push(validated.storage_path);
      throw new Error(validated.message);
    }

    const { error } = await supabase.from("memory_media").insert({
      id: intent.media_id,
      household_id: householdId,
      memory_id: memoryId,
      storage_path: validated.storage_path,
      position: intent.position,
    });
    if (error) {
      if (isUniqueViolation(error)) {
        const { data: again } = await supabase
          .from("memory_media")
          .select("id, storage_path, household_id, memory_id")
          .eq("id", intent.media_id)
          .maybeSingle();
        if (again && again.household_id === householdId && again.memory_id === memoryId) {
          if (!coverPath) coverPath = again.storage_path;
          continue;
        }
      }
      invalidPaths.push(validated.storage_path);
      throw error;
    }
    if (!coverPath) coverPath = validated.storage_path;
  }

  return { coverPath, invalidPaths };
}

export async function createMemory(formData: FormData) {
  try {
    rejectBinaryFiles(formData);
  } catch (error) {
    redirect(`/memories/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Dados inválidos.")}`);
  }

  let fields: ReturnType<typeof readFields>;
  let intents: MemoryMediaUploadIntent[];
  const memoryId = value(formData, "memory_id");
  try {
    fields = readFields(formData);
    if (!isUuid(memoryId)) throw new Error(invalidIntentErrorMessage());
    intents = parseMemoryMediaPayload(String(formData.get(memoryMediaPayloadFieldName()) ?? ""));
    assertUniqueMediaIds(intents);
    if (intents.length === 0) throw new Error("Escolha ao menos uma foto para guardar esta memória.");
    if (intents.length > MEMORY_MEDIA_MAX_PHOTOS) {
      throw new Error(`Escolha no máximo ${MEMORY_MEDIA_MAX_PHOTOS} fotos por memória.`);
    }
  } catch (error) {
    redirect(`/memories/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Dados inválidos.")}`);
  }

  const { supabase, household } = await authContext();
  try {
    await validatePets(supabase, household.id, fields.petIds);
  } catch (error) {
    redirect(`/memories/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Pet inválido.")}`);
  }

  const { data: existingMemory } = await supabase
    .from("memories")
    .select("id, household_id, media_path")
    .eq("id", memoryId)
    .maybeSingle();
  const ownership = resolveMemoryCreateOwnership(memoryId, household.id, existingMemory);
  if (!ownership.ok) {
    redirect(
      `/memories/new?error=${encodeURIComponent(
        ownership.reason === "foreign_household" ? foreignIntentErrorMessage() : invalidIntentErrorMessage(),
      )}`,
    );
  }

  let memoryReused = ownership.status === "reuse";
  if (!memoryReused) {
    const { error } = await supabase.from("memories").insert({
      id: memoryId,
      household_id: household.id,
      pet_id: fields.petIds[0],
      type: fields.type,
      title: fields.title,
      body: fields.body,
      occurred_at: fields.occurred_at,
      media_path: null,
    });
    if (error) {
      if (isUniqueViolation(error)) {
        const { data: again } = await supabase
          .from("memories")
          .select("id, household_id, media_path")
          .eq("id", memoryId)
          .maybeSingle();
        const retry = resolveMemoryCreateOwnership(memoryId, household.id, again);
        if (retry.ok && retry.status === "reuse") {
          memoryReused = true;
        } else {
          redirect(
            `/memories/new?error=${encodeURIComponent(
              retry.ok === false && retry.reason === "foreign_household"
                ? foreignIntentErrorMessage()
                : error.message,
            )}`,
          );
        }
      } else {
        redirect(`/memories/new?error=${encodeURIComponent(error.message)}`);
      }
    }
  }

  try {
    await ensureMemoryPets(supabase, household.id, memoryId, fields.petIds);
  } catch (error) {
    // Memory already exists — do not delete it; relations can be completed on retry.
    redirect(`/memories/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível vincular os pets.")}`);
  }

  let coverPath = "";
  try {
    const ensured = await ensureMemoryMediaRows(supabase, household.id, memoryId, intents);
    coverPath = ensured.coverPath;
  } catch (error) {
    // Memory already exists — keep it; media can be completed on retry.
    redirect(`/memories/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível salvar as fotos.")}`);
  }

  if (coverPath) {
    await supabase
      .from("memories")
      .update({
        pet_id: fields.petIds[0],
        type: fields.type,
        title: fields.title,
        body: fields.body,
        occurred_at: fields.occurred_at,
        media_path: coverPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memoryId)
      .eq("household_id", household.id);
  }

  void memoryReused;
  revalidatePath("/memories");
  redirect("/memories?saved=1");
}

export async function updateMemory(memoryId: string, formData: FormData) {
  try {
    rejectBinaryFiles(formData);
  } catch (error) {
    redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : "Dados inválidos.")}`);
  }

  let fields: ReturnType<typeof readFields>;
  let intents: MemoryMediaUploadIntent[];
  try {
    fields = readFields(formData);
    intents = parseMemoryMediaPayload(String(formData.get(memoryMediaPayloadFieldName()) ?? ""));
    assertUniqueMediaIds(intents);
  } catch (error) {
    redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : "Dados inválidos.")}`);
  }

  const { supabase, household } = await authContext();
  const [{ data: existing }, { data: existingMedia, error: mediaReadError }] = await Promise.all([
    supabase.from("memories").select("media_path, archived_at").eq("id", memoryId).eq("household_id", household.id).maybeSingle(),
    supabase.from("memory_media").select("id, storage_path, position").eq("memory_id", memoryId).eq("household_id", household.id).order("position", { ascending: true }),
  ]);
  if (!existing || existing.archived_at) redirect("/memories");
  if (mediaReadError) redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(mediaReadError.message)}`);
  try {
    await validatePets(supabase, household.id, fields.petIds);
  } catch (error) {
    redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : "Pet inválido.")}`);
  }

  const requestedRemoval = new Set(formData.getAll("remove_media_ids").map(String));
  const currentMedia = existingMedia ?? [];
  const removed = currentMedia.filter((item) => requestedRemoval.has(item.id));
  const remaining = currentMedia.filter((item) => !requestedRemoval.has(item.id));
  const totalAfterUpdate = remaining.length + intents.length;
  if (totalAfterUpdate === 0) {
    redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent("A memória precisa continuar com ao menos uma foto.")}`);
  }
  if (totalAfterUpdate > MEMORY_MEDIA_MAX_PHOTOS) {
    redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(`Uma memória pode ter no máximo ${MEMORY_MEDIA_MAX_PHOTOS} fotos.`)}`);
  }

  const maxPosition = currentMedia.reduce((highest, item) => Math.max(highest, item.position), -1);
  const positionedIntents = intents.map((intent, index) => ({
    ...intent,
    position: Number.isInteger(intent.position) ? maxPosition + index + 1 : maxPosition + index + 1,
  }));
  // Re-index new media after existing max so positions stay unique.
  const normalizedIntents = positionedIntents.map((intent, index) => ({
    ...intent,
    position: maxPosition + index + 1,
  }));

  try {
    if (normalizedIntents.length) {
      await ensureMemoryMediaRows(supabase, household.id, memoryId, normalizedIntents);
    }
  } catch (error) {
    redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível enviar as fotos.")}`);
  }

  const { data: mediaAfter } = await supabase
    .from("memory_media")
    .select("id, storage_path, position")
    .eq("memory_id", memoryId)
    .eq("household_id", household.id)
    .order("position", { ascending: true });
  const remainingIds = new Set(remaining.map((item) => item.id));
  const kept = (mediaAfter ?? []).filter((item) => remainingIds.has(item.id) || normalizedIntents.some((intent) => intent.media_id === item.id));
  const coverPath = kept[0]?.storage_path ?? remaining[0]?.storage_path ?? null;

  const { error } = await supabase
    .from("memories")
    .update({
      pet_id: fields.petIds[0],
      type: fields.type,
      title: fields.title,
      body: fields.body,
      occurred_at: fields.occurred_at,
      media_path: coverPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memoryId)
    .eq("household_id", household.id);
  if (error) {
    redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  if (removed.length) {
    const { error: removeError } = await supabase
      .from("memory_media")
      .delete()
      .eq("memory_id", memoryId)
      .eq("household_id", household.id)
      .in("id", removed.map((item) => item.id));
    if (removeError) redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(removeError.message)}`);
    await supabase.storage.from(PET_MEDIA_BUCKET).remove(removed.map((item) => item.storage_path));
  }

  // Replace pet links idempotently: delete extras, insert missing.
  const { data: currentLinks } = await supabase
    .from("memory_pets")
    .select("pet_id")
    .eq("memory_id", memoryId)
    .eq("household_id", household.id);
  const currentPetIds = new Set((currentLinks ?? []).map((row) => row.pet_id));
  const wanted = new Set(fields.petIds);
  const toRemove = [...currentPetIds].filter((petId) => !wanted.has(petId));
  const toAdd = fields.petIds.filter((petId) => !currentPetIds.has(petId));
  if (toRemove.length) {
    await supabase.from("memory_pets").delete().eq("memory_id", memoryId).eq("household_id", household.id).in("pet_id", toRemove);
  }
  if (toAdd.length) {
    const { error: linksError } = await supabase.from("memory_pets").insert(
      toAdd.map((petId) => ({ household_id: household.id, memory_id: memoryId, pet_id: petId })),
    );
    if (linksError && !isUniqueViolation(linksError)) {
      redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(linksError.message)}`);
    }
  }

  revalidatePath("/memories");
  redirect("/memories?updated=1");
}

export async function archiveMemory(memoryId: string) {
  const { supabase, household } = await authContext();
  await supabase.from("memories").update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", memoryId).eq("household_id", household.id);
  revalidatePath("/memories");
  redirect("/memories?archived=1");
}

export async function restoreMemory(memoryId: string) {
  const { supabase, household } = await authContext();
  await supabase.from("memories").update({ archived_at: null, updated_at: new Date().toISOString() }).eq("id", memoryId).eq("household_id", household.id);
  revalidatePath("/memories");
  redirect("/memories?view=archived&restored=1");
}

export async function deleteMemoryPermanently(memoryId: string) {
  const { supabase, household } = await authContext();
  const [{ data: memory }, { data: mediaRows }] = await Promise.all([
    supabase.from("memories").select("media_path, archived_at").eq("id", memoryId).eq("household_id", household.id).maybeSingle(),
    supabase.from("memory_media").select("storage_path").eq("memory_id", memoryId).eq("household_id", household.id),
  ]);
  if (!memory?.archived_at) redirect("/memories");
  const paths = [...new Set([...(mediaRows ?? []).map((item) => item.storage_path), memory.media_path].filter((path): path is string => Boolean(path)))];
  const { error } = await supabase.from("memories").delete().eq("id", memoryId).eq("household_id", household.id);
  if (!error && paths.length) await compensateNewStoragePaths(supabase, paths);
  revalidatePath("/memories");
  redirect("/memories?view=archived&deleted=1");
}
