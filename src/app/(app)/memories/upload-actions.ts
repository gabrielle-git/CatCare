"use server";

import { compensateNewStoragePaths, PET_MEDIA_BUCKET } from "@/lib/attachment-direct-upload";
import { ensureHousehold } from "@/lib/households";
import {
  assertUniqueMediaIds,
  prepareOneMemoryMediaUpload,
  type MemoryMediaUploadIntent,
  type PrepareMemoryMediaResult,
} from "@/lib/memory-media-upload";
import { isUuid } from "@/lib/attachments";
import { assertCanEdit } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

async function authHousehold() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false as const, message: "Entre na conta para enviar fotos." };
  try {
    await assertCanEdit(supabase);
  } catch {
    return { ok: false as const, message: "Sem permissão para enviar fotos." };
  }
  const household = await ensureHousehold(supabase, data.user.id);
  return { ok: true as const, supabase, household };
}

/**
 * Authorize direct-to-Storage uploads for memory_media.
 * Metadata only — never accepts File/Blob. Household is session-derived.
 */
export async function prepareMemoryMediaUploadsAction(
  memoryId: string,
  intents: MemoryMediaUploadIntent[],
): Promise<{ ok: true; results: PrepareMemoryMediaResult[] } | { ok: false; message: string }> {
  if (!isUuid(memoryId)) return { ok: false, message: "Intenção de memória inválida." };
  if (!Array.isArray(intents)) return { ok: false, message: "Seleção de fotos inválida." };
  if (intents.length === 0) return { ok: true, results: [] };

  try {
    assertUniqueMediaIds(intents);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Fotos inválidas." };
  }

  const auth = await authHousehold();
  if (!auth.ok) return auth;
  const { supabase, household } = auth;

  // Memory may not exist yet (create-before-finalize). Ownership of memory_id is enforced on create.
  // If it already exists, it must belong to this household.
  const { data: existingMemory } = await supabase
    .from("memories")
    .select("id, household_id")
    .eq("id", memoryId)
    .maybeSingle();
  if (existingMemory && existingMemory.household_id !== household.id) {
    return { ok: false, message: "Não foi possível reutilizar esta intenção de criação." };
  }

  const results: PrepareMemoryMediaResult[] = [];
  for (const intent of intents) {
    const prepared = await prepareOneMemoryMediaUpload(supabase, household.id, memoryId, intent);
    if ("ok" in prepared && prepared.ok === false) return prepared;
    results.push(prepared as PrepareMemoryMediaResult);
  }
  return { ok: true, results };
}

/**
 * Best-effort cleanup of Storage objects created in a failed attempt.
 * Only paths under this household's memories/ prefix.
 */
export async function compensateMemoryMediaUploadsAction(
  paths: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Array.isArray(paths) || paths.length === 0) return { ok: true };
  const auth = await authHousehold();
  if (!auth.ok) return auth;
  const prefix = `${auth.household.id}/memories/`;
  const safe = paths.filter((path) => typeof path === "string" && path.startsWith(prefix));
  void PET_MEDIA_BUCKET;
  return compensateNewStoragePaths(auth.supabase, safe);
}
