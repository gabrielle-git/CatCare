"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isUuid,
  normalizeDisplayNameInput,
  removeStoragePaths,
  resolveDocumentCreateOwnership,
} from "@/lib/attachments";
import {
  finalizeDirectUploadedAttachments,
  readAttachmentsPayload,
} from "@/lib/attachment-finalize";
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

function readDisplayNames(formData: FormData, field: "display_names" | "existing_display_names", count: number) {
  if (count === 0) return [] as Array<string | null>;
  const raw = formData.getAll(field).map((entry) => String(entry ?? ""));
  if (raw.length !== count) {
    throw new Error("Nomes de arquivo inconsistentes. Recarregue a página e tente de novo.");
  }
  return raw.map((entry) => normalizeDisplayNameInput(entry));
}

function readExistingAttachmentIds(formData: FormData) {
  const ids = formData.getAll("existing_attachment_ids").map((entry) => String(entry).trim()).filter(Boolean);
  if (ids.some((id) => !isUuid(id))) {
    throw new Error("Anexos existentes inválidos. Recarregue a página.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("IDs de anexos duplicados na mesma intenção.");
  }
  return ids;
}

function assertNoBinaryFiles(formData: FormData, fail: (message: string) => never) {
  for (const entry of formData.values()) {
    if (typeof File !== "undefined" && entry instanceof File && entry.size > 0) {
      fail("Envie os arquivos pelo fluxo de upload direto. Recarregue a página e tente de novo.");
    }
  }
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

  assertNoBinaryFiles(formData, fail);

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

  let intents: ReturnType<typeof readAttachmentsPayload> = [];
  try {
    intents = readAttachmentsPayload(formData);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Arquivos inválidos.");
  }
  if (intents.length === 0) fail("Adicione ao menos um arquivo.");

  const finalized = await finalizeDirectUploadedAttachments({
    supabase,
    householdId: household.id,
    intents,
    alreadyLinkedIds: new Set(),
    existingCount: 0,
    entityLabel: "documento",
  });
  const payload = finalized.ok ? finalized.payload : fail(finalized.message);

  const { error } = await supabase.rpc("create_pet_document", {
    p_document_id: documentId,
    p_pet_id: petId,
    p_title: meta!.title,
    p_category: meta!.category,
    p_attachments: payload,
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
    await removeStoragePaths(supabase, payload.map((item) => item.storage_path)).catch(() => undefined);
    fail(error.message);
  }

  finishCreate(petId, documentId);
}

export async function updatePetDocument(petId: string, documentId: string, formData: FormData) {
  const editPath = `${documentsBase(petId)}/${documentId}/edit`;
  const fail = (message: string): never => {
    redirect(`${editPath}?error=${encodeURIComponent(message)}`);
  };

  assertNoBinaryFiles(formData, fail);

  let meta: ReturnType<typeof readMeta>;
  try {
    meta = readMeta(formData);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Dados inválidos.");
  }

  const { supabase, household } = await authContext();
  try {
    await assertPetInHousehold(supabase, household.id, petId);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Pet inválido.");
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
    p_title: meta!.title,
    p_category: meta!.category,
  });
  if (metaError) fail(metaError.message);

  let existingIds: string[] = [];
  let existingDisplayNames: Array<string | null> = [];
  try {
    existingIds = readExistingAttachmentIds(formData);
    existingDisplayNames = readDisplayNames(formData, "existing_display_names", existingIds.length);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Arquivos inválidos.");
  }

  for (let index = 0; index < existingIds.length; index += 1) {
    const { error: renameError } = await supabase.rpc("update_attachment_display_name", {
      p_attachment_id: existingIds[index],
      p_display_name: existingDisplayNames[index],
    });
    if (renameError) fail(renameError.message);
  }

  let intents: ReturnType<typeof readAttachmentsPayload> = [];
  try {
    intents = readAttachmentsPayload(formData);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Arquivos inválidos.");
  }

  if (intents.length > 0) {
    const attachmentIds = intents.map((item) => item.attachment_id);
    const { data: alreadyLinked } = await supabase
      .from("attachments")
      .select("id")
      .eq("household_id", household.id)
      .in("id", attachmentIds);
    const alreadyIds = new Set((alreadyLinked ?? []).map((row) => row.id));
    const pending = intents.filter((item) => !alreadyIds.has(item.attachment_id));

    if (pending.length > 0) {
      const { count } = await supabase
        .from("document_attachments")
        .select("attachment_id", { count: "exact", head: true })
        .eq("document_id", documentId);

      const finalized = await finalizeDirectUploadedAttachments({
        supabase,
        householdId: household.id,
        intents: pending,
        alreadyLinkedIds: alreadyIds,
        existingCount: count ?? 0,
        entityLabel: "documento",
      });
      const payload = finalized.ok ? finalized.payload : fail(finalized.message);
      if (payload.length > 0) {
        const { error: addError } = await supabase.rpc("add_document_attachments", {
          p_document_id: documentId,
          p_attachments: payload,
        });
        if (addError) {
          const pendingIds = payload.map((item: { id: string }) => item.id);
          const { data: linkedNow } = await supabase
            .from("document_attachments")
            .select("attachment_id")
            .eq("document_id", documentId)
            .in("attachment_id", pendingIds);
          const linked = new Set((linkedNow ?? []).map((row) => row.attachment_id));
          if (!pendingIds.every((id: string) => linked.has(id))) {
            const orphanPaths = payload
              .filter((item: { id: string; storage_path: string }) => !linked.has(item.id))
              .map((item: { storage_path: string }) => item.storage_path);
            if (orphanPaths.length) await removeStoragePaths(supabase, orphanPaths).catch(() => undefined);
            fail(addError.message);
          }
        }
      }
    }
  }

  revalidatePath(documentsBase(petId));
  revalidatePath(`${documentsBase(petId)}/${documentId}`);
  revalidatePath(editPath);
  redirect(`${editPath}?updated=1`);
}

export async function deleteDocumentAttachment(
  petId: string,
  documentId: string,
  attachmentId: string,
  returnTo: "view" | "edit" = "view",
) {
  const { supabase, household } = await authContext();
  await assertPetInHousehold(supabase, household.id, petId);

  const target =
    returnTo === "edit"
      ? `${documentsBase(petId)}/${documentId}/edit`
      : `${documentsBase(petId)}/${documentId}`;

  const { data: path, error } = await supabase.rpc("delete_document_attachment", {
    p_attachment_id: attachmentId,
  });
  if (error) {
    const message = /at least one attachment/i.test(error.message)
      ? "Um documento precisa ter pelo menos um arquivo. Adicione outro antes de remover este."
      : error.message;
    redirect(`${target}?error=${encodeURIComponent(message)}`);
  }
  if (typeof path === "string" && path) {
    try {
      await removeStoragePaths(supabase, [path]);
    } catch {
      redirect(`${target}?error=${encodeURIComponent("Arquivo removido do documento, mas a limpeza no Storage falhou. Tente novamente mais tarde.")}`);
    }
  }

  revalidatePath(documentsBase(petId));
  revalidatePath(`${documentsBase(petId)}/${documentId}`);
  revalidatePath(`${documentsBase(petId)}/${documentId}/edit`);
  redirect(`${target}?updated=1`);
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
