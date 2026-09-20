"use client";

import {
  compensatePetPhotoUploadsAction,
  preparePetPhotoUploadAction,
} from "@/app/(app)/pets/photo-upload-actions";
import { isImageMediaMime, IMAGE_MEDIA_MAX_BYTES } from "@/lib/image-media";
import { petPhotoPayloadFieldName, type PetPhotoUploadIntent } from "@/lib/pet-photo-upload";
import { createClient } from "@/lib/supabase/client";

export type PetPhotoUploadProgress = {
  phase: "preparing" | "uploading" | "finalizing";
  message: string;
};

/**
 * Direct-upload a single pet profile photo. Strips File from FormData and writes pet_photo_payload.
 */
export async function runDirectPetPhotoUpload(
  formData: FormData,
  petId: string,
  photoIntentId: string,
  file: File | null,
  onProgress?: (progress: PetPhotoUploadProgress) => void,
): Promise<{ newlyCreatedPaths: string[] }> {
  formData.delete("photo");
  if (!file || file.size === 0) {
    formData.delete(petPhotoPayloadFieldName());
    return { newlyCreatedPaths: [] };
  }
  if (!isImageMediaMime(file.type)) {
    throw new Error("Use uma foto JPG, PNG ou WebP.");
  }
  if (file.size > IMAGE_MEDIA_MAX_BYTES) {
    throw new Error("A foto deve ter no máximo 5 MB.");
  }

  const intent: PetPhotoUploadIntent = {
    photo_intent_id: photoIntentId,
    mime_type: file.type,
    byte_size: file.size,
    original_filename: file.name || "foto",
  };

  onProgress?.({ phase: "preparing", message: "Preparando envio da foto..." });
  const prepared = await preparePetPhotoUploadAction(petId, intent);
  if (!prepared.ok) throw new Error(prepared.message);
  const result = prepared.result;

  const newlyCreatedPaths: string[] = [];
  if (result.status === "upload-required") {
    if (!result.token) throw new Error("Não foi possível enviar a foto. Tente novamente.");
    onProgress?.({ phase: "uploading", message: "Enviando foto..." });
    const supabase = createClient();
    const { error } = await supabase.storage.from(result.bucket).uploadToSignedUrl(result.storage_path, result.token, file, {
      contentType: result.mime_type,
      upsert: false,
    });
    if (error) {
      const message = (error.message ?? "").toLowerCase();
      if (!(message.includes("already exists") || message.includes("resource already exists"))) {
        throw new Error("Não foi possível enviar a foto. Tente novamente.");
      }
    } else if (result.will_create_object) {
      newlyCreatedPaths.push(result.storage_path);
    }
  }

  formData.set(petPhotoPayloadFieldName(), JSON.stringify(intent));
  formData.delete("photo");
  onProgress?.({ phase: "finalizing", message: "Salvando..." });
  return { newlyCreatedPaths };
}

export async function compensatePetPhotoIfNeeded(paths: string[]) {
  if (!paths.length) return;
  await compensatePetPhotoUploadsAction(paths);
}
