"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseWeightKg } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
import { PET_MEDIA_BUCKET } from "@/lib/pets";
import { createClient } from "@/lib/supabase/server";
import type { PetSex } from "@/types/database";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const photoExtensions = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

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

function readPhoto(formData: FormData) {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return null;
  if (photo.size > MAX_PHOTO_BYTES) throw new Error("A foto deve ter no máximo 5 MB.");
  const extension = photoExtensions.get(photo.type);
  if (!extension) throw new Error("Use uma foto JPG, PNG ou WebP.");
  return { photo, extension };
}

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { supabase, household };
}

async function uploadPhoto(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string, petId: string, photo: File, extension: string) {
  const path = `${householdId}/${petId}/profile-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(PET_MEDIA_BUCKET).upload(path, photo, { contentType: photo.type, cacheControl: "3600" });
  if (error) throw error;
  return path;
}

export async function createPet(formData: FormData) {
  let fields;
  try { fields = readFields(formData); } catch (error) {
    const message = error instanceof Error ? error.message : "Dados inválidos.";
    redirect(`/pets/new?error=${encodeURIComponent(message)}`);
  }
  if (!fields.name) redirect("/pets/new?error=Nome%20%C3%A9%20obrigat%C3%B3rio.");

  let photo: ReturnType<typeof readPhoto>;
  try { photo = readPhoto(formData); } catch (error) {
    const message = error instanceof Error ? error.message : "Foto inválida.";
    redirect(`/pets/new?error=${encodeURIComponent(message)}`);
  }

  const { supabase, household } = await authContext();
  const { data: pet, error } = await supabase.from("pets").insert({ ...fields, household_id: household.id }).select("id").single();
  if (error) redirect(`/pets/new?error=${encodeURIComponent(error.message)}`);

  const initialWeightKg = value(formData, "initial_weight_kg");
  if (initialWeightKg) {
    const grams = parseWeightKg(initialWeightKg);
    if (grams != null) {
      const { error: weightError } = await supabase.from("weight_records").insert({ household_id: household.id, pet_id: pet.id, weight_grams: grams, notes: "Peso inicial" });
      if (!weightError) await supabase.from("pets").update({ current_weight_grams: grams }).eq("id", pet.id);
    }
  }

  if (photo) {
    try {
      const photoPath = await uploadPhoto(supabase, household.id, pet.id, photo.photo, photo.extension);
      await supabase.from("pets").update({ photo_path: photoPath }).eq("id", pet.id);
    } catch {
      // O perfil continua válido mesmo se o upload falhar; a foto pode ser adicionada na edição.
    }
  }

  revalidatePath("/");
  revalidatePath("/pets");
  redirect(`/pets/${pet.id}?created=1`);
}

export async function updatePet(petId: string, formData: FormData) {
  let fields;
  try { fields = readFields(formData); } catch (error) {
    const message = error instanceof Error ? error.message : "Dados inválidos.";
    redirect(`/pets/${petId}/edit?error=${encodeURIComponent(message)}`);
  }
  if (!fields.name) redirect(`/pets/${petId}/edit?error=Nome%20%C3%A9%20obrigat%C3%B3rio.`);

  let photo: ReturnType<typeof readPhoto>;
  try { photo = readPhoto(formData); } catch (error) {
    const message = error instanceof Error ? error.message : "Foto inválida.";
    redirect(`/pets/${petId}/edit?error=${encodeURIComponent(message)}`);
  }

  const { supabase, household } = await authContext();
  const { data: existing } = await supabase.from("pets").select("photo_path").eq("id", petId).eq("household_id", household.id).maybeSingle();
  if (!existing) redirect("/pets");

  let photoPath: string | null = null;
  if (photo) {
    try { photoPath = await uploadPhoto(supabase, household.id, petId, photo.photo, photo.extension); }
    catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível enviar a foto.";
      redirect(`/pets/${petId}/edit?error=${encodeURIComponent(message)}`);
    }
  }

  const { error } = await supabase.from("pets").update(photoPath ? { ...fields, photo_path: photoPath } : fields).eq("id", petId).eq("household_id", household.id);
  if (error) redirect(`/pets/${petId}/edit?error=${encodeURIComponent(error.message)}`);

  if (photoPath && existing.photo_path) await supabase.storage.from(PET_MEDIA_BUCKET).remove([existing.photo_path]);
  revalidatePath("/");
  revalidatePath("/pets");
  revalidatePath(`/pets/${petId}`);
  redirect(`/pets/${petId}?updated=1`);
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
