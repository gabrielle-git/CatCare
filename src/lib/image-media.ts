import { isUuid, mimeMatchesMagicBytes, type AttachmentMimeType } from "@/lib/attachments";

/** Image-only MIME for Memory media and Pet photo (never PDF). */
export type ImageMediaMimeType = Extract<AttachmentMimeType, "image/jpeg" | "image/png" | "image/webp">;

export const IMAGE_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const MEMORY_MEDIA_MAX_PHOTOS = 8;

const IMAGE_EXTENSIONS: Record<ImageMediaMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isImageMediaMime(value: string): value is ImageMediaMimeType {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

export function extensionForImageMime(mimeType: ImageMediaMimeType): string {
  return IMAGE_EXTENSIONS[mimeType];
}

export function assertImageMagicBytes(mimeType: ImageMediaMimeType, header: Uint8Array): boolean {
  return mimeMatchesMagicBytes(mimeType, header);
}

export function requireUuid(value: string, label: string): string {
  if (!isUuid(value)) throw new Error(`${label} inválido.`);
  return value;
}
