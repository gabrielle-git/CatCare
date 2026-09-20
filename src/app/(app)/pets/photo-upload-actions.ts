"use server";

import { compensateNewStoragePaths } from "@/lib/attachment-direct-upload";
import { isUuid } from "@/lib/attachments";
import { ensureHousehold } from "@/lib/households";
import {
  preparePetPhotoUpload,
  type PetPhotoUploadIntent,
  type PreparePetPhotoResult,
} from "@/lib/pet-photo-upload";
import { assertCanEdit } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

async function authHousehold() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false as const, message: "Entre na conta para enviar a foto." };
  try {
    await assertCanEdit(supabase);
  } catch {
    return { ok: false as const, message: "Sem permissão para enviar a foto." };
  }
  const household = await ensureHousehold(supabase, data.user.id);
  return { ok: true as const, supabase, household };
}

/**
 * Authorize direct upload for a pet profile photo.
 * Pet may not exist yet on create — only household + UUID shapes are checked here.
 * Existing pet must belong to the session household.
 */
export async function preparePetPhotoUploadAction(
  petId: string,
  intent: PetPhotoUploadIntent,
): Promise<{ ok: true; result: PreparePetPhotoResult } | { ok: false; message: string }> {
  if (!isUuid(petId)) return { ok: false, message: "Pet inválido." };
  if (!intent || !isUuid(intent.photo_intent_id)) {
    return { ok: false, message: "Intenção de foto inválida." };
  }

  const auth = await authHousehold();
  if (!auth.ok) return auth;
  const { supabase, household } = auth;

  const { data: existingPet } = await supabase
    .from("pets")
    .select("id, household_id")
    .eq("id", petId)
    .maybeSingle();
  if (existingPet && existingPet.household_id !== household.id) {
    return { ok: false, message: "Não foi possível reutilizar esta intenção de criação." };
  }

  const prepared = await preparePetPhotoUpload(supabase, household.id, petId, intent);
  if ("ok" in prepared && prepared.ok === false) return prepared;
  return { ok: true, result: prepared as PreparePetPhotoResult };
}

export async function compensatePetPhotoUploadsAction(
  paths: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Array.isArray(paths) || paths.length === 0) return { ok: true };
  const auth = await authHousehold();
  if (!auth.ok) return auth;
  const prefix = `${auth.household.id}/`;
  const safe = paths.filter(
    (path) =>
      typeof path === "string"
      && path.startsWith(prefix)
      && path.includes("/profile/")
      && !path.includes("/attachments/")
      && !path.includes("/memories/"),
  );
  return compensateNewStoragePaths(auth.supabase, safe);
}
