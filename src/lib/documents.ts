import type { SupabaseClient } from "@supabase/supabase-js";
import { createAttachmentSignedUrl } from "@/lib/attachments";
import type { Attachment, Document, DocumentAttachment, DocumentWithAttachments } from "@/types/database";

type DocumentRow = Document;
type AttachmentRow = Attachment;
type LinkRow = DocumentAttachment & { attachments: AttachmentRow };

async function withSignedUrls(
  supabase: SupabaseClient,
  documents: DocumentRow[],
  links: LinkRow[],
): Promise<DocumentWithAttachments[]> {
  const byDoc = new Map<string, LinkRow[]>();
  for (const link of links) {
    const list = byDoc.get(link.document_id) ?? [];
    list.push(link);
    byDoc.set(link.document_id, list);
  }

  return Promise.all(
    documents.map(async (document) => {
      const related = (byDoc.get(document.id) ?? []).sort((a, b) => a.position - b.position);
      const attachments = await Promise.all(
        related.map(async (link) => {
          const raw = link.attachments as AttachmentRow | AttachmentRow[] | null;
          const attachment = Array.isArray(raw) ? raw[0] : raw;
          if (!attachment) {
            return null;
          }
          const url = await createAttachmentSignedUrl(supabase, attachment.storage_path);
          return { ...attachment, url, position: link.position };
        }),
      ).then((rows) => rows.filter((row): row is NonNullable<typeof row> => row != null));
      return { ...document, attachments, attachment_count: attachments.length };
    }),
  );
}

export async function countPetDocuments(supabase: SupabaseClient, petId: string): Promise<number> {
  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("pet_id", petId);
  if (error) throw error;
  return count ?? 0;
}

export async function listPetDocuments(supabase: SupabaseClient, petId: string): Promise<DocumentWithAttachments[]> {
  const { data: documents, error } = await supabase
    .from("documents")
    .select("*")
    .eq("pet_id", petId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (documents ?? []) as DocumentRow[];
  if (rows.length === 0) return [];

  const { data: links, error: linksError } = await supabase
    .from("document_attachments")
    .select("document_id, attachment_id, household_id, position, created_at, attachments(*)")
    .in(
      "document_id",
      rows.map((row) => row.id),
    )
    .order("position", { ascending: true });
  if (linksError) throw linksError;

  return withSignedUrls(supabase, rows, (links ?? []) as unknown as LinkRow[]);
}

export async function getPetDocument(
  supabase: SupabaseClient,
  documentId: string,
  petId: string,
): Promise<DocumentWithAttachments | null> {
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("pet_id", petId)
    .maybeSingle();
  if (error) throw error;
  if (!document) return null;

  const { data: links, error: linksError } = await supabase
    .from("document_attachments")
    .select("document_id, attachment_id, household_id, position, created_at, attachments(*)")
    .eq("document_id", documentId)
    .order("position", { ascending: true });
  if (linksError) throw linksError;

  const [result] = await withSignedUrls(supabase, [document as DocumentRow], (links ?? []) as unknown as LinkRow[]);
  return result ?? null;
}
