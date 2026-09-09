"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  attachmentPayloadForRpc,
  isUuid,
  prepareAttachmentUploads,
  removeStoragePaths,
  resolveDocumentCreateOwnership,
  uploadPreparedAttachments,
  validateAttachmentFiles,
} from "@/lib/attachments";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function documentsBase(petId: string) {
  return `/pets/${petId}/documents`;
}

function readMeta(formData: FormData) {
  const title = value(formData, "title");
  const categoryPreset = value(formData, "category_preset");
  const categoryOther = value(formData, "category_other");
  const category = categoryPreset === "other" ? categoryOther : categoryPreset;
  if (!title || title.length > 160) throw new Error("Informe um título com até 160 caracteres.");
  if (!category || category.length > 80) throw new Error("Escolha ou digite uma categoria.");
  return { title, category };
}

function readFiles(formData: FormData) {
  return formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function readAttachmentIds(formData: FormData, fileCount: number) {
  const ids = formData.getAll("attachment_ids").map((entry) => String(entry).trim()).filter(Boolean);
  if (fileCount === 0) return [] as string[];
  if (ids.length !== fileCount || ids.some((id) => !isUuid(id))) {
    throw new Error("Seleção de arquivos inconsistente. Recarregue a página e tente de novo.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("IDs de anexos duplicados na mesma intenção.");
  }
  return ids;
}

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { supabase, household, userId: data.user.id };
}

async function assertPetInHousehold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  petId: string,
) {
  const { data, error } = await supabase
    .from("pets")
    .select("id")
    .eq("id", petId)
    .eq("household_id", householdId)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !data) throw new Error("Este pet não pertence a esta família.");
}

function finishCreate(petId: string, documentId: string) {
  revalidatePath(documentsBase(petId));
  revalidatePath(`/pets/${petId}`);
  redirect(`${documentsBase(petId)}/${documentId}?saved=1`);
}

export async function createPetDocument(petId: string, formData: FormData) {
  const fail = (message: string): never => {
    redirect(`${documentsBase(petId)}/new?error=${encodeURIComponent(message)}`);
  };

  let meta: ReturnType<typeof readMeta>;
  try {
    meta = readMeta(formData);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Dados inválidos.");
  }

  const documentId = value(formData, "document_id");
  if (!isUuid(documentId)) fail("Intenção de criação inválida. Recarregue a página.");

  const { supabase, household } = await authContext();
  try {
    await assertPetInHousehold(supabase, household.id, petId);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Pet inválido.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("documents")
    .select("id, household_id, pet_id")
    .eq("id", documentId)
    .maybeSingle();
  if (existingError) fail(existingError.message);

  const ownership = resolveDocumentCreateOwnership(documentId, household.id, petId, existing);
  if (ownership.ok === false) {
    fail(
      ownership.reason === "foreign_household" || ownership.reason === "pet_mismatch"
        ? "Não foi possível reutilizar este documento."
        : "Intenção de criação inválida. Recarregue a página.",
    );
  } else if (ownership.status === "reuse") {
    finishCreate(petId, documentId);
  }

  const files = readFiles(formData);
  let attachmentIds: string[] = [];
  try {
    attachmentIds = readAttachmentIds(formData, files.length);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Arquivos inválidos.");
  }

  const validated = await validateAttachmentFiles(files, { required: true });
  const validatedFiles = validated.ok ? validated.values : fail(validated.message);
  const prepared = prepareAttachmentUploads(household.id, validatedFiles, 0, attachmentIds);
  let uploaded: string[] = [];
  try {
    uploaded = await uploadPreparedAttachments(supabase, prepared);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Não foi possível enviar os arquivos.");
  }

  const { error } = await supabase.rpc("create_pet_document", {
    p_document_id: documentId,
    p_pet_id: petId,
    p_title: meta!.title,
    p_category: meta!.category,
    p_attachments: attachmentPayloadForRpc(prepared),
  });

  if (error) {
    const { data: again } = await supabase
      .from("documents")
      .select("id, household_id, pet_id")
      .eq("id", documentId)
      .maybeSingle();
    const retry = resolveDocumentCreateOwnership(documentId, household.id, petId, again);
    if (retry.ok && retry.status === "reuse") {
      finishCreate(petId, documentId);
    }
    await removeStoragePaths(supabase, uploaded);
    fail(error.message);
  }

  finishCreate(petId, documentId);
}

export async function updatePetDocument(petId: string, documentId: string, formData: FormData) {
  let meta: ReturnType<typeof readMeta>;
  try {
    meta = readMeta(formData);
  } catch (error) {
    redirect(`${documentsBase(petId)}/${documentId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Dados inválidos.")}`);
  }

  const { supabase, household } = await authContext();
  try {
    await assertPetInHousehold(supabase, household.id, petId);
  } catch (error) {
    redirect(`${documentsBase(petId)}/${documentId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Pet inválido.")}`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("pet_id", petId)
    .eq("household_id", household.id)
    .maybeSingle();
  if (existingError || !existing) redirect(documentsBase(petId));

  const { error: metaError } = await supabase.rpc("update_pet_document_meta", {
    p_document_id: documentId,
    p_title: meta.title,
    p_category: meta.category,
  });
  if (metaError) {
    redirect(`${documentsBase(petId)}/${documentId}?error=${encodeURIComponent(metaError.message)}`);
  }

  const newFiles = readFiles(formData);
  if (newFiles.length > 0) {
    let attachmentIds: string[];
    try {
      attachmentIds = readAttachmentIds(formData, newFiles.length);
    } catch (error) {
      redirect(`${documentsBase(petId)}/${documentId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Arquivos inválidos.")}`);
    }

    const { data: alreadyLinked } = await supabase
      .from("attachments")
      .select("id")
      .eq("household_id", household.id)
      .in("id", attachmentIds);
    const alreadyIds = new Set((alreadyLinked ?? []).map((row) => row.id));
    const pendingIndexes = attachmentIds
      .map((id, index) => ({ id, index }))
      .filter((item) => !alreadyIds.has(item.id));

    if (pendingIndexes.length > 0) {
      const { count } = await supabase
        .from("document_attachments")
        .select("attachment_id", { count: "exact", head: true })
        .eq("document_id", documentId);

      const pendingFiles = pendingIndexes.map((item) => newFiles[item.index]);
      const pendingIds = pendingIndexes.map((item) => item.id);
      const validated = await validateAttachmentFiles(pendingFiles, {
        required: false,
        existingCount: count ?? 0,
      });
      if (!validated.ok) {
        redirect(`${documentsBase(petId)}/${documentId}?error=${encodeURIComponent(validated.message)}`);
      }

      const prepared = prepareAttachmentUploads(household.id, validated.values, 0, pendingIds);
      let uploaded: string[] = [];
      try {
        uploaded = await uploadPreparedAttachments(supabase, prepared);
      } catch (error) {
        redirect(`${documentsBase(petId)}/${documentId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Não foi possível enviar os arquivos.")}`);
      }
      const { error } = await supabase.rpc("add_document_attachments", {
        p_document_id: documentId,
        p_attachments: attachmentPayloadForRpc(prepared),
      });
      if (error) {
        // If rows already exist from a parallel retry, treat as success when all ids are present.
        const { data: linkedNow } = await supabase
          .from("document_attachments")
          .select("attachment_id")
          .eq("document_id", documentId)
          .in("attachment_id", pendingIds);
        const linked = new Set((linkedNow ?? []).map((row) => row.attachment_id));
        if (pendingIds.every((id) => linked.has(id))) {
          // idempotent success
        } else {
          await removeStoragePaths(supabase, uploaded);
          redirect(`${documentsBase(petId)}/${documentId}?error=${encodeURIComponent(error.message)}`);
        }
      }
    }
  }

  revalidatePath(documentsBase(petId));
  revalidatePath(`${documentsBase(petId)}/${documentId}`);
  redirect(`${documentsBase(petId)}/${documentId}?updated=1`);
}

export async function deleteDocumentAttachment(petId: string, documentId: string, attachmentId: string) {
  const { supabase, household } = await authContext();
  await assertPetInHousehold(supabase, household.id, petId);

  const { data: path, error } = await supabase.rpc("delete_document_attachment", {
    p_attachment_id: attachmentId,
  });
  if (error) {
    redirect(`${documentsBase(petId)}/${documentId}?error=${encodeURIComponent(error.message)}`);
  }
  if (typeof path === "string" && path) {
    try {
      await removeStoragePaths(supabase, [path]);
    } catch {
      redirect(`${documentsBase(petId)}/${documentId}?error=${encodeURIComponent("Arquivo removido do documento, mas a limpeza no Storage falhou. Tente novamente mais tarde.")}`);
    }
  }

  revalidatePath(documentsBase(petId));
  revalidatePath(`${documentsBase(petId)}/${documentId}`);
  redirect(`${documentsBase(petId)}/${documentId}?updated=1`);
}

export async function deletePetDocument(petId: string, documentId: string) {
  const { supabase, household } = await authContext();
  await assertPetInHousehold(supabase, household.id, petId);

  const { data: paths, error } = await supabase.rpc("delete_pet_document", {
    p_document_id: documentId,
  });
  if (error) {
    redirect(`${documentsBase(petId)}?error=${encodeURIComponent(error.message)}`);
  }
  const list = Array.isArray(paths) ? paths.filter((item): item is string => typeof item === "string") : [];
  if (list.length) {
    try {
      await removeStoragePaths(supabase, list);
    } catch {
      revalidatePath(documentsBase(petId));
      revalidatePath(`/pets/${petId}`);
      redirect(`${documentsBase(petId)}?deleted=1&storage_warning=1`);
    }
  }

  revalidatePath(documentsBase(petId));
  revalidatePath(`/pets/${petId}`);
  redirect(`${documentsBase(petId)}?deleted=1`);
}
