"use client";

import {
  compensateMemoryMediaUploadsAction,
  prepareMemoryMediaUploadsAction,
} from "@/app/(app)/memories/upload-actions";
import {
  clearPendingAttachmentFiles,
  getPendingAttachmentFile,
} from "@/lib/attachment-file-registry";
import {
  memoryMediaPayloadFieldName,
  type MemoryMediaUploadIntent,
  type PrepareMemoryMediaResult,
} from "@/lib/memory-media-upload";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_CONCURRENCY = 3;

export type MemoryUploadProgress = {
  phase: "preparing" | "uploading" | "finalizing";
  message: string;
};

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
  const runners = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => run());
  await Promise.all(runners);
  return results;
}

async function uploadOne(result: PrepareMemoryMediaResult, file: File): Promise<{ path: string; newlyCreated: boolean }> {
  if (result.status === "already-linked" || result.status === "already-uploaded") {
    return { path: result.storage_path, newlyCreated: false };
  }
  if (!result.token) throw new Error("Não foi possível enviar esta foto. Tente novamente.");
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
    throw new Error("Não foi possível enviar esta foto. Tente novamente.");
  }
  return { path: result.storage_path, newlyCreated: result.will_create_object };
}

/**
 * Prepare + direct upload memory photos, then write metadata payload and strip File fields.
 */
export async function runDirectMemoryMediaUploads(
  formData: FormData,
  memoryId: string,
  intents: MemoryMediaUploadIntent[],
  onProgress?: (progress: MemoryUploadProgress) => void,
): Promise<{ newlyCreatedPaths: string[] }> {
  formData.delete("photos");
  if (intents.length === 0) {
    formData.set(memoryMediaPayloadFieldName(), "[]");
    return { newlyCreatedPaths: [] };
  }

  onProgress?.({ phase: "preparing", message: "Preparando envio das fotos..." });
  const prepared = await prepareMemoryMediaUploadsAction(memoryId, intents);
  if (!prepared.ok) throw new Error(prepared.message);

  onProgress?.({ phase: "uploading", message: "Enviando fotos..." });
  const newlyCreatedPaths: string[] = [];

  try {
    await mapPool(prepared.results, DEFAULT_CONCURRENCY, async (result) => {
      const file = getPendingAttachmentFile(result.media_id);
      if (!file && result.status === "upload-required") {
        throw new Error("Seleção de fotos inconsistente. Recarregue a página e tente de novo.");
      }
      if (!file) return;
      const uploaded = await uploadOne(result, file);
      if (uploaded.newlyCreated) newlyCreatedPaths.push(uploaded.path);
    });
  } catch (error) {
    if (newlyCreatedPaths.length) await compensateMemoryMediaUploadsAction(newlyCreatedPaths);
    throw error;
  }

  const payload: MemoryMediaUploadIntent[] = prepared.results.map((result) => ({
    media_id: result.media_id,
    mime_type: result.mime_type,
    byte_size: result.byte_size,
    original_filename: result.original_filename,
    position: result.position,
  }));
  formData.set(memoryMediaPayloadFieldName(), JSON.stringify(payload));
  formData.delete("photos");
  clearPendingAttachmentFiles(intents.map((item) => item.media_id));
  onProgress?.({ phase: "finalizing", message: "Salvando..." });
  return { newlyCreatedPaths };
}

export async function compensateMemoryUploadsIfNeeded(paths: string[]) {
  if (!paths.length) return;
  await compensateMemoryMediaUploadsAction(paths);
}
