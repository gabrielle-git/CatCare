import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/attachments";
import { createSignedUploadForPath } from "@/lib/attachment-direct-upload";
import {
  assertImageMagicBytes,
  extensionForImageMime,
  IMAGE_MEDIA_MAX_BYTES,
  isImageMediaMime,
  type ImageMediaMimeType,
} from "@/lib/image-media";
import { PET_MEDIA_BUCKET } from "@/lib/pets";
import { storageObjectExistsAtPath } from "@/lib/memory-media-upload";

export type PetPhotoUploadIntent = {
  photo_intent_id: string;
  mime_type: ImageMediaMimeType;
  byte_size: number;
  original_filename: string;
};

export type PreparePetPhotoStatus = "already-uploaded" | "upload-required";

export type PreparePetPhotoResult = {
  photo_intent_id: string;
  status: PreparePetPhotoStatus;
  storage_path: string;
  token?: string;
  bucket: string;
  mime_type: ImageMediaMimeType;
  byte_size: number;
  will_create_object: boolean;
};

const PET_PHOTO_PAYLOAD_FIELD = "pet_photo_payload";

export function petPhotoPayloadFieldName() {
  return PET_PHOTO_PAYLOAD_FIELD;
}

/**
 * Deterministic profile photo path for retries.
 * Legacy photos remain `{hid}/{petId}/profile-{uuid}.{ext}` and continue to render.
 * New uploads: `{hid}/{petId}/profile/{photo_intent_id}.{ext}`
 */
export function canonicalPetPhotoPath(
  householdId: string,
  petId: string,
  photoIntentId: string,
  mimeType: ImageMediaMimeType,
): string {
  if (!isUuid(householdId) || !isUuid(petId) || !isUuid(photoIntentId)) {
    throw new Error("IDs inválidos para path de foto do pet.");
  }
  return `${householdId}/${petId}/profile/${photoIntentId}.${extensionForImageMime(mimeType)}`;
}

export function assertPetPhotoStoragePath(householdId: string, petId: string, storagePath: string) {
  const prefix = `${householdId}/${petId}/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes("..")) {
    throw new Error("Caminho de foto do pet inválido.");
  }
}

export function parsePetPhotoPayload(raw: string): PetPhotoUploadIntent | null {
  if (!raw.trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Metadados de foto inválidos. Recarregue a página.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Metadados de foto inválidos.");
  const row = parsed as Record<string, unknown>;
  const photo_intent_id = String(row.photo_intent_id ?? "").trim();
  const mime_type = String(row.mime_type ?? "").trim();
  const byte_size = Number(row.byte_size);
  const original_filename = String(row.original_filename ?? "foto").trim() || "foto";
  if (!isUuid(photo_intent_id)) throw new Error("Intenção de foto inválida.");
  if (!isImageMediaMime(mime_type)) throw new Error("Use uma foto JPG, PNG ou WebP.");
  if (!Number.isFinite(byte_size) || byte_size <= 0) throw new Error("Tamanho de foto inválido.");
  if (byte_size > IMAGE_MEDIA_MAX_BYTES) throw new Error("A foto deve ter no máximo 5 MB.");
  return { photo_intent_id, mime_type, byte_size, original_filename };
}

export async function preparePetPhotoUpload(
  supabase: SupabaseClient,
  householdId: string,
  petId: string,
  intent: PetPhotoUploadIntent,
): Promise<PreparePetPhotoResult | { ok: false; message: string }> {
  const storage_path = canonicalPetPhotoPath(householdId, petId, intent.photo_intent_id, intent.mime_type);
  if (await storageObjectExistsAtPath(supabase, storage_path)) {
    return {
      photo_intent_id: intent.photo_intent_id,
      status: "already-uploaded",
      storage_path,
      bucket: PET_MEDIA_BUCKET,
      mime_type: intent.mime_type,
      byte_size: intent.byte_size,
      will_create_object: false,
    };
  }

  const signed = await createSignedUploadForPath(supabase, storage_path);
  if ("error" in signed) return { ok: false, message: signed.error || "Não foi possível autorizar o envio." };
  if ("alreadyExists" in signed) {
    return {
      photo_intent_id: intent.photo_intent_id,
      status: "already-uploaded",
      storage_path,
      bucket: PET_MEDIA_BUCKET,
      mime_type: intent.mime_type,
      byte_size: intent.byte_size,
      will_create_object: false,
    };
  }

  return {
    photo_intent_id: intent.photo_intent_id,
    status: "upload-required",
    storage_path,
    token: signed.token,
    bucket: PET_MEDIA_BUCKET,
    mime_type: intent.mime_type,
    byte_size: intent.byte_size,
    will_create_object: true,
  };
}

export async function validateStoredPetPhotoObject(
  supabase: SupabaseClient,
  householdId: string,
  petId: string,
  intent: PetPhotoUploadIntent,
): Promise<{ ok: true; byte_size: number; storage_path: string } | { ok: false; message: string; storage_path: string }> {
  const storage_path = canonicalPetPhotoPath(householdId, petId, intent.photo_intent_id, intent.mime_type);
  assertPetPhotoStoragePath(householdId, petId, storage_path);

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
