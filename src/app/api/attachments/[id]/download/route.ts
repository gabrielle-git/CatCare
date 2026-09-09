import { NextResponse } from "next/server";
import {
  contentDispositionAttachment,
  isAllowedAttachmentMime,
} from "@/lib/attachments";
import { ensureHousehold } from "@/lib/households";
import { PET_MEDIA_BUCKET } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Download indisponível neste ambiente." }, { status: 503 });
  }

  const { id } = await context.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Entre na sua conta para baixar." }, { status: 401 });
  }

  const household = await ensureHousehold(supabase, auth.user.id);
  const { data: attachment, error } = await supabase
    .from("attachments")
    .select("id, household_id, storage_path, original_filename, mime_type")
    .eq("id", id)
    .eq("household_id", household.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!attachment) {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const mimeType = isAllowedAttachmentMime(attachment.mime_type) ? attachment.mime_type : "application/octet-stream";
  const { data: blob, error: downloadError } = await supabase.storage.from(PET_MEDIA_BUCKET).download(attachment.storage_path);
  if (downloadError || !blob) {
    return NextResponse.json({ error: downloadError?.message ?? "Não foi possível baixar o arquivo." }, { status: 500 });
  }

  const bytes = await blob.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "content-type": mimeType,
      "content-disposition": contentDispositionAttachment(attachment.original_filename),
      "cache-control": "private, no-store",
    },
  });
}
