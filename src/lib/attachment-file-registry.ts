/**
 * Client-only registry of File blobs keyed by stable attachment_id.
 * Pickers register files here instead of putting binaries into Server Action FormData.
 */
const filesByAttachmentId = new Map<string, File>();

export function registerPendingAttachmentFile(attachmentId: string, file: File) {
  filesByAttachmentId.set(attachmentId, file);
}

export function unregisterPendingAttachmentFile(attachmentId: string) {
  filesByAttachmentId.delete(attachmentId);
}

export function getPendingAttachmentFile(attachmentId: string): File | undefined {
  return filesByAttachmentId.get(attachmentId);
}

export function clearPendingAttachmentFiles(attachmentIds?: string[]) {
  if (!attachmentIds) {
    filesByAttachmentId.clear();
    return;
  }
  for (const id of attachmentIds) filesByAttachmentId.delete(id);
}

export function listPendingAttachmentIds(): string[] {
  return [...filesByAttachmentId.keys()];
}
