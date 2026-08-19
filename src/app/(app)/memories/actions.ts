"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
import { PET_MEDIA_BUCKET } from "@/lib/pets";
import { createClient } from "@/lib/supabase/server";
import type { MemoryType } from "@/types/database";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS = 8;
const photoExtensions = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const memoryTypes = new Set<MemoryType>(["diary", "milestone", "photo"]);
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

type ValidPhoto = { photo: File; extension: string };

function readPhotos(formData: FormData, required: boolean): ValidPhoto[] {
  const files = formData.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (required && files.length === 0) throw new Error("Escolha ao menos uma foto para guardar esta memória.");
  if (files.length > MAX_PHOTOS) throw new Error(`Escolha no máximo ${MAX_PHOTOS} fotos por memória.`);
  return files.map((photo) => {
    if (photo.size > MAX_PHOTO_BYTES) throw new Error(`A foto “${photo.name}” deve ter no máximo 5 MB.`);
    const extension = photoExtensions.get(photo.type);
    if (!extension) throw new Error(`A foto “${photo.name}” precisa ser JPG, PNG ou WebP.`);
    return { photo, extension };
  });
}

function readFields(formData: FormData) {
  const type = value(formData, "type") as MemoryType;
  const title = value(formData, "title");
  const occurredAt = value(formData, "occurred_at");
  const petIds = [...new Set(formData.getAll("pet_ids").map((entry) => String(entry).trim()).filter(Boolean))];
  if (!memoryTypes.has(type) || !title || title.length > 120 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(occurredAt) || petIds.length === 0) throw new Error("Confira o tipo, título, data e escolha ao menos um pet.");
  const body = value(formData, "body");
  if (body.length > 2000) throw new Error("O texto da memória está muito longo.");
  return { type, title, body: body || null, occurred_at: `${occurredAt}:00-03:00`, petIds };
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
  if (error || (data ?? []).length !== petIds.length) throw new Error("Um dos pets selecionados não pertence a esta família.");
}

async function uploadMemoryPhotos(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string, memoryId: string, photos: ValidPhoto[]) {
  const uploaded: string[] = [];
  try {
    for (const { photo, extension } of photos) {
      const path = `${householdId}/memories/${memoryId}/memory-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from(PET_MEDIA_BUCKET).upload(path, photo, { contentType: photo.type, cacheControl: "3600" });
      if (error) throw error;
      uploaded.push(path);
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(PET_MEDIA_BUCKET).remove(uploaded);
    throw error;
  }
}

export async function createMemory(formData: FormData) {
  let fields: ReturnType<typeof readFields>;
  let photos: ValidPhoto[];
  try { fields = readFields(formData); photos = readPhotos(formData, true); }
  catch (error) { redirect(`/memories/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Dados inválidos.")}`); }
  const { supabase, household } = await authContext();
  try { await validatePets(supabase, household.id, fields.petIds); }
  catch (error) { redirect(`/memories/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Pet inválido.")}`); }

  const memoryId = crypto.randomUUID();
  let mediaPaths: string[];
  try { mediaPaths = await uploadMemoryPhotos(supabase, household.id, memoryId, photos); }
  catch (error) { redirect(`/memories/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível enviar as fotos.")}`); }

  const { error } = await supabase.from("memories").insert({ id: memoryId, household_id: household.id, pet_id: fields.petIds[0], type: fields.type, title: fields.title, body: fields.body, occurred_at: fields.occurred_at, media_path: mediaPaths[0] });
  if (error) { await supabase.storage.from(PET_MEDIA_BUCKET).remove(mediaPaths); redirect(`/memories/new?error=${encodeURIComponent(error.message)}`); }

  const [{ error: linksError }, { error: mediaError }] = await Promise.all([
    supabase.from("memory_pets").insert(fields.petIds.map((petId) => ({ household_id: household.id, memory_id: memoryId, pet_id: petId }))),
    supabase.from("memory_media").insert(mediaPaths.map((storagePath, position) => ({ household_id: household.id, memory_id: memoryId, storage_path: storagePath, position }))),
  ]);
  if (linksError || mediaError) {
    await supabase.from("memories").delete().eq("id", memoryId).eq("household_id", household.id);
    await supabase.storage.from(PET_MEDIA_BUCKET).remove(mediaPaths);
    redirect(`/memories/new?error=${encodeURIComponent((linksError ?? mediaError)?.message ?? "Não foi possível completar a memória.")}`);
  }
  revalidatePath("/memories");
  redirect("/memories?saved=1");
}

export async function updateMemory(memoryId: string, formData: FormData) {
  let fields: ReturnType<typeof readFields>;
  let photos: ValidPhoto[];
  try { fields = readFields(formData); photos = readPhotos(formData, false); }
  catch (error) { redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : "Dados inválidos.")}`); }
  const { supabase, household } = await authContext();
  const [{ data: existing }, { data: existingMedia, error: mediaReadError }] = await Promise.all([
    supabase.from("memories").select("media_path, archived_at").eq("id", memoryId).eq("household_id", household.id).maybeSingle(),
    supabase.from("memory_media").select("id, storage_path, position").eq("memory_id", memoryId).eq("household_id", household.id).order("position", { ascending: true }),
  ]);
  if (!existing || existing.archived_at) redirect("/memories");
  if (mediaReadError) redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(mediaReadError.message)}`);
  try { await validatePets(supabase, household.id, fields.petIds); }
  catch (error) { redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : "Pet inválido.")}`); }

  const requestedRemoval = new Set(formData.getAll("remove_media_ids").map(String));
  const currentMedia = existingMedia ?? [];
  const removed = currentMedia.filter((item) => requestedRemoval.has(item.id));
  const remaining = currentMedia.filter((item) => !requestedRemoval.has(item.id));
  const totalAfterUpdate = remaining.length + photos.length;
  if (totalAfterUpdate === 0) redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent("A memória precisa continuar com ao menos uma foto.")}`);
  if (totalAfterUpdate > MAX_PHOTOS) redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(`Uma memória pode ter no máximo ${MAX_PHOTOS} fotos.`)}`);

  let newPaths: string[] = [];
  try { newPaths = await uploadMemoryPhotos(supabase, household.id, memoryId, photos); }
  catch (error) { redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível enviar as fotos.")}`); }

  const maxPosition = currentMedia.reduce((highest, item) => Math.max(highest, item.position), -1);
  if (newPaths.length) {
    const { error: insertError } = await supabase.from("memory_media").insert(newPaths.map((storagePath, index) => ({ household_id: household.id, memory_id: memoryId, storage_path: storagePath, position: maxPosition + index + 1 })));
    if (insertError) { await supabase.storage.from(PET_MEDIA_BUCKET).remove(newPaths); redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(insertError.message)}`); }
  }

  const coverPath = remaining[0]?.storage_path ?? newPaths[0];
  const { error } = await supabase.from("memories").update({ pet_id: fields.petIds[0], type: fields.type, title: fields.title, body: fields.body, occurred_at: fields.occurred_at, media_path: coverPath, updated_at: new Date().toISOString() }).eq("id", memoryId).eq("household_id", household.id);
  if (error) {
    if (newPaths.length) {
      await supabase.from("memory_media").delete().eq("memory_id", memoryId).in("storage_path", newPaths);
      await supabase.storage.from(PET_MEDIA_BUCKET).remove(newPaths);
    }
    redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(error.message)}`);
  }

  if (removed.length) {
    const { error: removeError } = await supabase.from("memory_media").delete().eq("memory_id", memoryId).eq("household_id", household.id).in("id", removed.map((item) => item.id));
    if (removeError) redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(removeError.message)}`);
    await supabase.storage.from(PET_MEDIA_BUCKET).remove(removed.map((item) => item.storage_path));
  }

  await supabase.from("memory_pets").delete().eq("memory_id", memoryId).eq("household_id", household.id);
  const { error: linksError } = await supabase.from("memory_pets").insert(fields.petIds.map((petId) => ({ household_id: household.id, memory_id: memoryId, pet_id: petId })));
  if (linksError) redirect(`/memories/${memoryId}/edit?error=${encodeURIComponent(linksError.message)}`);
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
  if (!error && paths.length) await supabase.storage.from(PET_MEDIA_BUCKET).remove(paths);
  revalidatePath("/memories");
  redirect("/memories?view=archived&deleted=1");
}
