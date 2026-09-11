import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_DOCUMENT,
  assertAttachmentStoragePath,
  buildAttachmentStoragePath,
  extensionForMime,
  isAllowedAttachmentMime,
  isStorageObjectAlreadyExists,
  isUuid,
  mimeMatchesMagicBytes,
  normalizeDisplayNameInput,
  removeStoragePaths,
  sanitizeOriginalFilename,
  type AttachmentMimeType,
} from "@/lib/attachments";
import { PET_MEDIA_BUCKET } from "@/lib/pets";

export { PET_MEDIA_BUCKET };

/** Metadata-only attachment intent (never includes File/Blob). */
export type AttachmentUploadIntent = {
  attachment_id: string;
  original_filename: string;
  display_name: string | null;
  mime_type: AttachmentMimeType;
  byte_size: number;
  /** Clinical create scope — optional for documents. */
  pet_id?: string | null;
  care_type?: string | null;
};

export type PrepareAttachmentUploadStatus = "already-linked" | "already-uploaded" | "upload-required";

export type PrepareAttachmentUploadResult = {
  attachment_id: string;
  status: PrepareAttachmentUploadStatus;
  storage_path: string;
  /** Present only when status === upload-required */
  token?: string;
  bucket: string;
  mime_type: AttachmentMimeType;
  original_filename: string;
  display_name: string | null;
  byte_size: number;
  pet_id?: string | null;
  care_type?: string | null;
  /** True when this prepare issued a brand-new signed URL (upload may create a new object). */
  will_create_object: boolean;
};

export type FinalizedAttachmentPayload = {
  id: string;
  storage_path: string;
  original_filename: string;
  display_name: string | null;
  mime_type: AttachmentMimeType;
  byte_size: number;
  position: number;
};

const ATTACHMENTS_PAYLOAD_FIELD = "attachments_payload";

export function attachmentsPayloadFieldName() {
  return ATTACHMENTS_PAYLOAD_FIELD;
}

export function parseAttachmentsPayload(raw: string): AttachmentUploadIntent[] {
  if (!raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Metadados de anexos inválidos. Recarregue a página.");
  }
  if (!Array.isArray(parsed)) throw new Error("Metadados de anexos inválidos.");
  return parsed.map((entry, index) => normalizeIntent(entry, index));
}

function normalizeIntent(entry: unknown, index: number): AttachmentUploadIntent {
  if (!entry || typeof entry !== "object") {
    throw new Error(`Anexo #${index + 1} inválido.`);
  }
  const row = entry as Record<string, unknown>;
  const attachment_id = String(row.attachment_id ?? "").trim();
  const mime_type = String(row.mime_type ?? "").trim();
  const byte_size = Number(row.byte_size);
  const original_filename = sanitizeOriginalFilename(String(row.original_filename ?? "arquivo"));
  let display_name: string | null = null;
  try {
    display_name = normalizeDisplayNameInput(String(row.display_name ?? ""));
  } catch (error) {
    throw error instanceof Error ? error : new Error("Nome de arquivo inválido.");
  }
  if (!isUuid(attachment_id)) throw new Error("ID de anexo inválido.");
  if (!isAllowedAttachmentMime(mime_type)) throw new Error("Tipo de arquivo não permitido.");
  if (!Number.isFinite(byte_size) || byte_size <= 0) throw new Error("Tamanho de arquivo inválido.");
  if (byte_size > ATTACHMENT_MAX_BYTES) throw new Error("Este arquivo ultrapassa o limite de 5 MB.");
  return {
    attachment_id,
    original_filename,
    display_name,
    mime_type,
    byte_size,
    pet_id: row.pet_id ? String(row.pet_id) : null,
    care_type: row.care_type ? String(row.care_type) : null,
  };
}

export function validateIntentMetadata(intent: AttachmentUploadIntent): string | null {
  if (!isUuid(intent.attachment_id)) return "ID de anexo inválido.";
  if (!isAllowedAttachmentMime(intent.mime_type)) return "Tipo de arquivo não permitido.";
  if (!Number.isFinite(intent.byte_size) || intent.byte_size <= 0) return "Tamanho de arquivo inválido.";
  if (intent.byte_size > ATTACHMENT_MAX_BYTES) return "Este arquivo ultrapassa o limite de 5 MB.";
  return null;
}

export function canonicalAttachmentPath(householdId: string, intent: AttachmentUploadIntent): string {
  return buildAttachmentStoragePath(householdId, intent.attachment_id, intent.mime_type);
}

export async function storageObjectExists(
  supabase: SupabaseClient,
  householdId: string,
  storagePath: string,
): Promise<boolean> {
  assertAttachmentStoragePath(householdId, storagePath);
  const folder = storagePath.split("/").slice(0, -1).join("/");
  const fileName = storagePath.split("/").pop() ?? "";
  const { data, error } = await supabase.storage.from(PET_MEDIA_BUCKET).list(folder, {
    limit: 20,
    search: fileName,
  });
  if (error) return false;
  return (data ?? []).some((item) => item.name === fileName);
}

export async function isAttachmentLinkedAnywhere(
  supabase: SupabaseClient,
  attachmentId: string,
): Promise<boolean> {
  const [{ data: health }, { data: docs }] = await Promise.all([
    supabase.from("health_record_attachments").select("attachment_id").eq("attachment_id", attachmentId).limit(1),
    supabase.from("document_attachments").select("attachment_id").eq("attachment_id", attachmentId).limit(1),
  ]);
  return Boolean(health?.length || docs?.length);
}

export async function attachmentRowExists(
  supabase: SupabaseClient,
  attachmentId: string,
  householdId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("attachments")
    .select("id")
    .eq("id", attachmentId)
    .eq("household_id", householdId)
    .maybeSingle();
  return Boolean(data?.id);
}

/**
 * Resolve prepare status for one intent (pure decision + IO checks).
 * Does not create signed URLs.
 */
export async function resolvePrepareStatus(
  supabase: SupabaseClient,
  householdId: string,
  intent: AttachmentUploadIntent,
): Promise<PrepareAttachmentUploadStatus> {
  const linked = await isAttachmentLinkedAnywhere(supabase, intent.attachment_id);
  if (linked) return "already-linked";
  const path = canonicalAttachmentPath(householdId, intent);
  const exists = await storageObjectExists(supabase, householdId, path);
  if (exists) return "already-uploaded";
  const row = await attachmentRowExists(supabase, intent.attachment_id, householdId);
  if (row) return "already-uploaded";
  return "upload-required";
}

export async function createSignedUploadForPath(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<{ token: string; path: string } | { alreadyExists: true } | { error: string }> {
  const { data, error } = await supabase.storage.from(PET_MEDIA_BUCKET).createSignedUploadUrl(storagePath);
  if (error) {
    if (isStorageObjectAlreadyExists(error)) return { alreadyExists: true };
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("already exists") || message.includes("resource already exists") || String((error as { statusCode?: string }).statusCode) === "409") {
      return { alreadyExists: true };
    }
    return { error: error.message };
  }
  if (!data?.token) return { error: "Não foi possível autorizar o envio do arquivo." };
  return { token: data.token, path: data.path ?? storagePath };
}

/** Download object and validate magic bytes + size. Returns actual byte size. */
export async function validateStoredAttachmentObject(
  supabase: SupabaseClient,
  householdId: string,
  intent: AttachmentUploadIntent,
): Promise<{ ok: true; byte_size: number; storage_path: string } | { ok: false; message: string; storage_path: string }> {
  const storage_path = canonicalAttachmentPath(householdId, intent);
  assertAttachmentStoragePath(householdId, storage_path);

  const { data, error } = await supabase.storage.from(PET_MEDIA_BUCKET).download(storage_path);
  if (error || !data) {
    return { ok: false, message: "Arquivo não encontrado no armazenamento.", storage_path };
  }

  const buffer = new Uint8Array(await data.arrayBuffer());
  if (buffer.byteLength <= 0) {
    return { ok: false, message: "Arquivo vazio.", storage_path };
  }
  if (buffer.byteLength > ATTACHMENT_MAX_BYTES) {
    return { ok: false, message: "Este arquivo ultrapassa o limite de 5 MB.", storage_path };
  }
  const header = buffer.slice(0, 16);
  if (!mimeMatchesMagicBytes(intent.mime_type, header)) {
    return {
      ok: false,
      message: "O arquivo não parece corresponder ao formato informado.",
      storage_path,
    };
  }
  return { ok: true, byte_size: buffer.byteLength, storage_path };
}

export function toRpcAttachmentPayload(
  items: Array<AttachmentUploadIntent & { storage_path: string; byte_size: number }>,
  startingPosition = 0,
): FinalizedAttachmentPayload[] {
  return items.map((item, index) => ({
    id: item.attachment_id,
    storage_path: item.storage_path,
    original_filename: item.original_filename,
    display_name: item.display_name,
    mime_type: item.mime_type,
    byte_size: item.byte_size,
    position: startingPosition + index,
  }));
}

export function filterIntentsForScope(
  intents: AttachmentUploadIntent[],
  careType: string,
  petId: string,
): AttachmentUploadIntent[] {
  return intents.filter((item) => {
    if (item.pet_id && item.care_type) {
      return item.pet_id === petId && item.care_type === careType;
    }
    // Edit / single-type fields without pet id — match care type only.
    if (item.care_type && !item.pet_id) {
      return item.care_type === careType;
    }
    // Never apply unscoped intents across clinical pet×type buckets.
    return false;
  });
}

export function assertUniqueAttachmentIds(intents: AttachmentUploadIntent[]) {
  const ids = intents.map((item) => item.attachment_id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("IDs de anexos duplicados na mesma intenção.");
  }
}

export function assertAttachmentCount(existingCount: number, incomingCount: number, entityLabel = "registro") {
  if (existingCount + incomingCount > ATTACHMENT_MAX_PER_DOCUMENT) {
    throw new Error(`Um ${entityLabel} pode ter no máximo ${ATTACHMENT_MAX_PER_DOCUMENT} arquivos.`);
  }
}

export async function compensateNewStoragePaths(
  supabase: SupabaseClient,
  paths: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await removeStoragePaths(supabase, paths);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Falha ao limpar arquivos temporários." };
  }
}

/** Expected extension segment for tests / docs. */
export function expectedFileNameForMime(mimeType: AttachmentMimeType) {
  return `file.${extensionForMime(mimeType)}`;
}
