import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isUniqueViolation,
  resolveHouseholdCreateOwnership,
  type HouseholdCreateOwnershipResult,
} from "@/lib/create-idempotency";
import {
  assertImageMagicBytes,
  extensionForImageMime,
  IMAGE_MEDIA_MAX_BYTES,
  isImageMediaMime,
  MEMORY_MEDIA_MAX_PHOTOS,
  type ImageMediaMimeType,
} from "@/lib/image-media";
import { isUuid } from "@/lib/attachments";
import { PET_MEDIA_BUCKET } from "@/lib/pets";
import { createSignedUploadForPath } from "@/lib/attachment-direct-upload";

export { PET_MEDIA_BUCKET, IMAGE_MEDIA_MAX_BYTES, MEMORY_MEDIA_MAX_PHOTOS };
export type { ImageMediaMimeType };

export type MemoryMediaUploadIntent = {
  media_id: string;
  mime_type: ImageMediaMimeType;
  byte_size: number;
  original_filename: string;
  position: number;
};

export type PrepareMemoryMediaStatus = "already-linked" | "already-uploaded" | "upload-required";

export type PrepareMemoryMediaResult = {
  media_id: string;
  status: PrepareMemoryMediaStatus;
  storage_path: string;
  token?: string;
  bucket: string;
  mime_type: ImageMediaMimeType;
  byte_size: number;
  original_filename: string;
  position: number;
  will_create_object: boolean;
};

const MEMORY_MEDIA_PAYLOAD_FIELD = "memory_media_payload";

export function memoryMediaPayloadFieldName() {
  return MEMORY_MEDIA_PAYLOAD_FIELD;
}

export function resolveMemoryCreateOwnership(
  memoryId: string,
  expectedHouseholdId: string,
  existing: { id: string; household_id: string } | null,
): HouseholdCreateOwnershipResult {
  return resolveHouseholdCreateOwnership(memoryId, expectedHouseholdId, existing);
}

export { isUniqueViolation };

/**
 * Deterministic memory-media path (domain-specific — not /attachments/).
 * {household_id}/memories/{memory_id}/{media_id}.{ext}
 *
 * Abandonment limitation (no pending table / no 0036): a browser that closes after
 * signed upload but before finalize may leave an orphan object at this path until a
 * future GC/reconciler. Paths are deterministic so retries reuse the same object.
 */
export function canonicalMemoryMediaPath(
  householdId: string,
  memoryId: string,
  mediaId: string,
  mimeType: ImageMediaMimeType,
): string {
  if (!isUuid(householdId) || !isUuid(memoryId) || !isUuid(mediaId)) {
    throw new Error("IDs inválidos para path de memória.");
  }
  return `${householdId}/memories/${memoryId}/${mediaId}.${extensionForImageMime(mimeType)}`;
}

export function assertMemoryMediaStoragePath(householdId: string, memoryId: string, storagePath: string) {
  const prefix = `${householdId}/memories/${memoryId}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes("..")) {
    throw new Error("Caminho de mídia de memória inválido.");
  }
}

export async function storageObjectExistsAtPath(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<boolean> {
  const folder = storagePath.split("/").slice(0, -1).join("/");
  const fileName = storagePath.split("/").pop() ?? "";
  if (!folder || !fileName) return false;
  const { data, error } = await supabase.storage.from(PET_MEDIA_BUCKET).list(folder, {
    limit: 20,
    search: fileName,
  });
  if (error) return false;
  return (data ?? []).some((item) => item.name === fileName);
}

export function parseMemoryMediaPayload(raw: string): MemoryMediaUploadIntent[] {
  if (!raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Metadados de fotos inválidos. Recarregue a página.");
  }
  if (!Array.isArray(parsed)) throw new Error("Metadados de fotos inválidos.");
  return parsed.map((entry, index) => normalizeMemoryMediaIntent(entry, index));
}

function normalizeMemoryMediaIntent(entry: unknown, index: number): MemoryMediaUploadIntent {
  if (!entry || typeof entry !== "object") throw new Error(`Foto #${index + 1} inválida.`);
  const row = entry as Record<string, unknown>;
  const media_id = String(row.media_id ?? "").trim();
  const mime_type = String(row.mime_type ?? "").trim();
  const byte_size = Number(row.byte_size);
  const original_filename = String(row.original_filename ?? "foto").trim() || "foto";
  const position = Number(row.position);
  if (!isUuid(media_id)) throw new Error("ID de mídia inválido.");
  if (!isImageMediaMime(mime_type)) throw new Error("A foto precisa ser JPG, PNG ou WebP.");
  if (!Number.isFinite(byte_size) || byte_size <= 0) throw new Error("Tamanho de foto inválido.");
  if (byte_size > IMAGE_MEDIA_MAX_BYTES) throw new Error("A foto deve ter no máximo 5 MB.");
  if (!Number.isInteger(position) || position < 0) throw new Error("Posição de foto inválida.");
  return { media_id, mime_type, byte_size, original_filename, position };
}

export function validateMemoryMediaIntent(intent: MemoryMediaUploadIntent): string | null {
  if (!isUuid(intent.media_id)) return "ID de mídia inválido.";
  if (!isImageMediaMime(intent.mime_type)) return "A foto precisa ser JPG, PNG ou WebP.";
  if (!Number.isFinite(intent.byte_size) || intent.byte_size <= 0) return "Tamanho de foto inválido.";
  if (intent.byte_size > IMAGE_MEDIA_MAX_BYTES) return "A foto deve ter no máximo 5 MB.";
  if (!Number.isInteger(intent.position) || intent.position < 0) return "Posição de foto inválida.";
  return null;
}

export function assertUniqueMediaIds(intents: MemoryMediaUploadIntent[]) {
  const ids = intents.map((item) => item.media_id);
  if (new Set(ids).size !== ids.length) throw new Error("IDs de fotos duplicados na mesma intenção.");
}

export async function resolveMemoryMediaPrepareStatus(
  supabase: SupabaseClient,
  householdId: string,
  memoryId: string,
  intent: MemoryMediaUploadIntent,
): Promise<PrepareMemoryMediaStatus> {
  const { data: linked } = await supabase
    .from("memory_media")
    .select("id")
    .eq("id", intent.media_id)
    .eq("memory_id", memoryId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (linked) return "already-linked";

  const path = canonicalMemoryMediaPath(householdId, memoryId, intent.media_id, intent.mime_type);
  if (await storageObjectExistsAtPath(supabase, path)) return "already-uploaded";
  return "upload-required";
}

export async function prepareOneMemoryMediaUpload(
  supabase: SupabaseClient,
  householdId: string,
  memoryId: string,
  intent: MemoryMediaUploadIntent,
): Promise<PrepareMemoryMediaResult | { ok: false; message: string }> {
  const metaError = validateMemoryMediaIntent(intent);
  if (metaError) return { ok: false, message: metaError };

  const storage_path = canonicalMemoryMediaPath(householdId, memoryId, intent.media_id, intent.mime_type);
  const status = await resolveMemoryMediaPrepareStatus(supabase, householdId, memoryId, intent);

  if (status === "already-linked" || status === "already-uploaded") {
    return {
      media_id: intent.media_id,
      status,
      storage_path,
      bucket: PET_MEDIA_BUCKET,
      mime_type: intent.mime_type,
      byte_size: intent.byte_size,
      original_filename: intent.original_filename,
      position: intent.position,
      will_create_object: false,
    };
  }

  const signed = await createSignedUploadForPath(supabase, storage_path);
  if ("error" in signed) return { ok: false, message: signed.error || "Não foi possível autorizar o envio." };
  if ("alreadyExists" in signed) {
    return {
      media_id: intent.media_id,
      status: "already-uploaded",
      storage_path,
      bucket: PET_MEDIA_BUCKET,
      mime_type: intent.mime_type,
      byte_size: intent.byte_size,
      original_filename: intent.original_filename,
      position: intent.position,
      will_create_object: false,
    };
  }

  return {
    media_id: intent.media_id,
    status: "upload-required",
    storage_path,
    token: signed.token,
    bucket: PET_MEDIA_BUCKET,
    mime_type: intent.mime_type,
    byte_size: intent.byte_size,
    original_filename: intent.original_filename,
    position: intent.position,
    will_create_object: true,
  };
}

export async function validateStoredMemoryMediaObject(
  supabase: SupabaseClient,
  householdId: string,
  memoryId: string,
  intent: MemoryMediaUploadIntent,
): Promise<{ ok: true; byte_size: number; storage_path: string } | { ok: false; message: string; storage_path: string }> {
  const storage_path = canonicalMemoryMediaPath(householdId, memoryId, intent.media_id, intent.mime_type);
  assertMemoryMediaStoragePath(householdId, memoryId, storage_path);

  const { data, error } = await supabase.storage.from(PET_MEDIA_BUCKET).download(storage_path);
  if (error || !data) {
    return { ok: false, message: "Foto não encontrada no armazenamento.", storage_path };
  }
  const buffer = new Uint8Array(await data.arrayBuffer());
  if (buffer.byteLength <= 0) return { ok: false, message: "Arquivo vazio.", storage_path };
  if (buffer.byteLength > IMAGE_MEDIA_MAX_BYTES) {
    return { ok: false, message: "A foto deve ter no máximo 5 MB.", storage_path };
  }
  if (!assertImageMagicBytes(intent.mime_type, buffer.slice(0, 16))) {
    return {
      ok: false,
      message: "O arquivo não parece corresponder ao formato informado.",
      storage_path,
    };
  }
  return { ok: true, byte_size: buffer.byteLength, storage_path };
}
