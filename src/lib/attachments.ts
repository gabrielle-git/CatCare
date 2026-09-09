import type { SupabaseClient } from "@supabase/supabase-js";
import { PET_MEDIA_BUCKET } from "@/lib/pets";

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_MAX_PER_DOCUMENT = 8;
export const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 30;
export const ATTACHMENT_FILENAME_MAX_LENGTH = 180;

export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type AttachmentMimeType = (typeof ATTACHMENT_ALLOWED_MIME_TYPES)[number];

const MIME_EXTENSIONS: Record<AttachmentMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const DOCUMENT_CATEGORY_SUGGESTIONS = [
  { value: "Carteira de vacinação", label: "Carteira de vacinação" },
  { value: "Microchip", label: "Microchip" },
  { value: "Plano de saúde", label: "Plano de saúde" },
  { value: "Adoção", label: "Adoção" },
  { value: "Pedigree", label: "Pedigree" },
  { value: "Passaporte", label: "Passaporte" },
  { value: "Identificação", label: "Identificação" },
  { value: "other", label: "Outro" },
] as const;

export type ValidatedAttachmentFile = {
  file: File;
  mimeType: AttachmentMimeType;
  extension: string;
  originalFilename: string;
  byteSize: number;
};

export function isAllowedAttachmentMime(value: string): value is AttachmentMimeType {
  return (ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export function extensionForMime(mimeType: AttachmentMimeType): string {
  return MIME_EXTENSIONS[mimeType];
}

/** Strip path segments, control chars, and clamp length for display/download names. */
export function sanitizeOriginalFilename(raw: string): string {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "";
  const withoutControls = [...base]
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code < 32 || code === 127 ? "_" : ch;
    })
    .join("")
    .replace(/^\.+/, "")
    .trim();
  const cleaned = withoutControls || "arquivo";
  if (cleaned.length <= ATTACHMENT_FILENAME_MAX_LENGTH) return cleaned;
  const extMatch = cleaned.match(/(\.[A-Za-z0-9]{1,12})$/);
  const ext = extMatch?.[1] ?? "";
  const stem = cleaned.slice(0, ATTACHMENT_FILENAME_MAX_LENGTH - ext.length);
  return `${stem}${ext}`;
}

function bytesMatchJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function bytesMatchPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function bytesMatchWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return riff === "RIFF" && webp === "WEBP";
}

function bytesMatchPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]) === "%PDF-";
}

/** Detect MIME from magic bytes. Returns null when unrecognized. */
export function detectMimeFromMagicBytes(bytes: Uint8Array): AttachmentMimeType | null {
  if (bytesMatchJpeg(bytes)) return "image/jpeg";
  if (bytesMatchPng(bytes)) return "image/png";
  if (bytesMatchWebp(bytes)) return "image/webp";
  if (bytesMatchPdf(bytes)) return "application/pdf";
  return null;
}

export function mimeMatchesMagicBytes(mimeType: AttachmentMimeType, bytes: Uint8Array): boolean {
  return detectMimeFromMagicBytes(bytes) === mimeType;
}

export function buildAttachmentStoragePath(householdId: string, attachmentId: string, mimeType: AttachmentMimeType): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(householdId)) {
    throw new Error("household_id inválido para path de Storage.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attachmentId)) {
    throw new Error("attachment_id inválido para path de Storage.");
  }
  const extension = extensionForMime(mimeType);
  // Stable object name so retries of the same attachment id do not create orphan objects.
  return `${householdId}/attachments/${attachmentId}/file.${extension}`;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function localFileSelectionKey(file: { name: string; size: number; lastModified: number }): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export type LocalSelectedFile<T extends { name: string; size: number; lastModified: number } = File> = {
  id: string;
  key: string;
  file: T;
};

export function mergeLocalFileSelections<T extends { name: string; size: number; lastModified: number }>(
  existing: LocalSelectedFile<T>[],
  incoming: T[],
  options?: {
    maxTotal?: number;
    existingStoredCount?: number;
    createId?: () => string;
  },
): { items: LocalSelectedFile<T>[]; truncated: boolean; skippedDuplicates: number } {
  const maxTotal = options?.maxTotal ?? ATTACHMENT_MAX_PER_DOCUMENT;
  const existingStoredCount = options?.existingStoredCount ?? 0;
  const createId = options?.createId ?? (() => crypto.randomUUID());
  const items = [...existing];
  const keys = new Set(existing.map((item) => item.key));
  let skippedDuplicates = 0;
  let truncated = false;

  for (const file of incoming) {
    const key = localFileSelectionKey(file);
    if (keys.has(key)) {
      skippedDuplicates += 1;
      continue;
    }
    if (existingStoredCount + items.length >= maxTotal) {
      truncated = true;
      break;
    }
    keys.add(key);
    items.push({ id: createId(), key, file });
  }

  return { items, truncated, skippedDuplicates };
}

export type DocumentCreateOwnershipResult =
  | { ok: true; status: "create" | "reuse" }
  | { ok: false; reason: "invalid_id" | "foreign_household" | "pet_mismatch" };

/** Pure ownership/idempotency decision for create retries with a stable document_id. */
export function resolveDocumentCreateOwnership(
  documentId: string,
  expectedHouseholdId: string,
  expectedPetId: string,
  existing: { id: string; household_id: string; pet_id: string | null } | null,
): DocumentCreateOwnershipResult {
  if (!isUuid(documentId)) return { ok: false, reason: "invalid_id" };
  if (!existing) return { ok: true, status: "create" };
  if (existing.household_id !== expectedHouseholdId) return { ok: false, reason: "foreign_household" };
  if (existing.pet_id !== expectedPetId) return { ok: false, reason: "pet_mismatch" };
  return { ok: true, status: "reuse" };
}

export function isStorageObjectAlreadyExists(error: { message?: string; statusCode?: string | number } | null | undefined): boolean {
  if (!error) return false;
  const code = String(error.statusCode ?? "");
  const message = (error.message ?? "").toLowerCase();
  return code === "409" || message.includes("already exists") || message.includes("resource already exists");
}

export function assertAttachmentStoragePath(householdId: string, storagePath: string) {
  const expectedPrefix = `${householdId}/attachments/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    throw new Error("storage_path fora do prefixo da família.");
  }
}

export async function validateAttachmentFile(file: File): Promise<{ ok: true; value: ValidatedAttachmentFile } | { ok: false; message: string }> {
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, message: "Arquivo inválido." };
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false, message: `O arquivo “${file.name}” deve ter no máximo 5 MB.` };
  }
  if (!isAllowedAttachmentMime(file.type)) {
    return { ok: false, message: `O arquivo “${file.name}” precisa ser JPG, PNG, WebP ou PDF.` };
  }
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!mimeMatchesMagicBytes(file.type, header)) {
    return { ok: false, message: `O conteúdo de “${file.name}” não corresponde ao tipo declarado.` };
  }
  return {
    ok: true,
    value: {
      file,
      mimeType: file.type,
      extension: extensionForMime(file.type),
      originalFilename: sanitizeOriginalFilename(file.name),
      byteSize: file.size,
    },
  };
}

export async function validateAttachmentFiles(
  files: File[],
  options?: { required?: boolean; existingCount?: number },
): Promise<{ ok: true; values: ValidatedAttachmentFile[] } | { ok: false; message: string }> {
  const required = options?.required ?? true;
  const existingCount = options?.existingCount ?? 0;
  if (required && files.length === 0) {
    return { ok: false, message: "Adicione ao menos um arquivo." };
  }
  if (existingCount + files.length > ATTACHMENT_MAX_PER_DOCUMENT) {
    return { ok: false, message: `Um documento pode ter no máximo ${ATTACHMENT_MAX_PER_DOCUMENT} arquivos.` };
  }
  const values: ValidatedAttachmentFile[] = [];
  for (const file of files) {
    const result = await validateAttachmentFile(file);
    if (!result.ok) return result;
    values.push(result.value);
  }
  return { ok: true, values };
}

export type PreparedAttachmentUpload = {
  id: string;
  storage_path: string;
  original_filename: string;
  mime_type: AttachmentMimeType;
  byte_size: number;
  position: number;
  file: File;
};

export function prepareAttachmentUploads(
  householdId: string,
  files: ValidatedAttachmentFile[],
  startingPosition = 0,
  attachmentIds?: string[],
): PreparedAttachmentUpload[] {
  if (attachmentIds && attachmentIds.length !== files.length) {
    throw new Error("IDs de anexos incompatíveis com os arquivos.");
  }
  if (attachmentIds?.some((id) => !isUuid(id))) {
    throw new Error("ID de anexo inválido.");
  }
  return files.map((item, index) => {
    const id = attachmentIds?.[index] ?? crypto.randomUUID();
    return {
      id,
      storage_path: buildAttachmentStoragePath(householdId, id, item.mimeType),
      original_filename: item.originalFilename,
      mime_type: item.mimeType,
      byte_size: item.byteSize,
      position: startingPosition + index,
      file: item.file,
    };
  });
}

export async function uploadPreparedAttachments(
  supabase: SupabaseClient,
  prepared: PreparedAttachmentUpload[],
): Promise<string[]> {
  const uploaded: string[] = [];
  try {
    for (const item of prepared) {
      assertAttachmentStoragePath(item.storage_path.split("/")[0], item.storage_path);
      const { error } = await supabase.storage.from(PET_MEDIA_BUCKET).upload(item.storage_path, item.file, {
        contentType: item.mime_type,
        cacheControl: "3600",
        upsert: false,
      });
      if (error && !isStorageObjectAlreadyExists(error)) throw error;
      uploaded.push(item.storage_path);
    }
    return uploaded;
  } catch (error) {
    // Only remove objects this attempt newly created when the batch fails mid-way.
    // Paths are stable per attachment id; callers decide cleanup on true failure.
    if (uploaded.length) await supabase.storage.from(PET_MEDIA_BUCKET).remove(uploaded);
    throw error;
  }
}

export async function removeStoragePaths(supabase: SupabaseClient, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  for (let index = 0; index < unique.length; index += 100) {
    const chunk = unique.slice(index, index + 100);
    const { error } = await supabase.storage.from(PET_MEDIA_BUCKET).remove(chunk);
    if (error) throw new Error(error.message);
  }
}

export async function createAttachmentSignedUrl(supabase: SupabaseClient, storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PET_MEDIA_BUCKET)
    .createSignedUrl(storagePath, ATTACHMENT_SIGNED_URL_TTL_SECONDS);
  return error ? null : data.signedUrl;
}

export function contentDispositionAttachment(filename: string): string {
  const safe = sanitizeOriginalFilename(filename).replace(/"/g, "");
  const encoded = encodeURIComponent(safe);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export function attachmentPayloadForRpc(prepared: PreparedAttachmentUpload[]) {
  return prepared.map(({ id, storage_path, original_filename, mime_type, byte_size, position }) => ({
    id,
    storage_path,
    original_filename,
    mime_type,
    byte_size,
    position,
  }));
}
