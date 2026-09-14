/**
 * Shared form id for removing a clinical attachment from the health-record edit page.
 * Must be imported independently by the Server page and Client UI — never passed as a
 * Client Component prop (functions are not RSC-serializable).
 */
export function healthRecordAttachmentRemoveFormId(attachmentId: string) {
  return `remove-health-attachment-${attachmentId}`;
}
