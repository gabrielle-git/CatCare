"use server";

import {
  assertUniqueAttachmentIds,
  canonicalAttachmentPath,
  createSignedUploadForPath,
  resolvePrepareStatus,
  validateIntentMetadata,
  type AttachmentUploadIntent,
  type PrepareAttachmentUploadResult,
  compensateNewStoragePaths,
  PET_MEDIA_BUCKET,
} from "@/lib/attachment-direct-upload";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

async function authHousehold() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false as const, message: "Entre na conta para enviar arquivos." };
  try {
    await assertCanEdit(supabase);
  } catch {
    return { ok: false as const, message: "Sem permissão para enviar arquivos." };
  }
  const household = await ensureHousehold(supabase, data.user.id);
  return { ok: true as const, supabase, household };
}

/**
 * Authorize direct-to-Storage uploads. Metadata only — never accepts File/Blob.
 * Household is derived from the session (never from client).
 */
export async function prepareAttachmentUploadsAction(
  intents: AttachmentUploadIntent[],
): Promise<{ ok: true; results: PrepareAttachmentUploadResult[] } | { ok: false; message: string }> {
  if (!Array.isArray(intents)) return { ok: false, message: "Seleção de arquivos inválida." };
  if (intents.length === 0) return { ok: true, results: [] };

  try {
    assertUniqueAttachmentIds(intents);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Anexos inválidos." };
  }

  const auth = await authHousehold();
  if (!auth.ok) return auth;
  const { supabase, household } = auth;

  const results: PrepareAttachmentUploadResult[] = [];

  for (const intent of intents) {
    const metaError = validateIntentMetadata(intent);
    if (metaError) return { ok: false, message: metaError };

    const storage_path = canonicalAttachmentPath(household.id, intent);
    const status = await resolvePrepareStatus(supabase, household.id, intent);

    if (status === "already-linked" || status === "already-uploaded") {
      results.push({
        attachment_id: intent.attachment_id,
        status,
        storage_path,
        bucket: PET_MEDIA_BUCKET,
        mime_type: intent.mime_type,
        original_filename: intent.original_filename,
        display_name: intent.display_name,
        byte_size: intent.byte_size,
        pet_id: intent.pet_id ?? null,
        care_type: intent.care_type ?? null,
        will_create_object: false,
      });
      continue;
    }

    const signed = await createSignedUploadForPath(supabase, storage_path);
    if ("error" in signed) {
      return { ok: false, message: signed.error || "Não foi possível autorizar o envio." };
    }
    if ("alreadyExists" in signed) {
      results.push({
        attachment_id: intent.attachment_id,
        status: "already-uploaded",
        storage_path,
        bucket: PET_MEDIA_BUCKET,
        mime_type: intent.mime_type,
        original_filename: intent.original_filename,
        display_name: intent.display_name,
        byte_size: intent.byte_size,
        pet_id: intent.pet_id ?? null,
        care_type: intent.care_type ?? null,
        will_create_object: false,
      });
      continue;
    }

    results.push({
      attachment_id: intent.attachment_id,
      status: "upload-required",
      storage_path,
      token: signed.token,
      bucket: PET_MEDIA_BUCKET,
      mime_type: intent.mime_type,
      original_filename: intent.original_filename,
      display_name: intent.display_name,
      byte_size: intent.byte_size,
      pet_id: intent.pet_id ?? null,
      care_type: intent.care_type ?? null,
      will_create_object: true,
    });
  }

  return { ok: true, results };
}

/**
 * Best-effort cleanup of Storage objects created in a failed attempt.
 * Never call with paths of already-linked / pre-existing objects.
 */
export async function compensateAttachmentUploadsAction(
  paths: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Array.isArray(paths) || paths.length === 0) return { ok: true };
  const auth = await authHousehold();
  if (!auth.ok) return auth;
  const safe = paths.filter((path) => typeof path === "string" && path.startsWith(`${auth.household.id}/attachments/`));
  return compensateNewStoragePaths(auth.supabase, safe);
}
