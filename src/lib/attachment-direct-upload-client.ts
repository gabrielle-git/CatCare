"use client";

import { prepareAttachmentUploadsAction, compensateAttachmentUploadsAction } from "@/app/(app)/attachments/actions";
import {
  attachmentsPayloadFieldName,
  type AttachmentUploadIntent,
  type PrepareAttachmentUploadResult,
} from "@/lib/attachment-direct-upload";
import {
  clearPendingAttachmentFiles,
  getPendingAttachmentFile,
  listPendingAttachmentIds,
} from "@/lib/attachment-file-registry";
import { createClient } from "@/lib/supabase/client";
import { healthAttachmentFieldNames } from "@/lib/health-record-attachment-form";
import { isUuid, sanitizeOriginalFilename, isAllowedAttachmentMime, ATTACHMENT_MAX_BYTES, normalizeDisplayNameInput } from "@/lib/attachments";

const DEFAULT_CONCURRENCY = 3;

export type DirectUploadProgress = {
  phase: "preparing" | "uploading" | "finalizing";
  message: string;
};

function stripFileFields(formData: FormData) {
  const keys = [...new Set([...formData.keys()])];
  for (const key of keys) {
    if (key === "files" || key.startsWith("files__")) {
      formData.delete(key);
    }
  }
}

/**
 * Collect attachment intents from FormData id/name fields + File registry.
 * Supports document (unscoped) and clinical (pet+type / type) field names.
 */
export function collectAttachmentIntentsFromForm(
  formData: FormData,
  options?: {
    /** When set, only collect ids for these scopes (health). */
    scopes?: Array<{ petId: string; careType: string }>;
    /** Document-style unscoped fields. */
    unscoped?: boolean;
  },
): AttachmentUploadIntent[] {
  const intents: AttachmentUploadIntent[] = [];
  const seen = new Set<string>();

  const pushFrom = (
    attachmentIds: string[],
    displayNames: string[],
    scope?: { petId?: string; careType?: string },
  ) => {
    attachmentIds.forEach((id, index) => {
      if (!isUuid(id) || seen.has(id)) return;
      const file = getPendingAttachmentFile(id);
      if (!file) return;
      if (!isAllowedAttachmentMime(file.type)) {
        throw new Error(`O arquivo “${file.name}” precisa ser JPG, PNG, WebP ou PDF.`);
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        throw new Error(`Este arquivo ultrapassa o limite de 5 MB.`);
      }
      seen.add(id);
      intents.push({
        attachment_id: id,
        original_filename: sanitizeOriginalFilename(file.name),
        display_name: normalizeDisplayNameInput(displayNames[index] ?? ""),
        mime_type: file.type,
        byte_size: file.size,
        pet_id: scope?.petId ?? null,
        care_type: scope?.careType ?? null,
      });
    });
  };

  if (options?.scopes?.length) {
    for (const scope of options.scopes) {
      const names = healthAttachmentFieldNames(scope.careType, scope.petId);
      const ids = formData.getAll(names.attachmentIds).map((entry) => String(entry).trim()).filter(Boolean);
      const displayNames = formData.getAll(names.displayNames).map((entry) => String(entry ?? ""));
      pushFrom(ids, displayNames, scope);
    }
    return intents;
  }

  if (options?.unscoped !== false) {
    const ids = formData.getAll("attachment_ids").map((entry) => String(entry).trim()).filter(Boolean);
    const displayNames = formData.getAll("display_names").map((entry) => String(entry ?? ""));
    pushFrom(ids, displayNames);
  }

  // Also pick up any registry files whose ids appear in any attachment_ids* field
  for (const key of formData.keys()) {
    if (!key.startsWith("attachment_ids")) continue;
    if (key === "attachment_ids") continue;
    const ids = formData.getAll(key).map((entry) => String(entry).trim()).filter(Boolean);
    const displayKey = key.replace(/^attachment_ids/, "display_names");
    const displayNames = formData.getAll(displayKey).map((entry) => String(entry ?? ""));
    // Parse pet+type or type from key: attachment_ids__pet__type or attachment_ids__type
    const matchPetType = /^attachment_ids__([0-9a-f-]{36})__(.+)$/i.exec(key);
    const matchType = /^attachment_ids__(.+)$/i.exec(key);
    if (matchPetType) {
      pushFrom(ids, displayNames, { petId: matchPetType[1], careType: matchPetType[2] });
    } else if (matchType) {
      pushFrom(ids, displayNames, { careType: matchType[1] });
    }
  }

  return intents;
}

async function uploadOne(
  result: PrepareAttachmentUploadResult,
  file: File,
): Promise<{ path: string; newlyCreated: boolean }> {
  if (result.status === "already-linked" || result.status === "already-uploaded") {
    return { path: result.storage_path, newlyCreated: false };
  }
  if (!result.token) {
    throw new Error("Não foi possível enviar este arquivo. Tente novamente.");
  }
  const supabase = createClient();
  const { error } = await supabase.storage.from(result.bucket).uploadToSignedUrl(result.storage_path, result.token, file, {
    contentType: result.mime_type,
    upsert: false,
  });
  if (error) {
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("already exists") || message.includes("resource already exists")) {
      return { path: result.storage_path, newlyCreated: false };
    }
    throw new Error("Não foi possível enviar este arquivo. Tente novamente.");
  }
  return { path: result.storage_path, newlyCreated: result.will_create_object };
}

async function mapPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

/**
 * Prepare + direct upload, then write attachments_payload and strip File fields.
 * Returns newly created storage paths for compensation on later failure.
 */
export async function runDirectAttachmentUploads(
  formData: FormData,
  intents: AttachmentUploadIntent[],
  onProgress?: (progress: DirectUploadProgress) => void,
): Promise<{ newlyCreatedPaths: string[] }> {
  stripFileFields(formData);

  if (intents.length === 0) {
    formData.set(attachmentsPayloadFieldName(), "[]");
    return { newlyCreatedPaths: [] };
  }

  onProgress?.({ phase: "preparing", message: "Preparando envio dos arquivos..." });
  const prepared = await prepareAttachmentUploadsAction(intents);
  if (!prepared.ok) throw new Error(prepared.message);

  onProgress?.({ phase: "uploading", message: "Enviando arquivos..." });
  const newlyCreatedPaths: string[] = [];

  try {
    await mapPool(prepared.results, DEFAULT_CONCURRENCY, async (result) => {
      const file = getPendingAttachmentFile(result.attachment_id);
      if (!file && result.status === "upload-required") {
        throw new Error("Seleção de arquivos inconsistente. Recarregue a página e tente de novo.");
      }
      if (!file) return;
      const uploaded = await uploadOne(result, file);
      if (uploaded.newlyCreated) newlyCreatedPaths.push(uploaded.path);
    });
  } catch (error) {
    if (newlyCreatedPaths.length) {
      await compensateAttachmentUploadsAction(newlyCreatedPaths);
    }
    throw error;
  }

  const payload: AttachmentUploadIntent[] = prepared.results.map((result) => ({
    attachment_id: result.attachment_id,
    original_filename: result.original_filename,
    display_name: result.display_name,
    mime_type: result.mime_type,
    byte_size: result.byte_size,
    pet_id: result.pet_id ?? null,
    care_type: result.care_type ?? null,
  }));

  formData.set(attachmentsPayloadFieldName(), JSON.stringify(payload));
  stripFileFields(formData);
  clearPendingAttachmentFiles(listPendingAttachmentIds());
  onProgress?.({ phase: "finalizing", message: "Salvando registro..." });
  return { newlyCreatedPaths };
}

export async function compensateIfNeeded(paths: string[]) {
  if (!paths.length) return;
  await compensateAttachmentUploadsAction(paths);
}
