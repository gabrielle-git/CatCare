import type { SupabaseClient } from "@supabase/supabase-js";
import { createAttachmentSignedUrl } from "@/lib/attachments";
import type { Attachment, AttachmentWithUrl, HealthRecordAttachment } from "@/types/database";

type LinkRow = HealthRecordAttachment & { attachments: Attachment | Attachment[] | null };

export async function listHealthRecordAttachments(
  supabase: SupabaseClient,
  healthRecordId: string,
): Promise<AttachmentWithUrl[]> {
  const { data: links, error } = await supabase
    .from("health_record_attachments")
    .select("health_record_id, attachment_id, household_id, position, created_at, attachments(*)")
    .eq("health_record_id", healthRecordId)
    .order("position", { ascending: true });
  if (error) throw error;

  const rows = (links ?? []) as unknown as LinkRow[];
  const attachments = await Promise.all(
    rows.map(async (link) => {
      const raw = link.attachments;
      const attachment = Array.isArray(raw) ? raw[0] : raw;
      if (!attachment) return null;
      const url = await createAttachmentSignedUrl(supabase, attachment.storage_path);
      return { ...attachment, url, position: link.position } satisfies AttachmentWithUrl;
    }),
  );
  return attachments.filter((row): row is AttachmentWithUrl => row != null);
}

export async function countHealthRecordAttachments(
  supabase: SupabaseClient,
  healthRecordId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("health_record_attachments")
    .select("attachment_id", { count: "exact", head: true })
    .eq("health_record_id", healthRecordId);
  if (error) throw error;
  return count ?? 0;
}
