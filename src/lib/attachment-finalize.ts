import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertAttachmentCount,
  assertUniqueAttachmentIds,
  attachmentsPayloadFieldName,
  filterIntentsForScope,
  parseAttachmentsPayload,
  toRpcAttachmentPayload,
  validateStoredAttachmentObject,
  type AttachmentUploadIntent,
  compensateNewStoragePaths,
} from "@/lib/attachment-direct-upload";
import { removeStoragePaths } from "@/lib/attachments";

/**
 * Read metadata-only attachments_payload from FormData.
 * Returns [] when absent (no new files).
 */
export function readAttachmentsPayload(formData: FormData): AttachmentUploadIntent[] {
  const raw = String(formData.get(attachmentsPayloadFieldName()) ?? "").trim();
  if (!raw) return [];
  const intents = parseAttachmentsPayload(raw);
  assertUniqueAttachmentIds(intents);
  return intents;
}

export type FinalizeAttachmentsResult =
  | { ok: true; payload: ReturnType<typeof toRpcAttachmentPayload> }
  | { ok: false; message: string };

/**
 * After direct upload: validate Storage objects server-side (magic bytes + size),
 * skip already-linked ids, return RPC payload. Removes invalid objects when possible.
 */
export async function finalizeDirectUploadedAttachments(options: {
  supabase: SupabaseClient;
  householdId: string;
  intents: AttachmentUploadIntent[];
  alreadyLinkedIds: Set<string>;
  existingCount: number;
  entityLabel: string;
  startingPosition?: number;
}): Promise<FinalizeAttachmentsResult> {
  const {
    supabase,
    householdId,
    intents,
    alreadyLinkedIds,
    existingCount,
    entityLabel,
    startingPosition = 0,
  } = options;

  const pending = intents.filter((item) => !alreadyLinkedIds.has(item.attachment_id));
  if (pending.length === 0) return { ok: true, payload: [] };

  try {
    assertAttachmentCount(existingCount, pending.length, entityLabel);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Limite de arquivos excedido." };
  }

  const validated: Array<AttachmentUploadIntent & { storage_path: string; byte_size: number }> = [];

  for (const intent of pending) {
    const result = await validateStoredAttachmentObject(supabase, householdId, intent);
    if (!result.ok) {
      await removeStoragePaths(supabase, [result.storage_path]).catch(() => undefined);
      return { ok: false, message: result.message };
    }
    validated.push({
      ...intent,
      storage_path: result.storage_path,
      byte_size: result.byte_size,
    });
  }

  return { ok: true, payload: toRpcAttachmentPayload(validated, startingPosition) };
}

export { filterIntentsForScope, compensateNewStoragePaths, attachmentsPayloadFieldName };
