"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/attachments";
import { compensateNewStoragePaths } from "@/lib/attachment-direct-upload";
import { parseWeightKg } from "@/lib/format";
import { validateFactualCivilDate } from "@/lib/factual-datetime";
import { ensureHousehold } from "@/lib/households";
import {
  findActiveHomonymPets,
  isUniqueViolation,
  resolveInitialWeightOwnership,
  resolvePetCreateOwnership,
} from "@/lib/pet-create";
import {
  parsePetPhotoPayload,
  petPhotoPayloadFieldName,
  validateStoredPetPhotoObject,
} from "@/lib/pet-photo-upload";
import { assertCanEdit } from "@/lib/roles";
import { isStoragePetPhotoPath, builtinPetAvatarPath, resolveBuiltinPetAvatarId } from "@/lib/pet-avatars";
import { PET_MEDIA_BUCKET } from "@/lib/pets";
import { createClient } from "@/lib/supabase/server";
import type { PetSex } from "@/types/database";

const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export type CreatePetResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string }
  | {
      ok: false;
      duplicateName: true;
      name: string;
      existingLabel: string;
      petId: string;
    };

export type UpdatePetResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string }
  | {
      ok: false;
      duplicateName: true;
      name: string;
      existingLabel: string;
    };

function readFields(formData: FormData) {
  const sexValue = value(formData, "sex");
  const sex: PetSex = sexValue === "male" || sexValue === "female" ? sexValue : "unknown";
  const birthDate = value(formData, "birth_date");
  const hasMicrochip = formData.get("has_microchip") === "on";
  const microchipNumber = value(formData, "microchip_number");
  const microchipDate = value(formData, "microchip_implanted_at");
  const microchipLocation = value(formData, "microchip_location");
  const isNeutered = formData.get("neutered") === "on";
  const neuteredAt = value(formData, "neutered_at");
  const neuteredPlace = value(formData, "neutered_place");
  if (hasMicrochip && !microchipNumber) throw new Error("Informe o número do microchip.");
  if (birthDate) {
    const birthCheck = validateFactualCivilDate(birthDate);
    if (!birthCheck.ok) throw new Error(birthCheck.message);
  }
  if (hasMicrochip && microchipDate) {
    const chipCheck = validateFactualCivilDate(microchipDate);
    if (!chipCheck.ok) throw new Error(chipCheck.message);
  }
  if (isNeutered && neuteredAt) {
    const neuterCheck = validateFactualCivilDate(neuteredAt);
    if (!neuterCheck.ok) throw new Error(neuterCheck.message);
  }
  return {
    name: value(formData, "name"),
    sex,
    birth_date: birthDate || null,
    birth_date_estimated: formData.get("birth_date_estimated") === "on",
    breed: value(formData, "breed") || null,
    color: value(formData, "color") || null,
    neutered: isNeutered,
    neutered_at: isNeutered && neuteredAt ? neuteredAt : null,
    neutered_place: isNeutered ? neuteredPlace || null : null,
    has_microchip: hasMicrochip,
    microchip_number: hasMicrochip ? microchipNumber : null,
    microchip_implanted_at: hasMicrochip && microchipDate ? microchipDate : null,
    microchip_location: hasMicrochip ? microchipLocation || null : null,
    notes: value(formData, "notes") || null,
  };
}

function rejectBinaryPhoto(formData: FormData) {
  const photo = formData.get("photo");
  if (typeof File !== "undefined" && photo instanceof File && photo.size > 0) {
    throw new Error("Envie a foto pelo fluxo de upload direto. Recarregue a página e tente de novo.");
  }
}

function readPhotoPayload(formData: FormData) {
  return parsePetPhotoPayload(String(formData.get(petPhotoPayloadFieldName()) ?? ""));
}

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { supabase, household };
}

async function finalizePetPhotoPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  petId: string,
  formData: FormData,
): Promise<{ ok: true; path: string | null } | { ok: false; error: string; orphanPath?: string }> {
  try {
    rejectBinaryPhoto(formData);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Foto inválida." };
  }
  let intent;
  try {
    intent = readPhotoPayload(formData);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Foto inválida." };
  }
  if (!intent) return { ok: true, path: null };
  const validated = await validateStoredPetPhotoObject(supabase, householdId, petId, intent);
  if (!validated.ok) {
    return { ok: false, error: validated.message, orphanPath: validated.storage_path };
  }
  return { ok: true, path: validated.storage_path };
}

async function ensureInitialWeight(options: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  householdId: string;
  petId: string;
  weightRecordId: string | null;
  initialWeightKg: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, householdId, petId, weightRecordId, initialWeightKg } = options;
  if (!initialWeightKg) return { ok: true };
  const grams = parseWeightKg(initialWeightKg);
  if (grams == null) return { ok: false, error: "Informe um peso válido em kg (ex.: 4,2)." };
  if (!weightRecordId || !isUuid(weightRecordId)) {
    return { ok: false, error: "Intenção de peso inicial inválida. Recarregue a página." };
  }

  const { data: existingWeight } = await supabase
    .from("weight_records")
    .select("id, household_id, pet_id")
    .eq("id", weightRecordId)
    .maybeSingle();

  const ownership = resolveInitialWeightOwnership(weightRecordId, householdId, petId, existingWeight);
  if (!ownership.ok) {
    return {
      ok: false,
      error:
        ownership.reason === "foreign_household" || ownership.reason === "pet_mismatch"
          ? "Não foi possível reutilizar este peso inicial."
          : "Intenção de peso inicial inválida. Recarregue a página.",
    };
  }
  if (ownership.status === "reuse") return { ok: true };

  const { error: weightError } = await supabase.from("weight_records").insert({
    id: weightRecordId,
    household_id: householdId,
    pet_id: petId,
    weight_grams: grams,
    notes: "Peso inicial",
  });
  if (weightError) {
    if (isUniqueViolation(weightError)) {
      const { data: again } = await supabase
        .from("weight_records")
        .select("id, household_id, pet_id")
        .eq("id", weightRecordId)
        .maybeSingle();
      const retry = resolveInitialWeightOwnership(weightRecordId, householdId, petId, again);
      if (retry.ok && retry.status === "reuse") return { ok: true };
    }
    return { ok: false, error: weightError.message };
  }
  await supabase.from("pets").update({ current_weight_grams: grams }).eq("id", petId).eq("household_id", householdId);
  return { ok: true };
}

function finishCreate(petId: string): CreatePetResult {
  revalidatePath("/");
  revalidatePath("/pets");
  revalidatePath(`/pets/${petId}`);
  return { ok: true, redirectTo: `/pets/${petId}?created=1` };
}

/**
 * Idempotent pet create: stable client pet_id, optional stable weight id,
 * active-homonym warning (server-authoritative), photo via direct upload payload.
 */
export async function createPet(formData: FormData): Promise<CreatePetResult> {
  let fields: ReturnType<typeof readFields>;
  try {
    fields = readFields(formData);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Dados inválidos." };
  }
  if (!fields.name) return { ok: false, error: "Nome é obrigatório." };

  const petId = value(formData, "pet_id");
  if (!isUuid(petId)) return { ok: false, error: "Intenção de criação inválida. Recarregue a página." };

  const weightRecordIdRaw = value(formData, "initial_weight_record_id");
  const initialWeightKg = value(formData, "initial_weight_kg");
  const weightRecordId = initialWeightKg
    ? weightRecordIdRaw || null
    : weightRecordIdRaw && isUuid(weightRecordIdRaw)
      ? weightRecordIdRaw
      : null;
  if (initialWeightKg && (!weightRecordId || !isUuid(weightRecordId))) {
    return { ok: false, error: "Intenção de peso inicial inválida. Recarregue a página." };
  }

  const allowDuplicateName = formData.get("allow_duplicate_name") === "true" || formData.get("allow_duplicate_name") === "1";

  const { supabase, household } = await authContext();
  const photoResult = await finalizePetPhotoPath(supabase, household.id, petId, formData);
  if (!photoResult.ok) {
    if (photoResult.orphanPath) {
      await compensateNewStoragePaths(supabase, [photoResult.orphanPath]).catch(() => undefined);
    }
    return { ok: false, error: photoResult.error };
  }
  const photoPath = photoResult.path;

  const { data: existing } = await supabase
    .from("pets")
    .select("id, household_id, name, photo_path")
    .eq("id", petId)
    .maybeSingle();

  const ownership = resolvePetCreateOwnership(petId, household.id, existing);
  if (!ownership.ok) {
    return {
      ok: false,
      error:
        ownership.reason === "foreign_household"
          ? "Não foi possível reutilizar esta intenção de criação."
          : "Intenção de criação inválida. Recarregue a página.",
    };
  }

  if (ownership.status === "reuse") {
    const weightResult = await ensureInitialWeight({
      supabase,
      householdId: household.id,
      petId,
      weightRecordId,
      initialWeightKg,
    });
    if (!weightResult.ok) return { ok: false, error: weightResult.error };

    if (photoPath && !existing?.photo_path) {
      await supabase.from("pets").update({ photo_path: photoPath }).eq("id", petId).eq("household_id", household.id);
    }
    return finishCreate(petId);
  }

  // New create — active homonym check (server authority).
  if (!allowDuplicateName) {
    const { data: activePets } = await supabase
      .from("pets")
      .select("id, name, archived_at")
      .eq("household_id", household.id)
      .is("archived_at", null);
    const homonyms = findActiveHomonymPets(activePets ?? [], fields.name, petId);
    if (homonyms.length > 0) {
      if (photoPath) {
        await compensateNewStoragePaths(supabase, [photoPath]).catch(() => undefined);
      }
      const labels = [...new Set(homonyms.map((pet) => pet.name.trim()).filter(Boolean))];
      return {
        ok: false,
        duplicateName: true,
        name: fields.name,
        existingLabel: labels.join(", "),
        petId,
      };
    }
  }

  const { error } = await supabase.from("pets").insert({
    id: petId,
    ...fields,
    household_id: household.id,
  });

  if (error) {
    if (isUniqueViolation(error)) {
      const { data: again } = await supabase
        .from("pets")
        .select("id, household_id, name, photo_path")
        .eq("id", petId)
        .maybeSingle();
      const retry = resolvePetCreateOwnership(petId, household.id, again);
      if (retry.ok && retry.status === "reuse") {
        const weightResult = await ensureInitialWeight({
          supabase,
          householdId: household.id,
          petId,
          weightRecordId,
          initialWeightKg,
        });
        if (!weightResult.ok) return { ok: false, error: weightResult.error };
        if (photoPath && !again?.photo_path) {
          await supabase.from("pets").update({ photo_path: photoPath }).eq("id", petId).eq("household_id", household.id);
        }
        return finishCreate(petId);
      }
      if (photoPath) {
        await compensateNewStoragePaths(supabase, [photoPath]).catch(() => undefined);
      }
      return { ok: false, error: "Não foi possível reutilizar esta intenção de criação." };
    }
    if (photoPath) {
      await compensateNewStoragePaths(supabase, [photoPath]).catch(() => undefined);
    }
    return { ok: false, error: error.message };
  }

  const weightResult = await ensureInitialWeight({
    supabase,
    householdId: household.id,
    petId,
    weightRecordId,
    initialWeightKg,
  });
  if (!weightResult.ok) return { ok: false, error: weightResult.error };

  if (photoPath) {
    await supabase.from("pets").update({ photo_path: photoPath }).eq("id", petId).eq("household_id", household.id);
  }

  return finishCreate(petId);
}

/**
 * Update pet with the same active-homonym gate as create (excludes current pet_id).
 * Soft duplicate returns to the client; final save revalidates allow_duplicate_name (TOCTOU-safe).
 */
export async function updatePet(petId: string, formData: FormData): Promise<UpdatePetResult> {
  if (!isUuid(petId)) return { ok: false, error: "Pet inválido." };

  let fields: ReturnType<typeof readFields>;
  try {
    fields = readFields(formData);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Dados inválidos." };
  }
  if (!fields.name) return { ok: false, error: "Nome é obrigatório." };

  const allowDuplicateName = formData.get("allow_duplicate_name") === "true" || formData.get("allow_duplicate_name") === "1";

  const { supabase, household } = await authContext();
  const { data: existing } = await supabase
    .from("pets")
    .select("photo_path")
    .eq("id", petId)
    .eq("household_id", household.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Pet não encontrado nesta família." };

  const photoResult = await finalizePetPhotoPath(supabase, household.id, petId, formData);
  if (!photoResult.ok) {
    if (photoResult.orphanPath) {
      await compensateNewStoragePaths(supabase, [photoResult.orphanPath]).catch(() => undefined);
    }
    return { ok: false, error: photoResult.error };
  }
  const photoPath = photoResult.path;

  // Active homonym check — excludes this pet; archived pets ignored (shared helper).
  if (!allowDuplicateName) {
    const { data: activePets } = await supabase
      .from("pets")
      .select("id, name, archived_at")
      .eq("household_id", household.id)
      .is("archived_at", null);
    const homonyms = findActiveHomonymPets(activePets ?? [], fields.name, petId);
    if (homonyms.length > 0) {
      const labels = [...new Set(homonyms.map((pet) => pet.name.trim()).filter(Boolean))];
      // New photo uploaded but we soft-fail for homonym — keep old path; compensate new object.
      if (photoPath) {
        await compensateNewStoragePaths(supabase, [photoPath]).catch(() => undefined);
      }
      return {
        ok: false,
        duplicateName: true,
        name: fields.name,
        existingLabel: labels.join(", "),
      };
    }
  }

  const { error } = await supabase
    .from("pets")
    .update(photoPath ? { ...fields, photo_path: photoPath } : fields)
    .eq("id", petId)
    .eq("household_id", household.id);
  if (error) {
    if (photoPath) {
      await compensateNewStoragePaths(supabase, [photoPath]).catch(() => undefined);
    }
    return { ok: false, error: error.message };
  }

  // Only after DB success: best-effort remove previous Storage photo (never builtins, never before DB).
  if (photoPath && existing.photo_path && existing.photo_path !== photoPath && isStoragePetPhotoPath(existing.photo_path)) {
    await supabase.storage.from(PET_MEDIA_BUCKET).remove([existing.photo_path]).catch(() => undefined);
  }
  revalidatePath("/");
  revalidatePath("/pets");
  revalidatePath(`/pets/${petId}`);
  return { ok: true, redirectTo: `/pets/${petId}?updated=1` };
}

export type PetPhotoManageResult = { ok: true } | { ok: false; error: string };

/**
 * Replace profile photo from the avatar camera flow (upload already in Storage via direct upload).
 * DB first, then best-effort Storage cleanup of prior Storage object only.
 */
export async function replacePetProfilePhoto(petId: string, formData: FormData): Promise<PetPhotoManageResult> {
  if (!isUuid(petId)) return { ok: false, error: "Pet inválido." };
  const { supabase, household } = await authContext();
  const { data: existing } = await supabase
    .from("pets")
    .select("photo_path")
    .eq("id", petId)
    .eq("household_id", household.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Pet não encontrado nesta família." };

  const photoResult = await finalizePetPhotoPath(supabase, household.id, petId, formData);
  if (!photoResult.ok) {
    if (photoResult.orphanPath) {
      await compensateNewStoragePaths(supabase, [photoResult.orphanPath]).catch(() => undefined);
    }
    return { ok: false, error: photoResult.error };
  }
  if (!photoResult.path) return { ok: false, error: "Envie uma foto para substituir." };

  const { error } = await supabase
    .from("pets")
    .update({ photo_path: photoResult.path, updated_at: new Date().toISOString() })
    .eq("id", petId)
    .eq("household_id", household.id);
  if (error) {
    await compensateNewStoragePaths(supabase, [photoResult.path]).catch(() => undefined);
    return { ok: false, error: error.message };
  }

  if (existing.photo_path && existing.photo_path !== photoResult.path && isStoragePetPhotoPath(existing.photo_path)) {
    await supabase.storage.from(PET_MEDIA_BUCKET).remove([existing.photo_path]).catch(() => undefined);
  }
  revalidatePath("/");
  revalidatePath("/pets");
  revalidatePath(`/pets/${petId}`);
  return { ok: true };
}

/** Clear profile photo/avatar. Storage cleanup only after DB success and only for Storage objects. */
export async function removePetPhoto(petId: string): Promise<PetPhotoManageResult> {
  if (!isUuid(petId)) return { ok: false, error: "Pet inválido." };
  const { supabase, household } = await authContext();
  const { data: existing } = await supabase
    .from("pets")
    .select("photo_path")
    .eq("id", petId)
    .eq("household_id", household.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Pet não encontrado nesta família." };
  if (!existing.photo_path) return { ok: true };

  const previousPath = existing.photo_path;
  const { error } = await supabase
    .from("pets")
    .update({ photo_path: null, updated_at: new Date().toISOString() })
    .eq("id", petId)
    .eq("household_id", household.id);
  if (error) return { ok: false, error: error.message };

  if (isStoragePetPhotoPath(previousPath)) {
    await supabase.storage.from(PET_MEDIA_BUCKET).remove([previousPath]).catch(() => undefined);
  }
  revalidatePath("/");
  revalidatePath("/pets");
  revalidatePath(`/pets/${petId}`);
  return { ok: true };
}

/** Set a whitelisted built-in avatar. Never Storage-deletes builtin assets. */
export async function setPetBuiltinAvatar(petId: string, avatarId: string): Promise<PetPhotoManageResult> {
  if (!isUuid(petId)) return { ok: false, error: "Pet inválido." };
  const resolved = resolveBuiltinPetAvatarId(avatarId);
  if (!resolved) return { ok: false, error: "Avatar inválido." };

  const { supabase, household } = await authContext();
  const { data: existing } = await supabase
    .from("pets")
    .select("photo_path")
    .eq("id", petId)
    .eq("household_id", household.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Pet não encontrado nesta família." };

  const nextPath = builtinPetAvatarPath(resolved);
  if (existing.photo_path === nextPath) return { ok: true };

  const { error } = await supabase
    .from("pets")
    .update({ photo_path: nextPath, updated_at: new Date().toISOString() })
    .eq("id", petId)
    .eq("household_id", household.id);
  if (error) return { ok: false, error: error.message };

  if (isStoragePetPhotoPath(existing.photo_path)) {
    await supabase.storage.from(PET_MEDIA_BUCKET).remove([existing.photo_path!]).catch(() => undefined);
  }
  revalidatePath("/");
  revalidatePath("/pets");
  revalidatePath(`/pets/${petId}`);
  return { ok: true };
}

export async function updatePetDescription(petId: string, formData: FormData) {
  const notes = value(formData, "notes");
  if (notes.length > 1200) redirect(`/pets/${petId}?error=Descri%C3%A7%C3%A3o%20muito%20longa.`);
  const { supabase, household } = await authContext();
  const { error } = await supabase
    .from("pets")
    .update({ notes: notes || null })
    .eq("id", petId)
    .eq("household_id", household.id);
  if (error) redirect(`/pets/${petId}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/pets/${petId}`);
  redirect(`/pets/${petId}?saved=1`);
}

export async function archivePet(petId: string) {
  const { supabase, household } = await authContext();
  await supabase.from("pets").update({ archived_at: new Date().toISOString() }).eq("id", petId).eq("household_id", household.id);
  revalidatePath("/");
  revalidatePath("/pets");
  redirect("/pets?archived=1");
}
