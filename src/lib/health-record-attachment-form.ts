import { isUuid, normalizeDisplayNameInput } from "@/lib/attachments";

export function readAttachmentFiles(formData: FormData) {
  return formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export function readAttachmentIds(formData: FormData, fileCount: number) {
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

export function readDisplayNames(formData: FormData, field: "display_names" | "existing_display_names", count: number) {
  if (count === 0) return [] as Array<string | null>;
  const raw = formData.getAll(field).map((entry) => String(entry ?? ""));
  if (raw.length !== count) {
    throw new Error("Nomes de arquivo inconsistentes. Recarregue a página e tente de novo.");
  }
  return raw.map((entry) => normalizeDisplayNameInput(entry));
}

export function readExistingAttachmentIds(formData: FormData) {
  const ids = formData.getAll("existing_attachment_ids").map((entry) => String(entry).trim()).filter(Boolean);
  if (ids.some((id) => !isUuid(id))) {
    throw new Error("Anexos existentes inválidos. Recarregue a página.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("IDs de anexos duplicados na mesma intenção.");
  }
  return ids;
}

/** Stable per-pet record ids from create form (JSON map or single record_id). */
export function readStableRecordIdForPet(formData: FormData, petId: string, petIds: string[]): string | null {
  const jsonRaw = String(formData.get("record_ids_json") ?? "").trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as Record<string, unknown>;
      const id = String(parsed[petId] ?? "").trim();
      return isUuid(id) ? id : null;
    } catch {
      return null;
    }
  }
  if (petIds.length === 1) {
    const id = String(formData.get("record_id") ?? "").trim();
    return isUuid(id) ? id : null;
  }
  return null;
}
