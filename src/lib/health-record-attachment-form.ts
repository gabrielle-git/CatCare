import { isUuid, normalizeDisplayNameInput } from "@/lib/attachments";

/** FormData field names for clinical attachments, optionally scoped to a care type. */
export function healthAttachmentFieldNames(careType?: string | null) {
  const scope = careType?.trim();
  if (!scope) {
    return {
      files: "files",
      attachmentIds: "attachment_ids",
      displayNames: "display_names",
    } as const;
  }
  return {
    files: `files__${scope}`,
    attachmentIds: `attachment_ids__${scope}`,
    displayNames: `display_names__${scope}`,
  } as const;
}

export function readAttachmentFiles(formData: FormData, careType?: string | null) {
  const names = healthAttachmentFieldNames(careType);
  const scoped = formData.getAll(names.files).filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (scoped.length > 0 || careType) return scoped;
  // Single-type legacy/unscoped fallback
  return formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export function readAttachmentIds(formData: FormData, fileCount: number, careType?: string | null) {
  const names = healthAttachmentFieldNames(careType);
  let ids = formData.getAll(names.attachmentIds).map((entry) => String(entry).trim()).filter(Boolean);
  if (ids.length === 0 && !careType) {
    ids = formData.getAll("attachment_ids").map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (fileCount === 0) return [] as string[];
  if (ids.length !== fileCount || ids.some((id) => !isUuid(id))) {
    throw new Error("Seleção de arquivos inconsistente. Recarregue a página e tente de novo.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("IDs de anexos duplicados na mesma intenção.");
  }
  return ids;
}

export function readDisplayNames(
  formData: FormData,
  field: "display_names" | "existing_display_names" | string,
  count: number,
) {
  if (count === 0) return [] as Array<string | null>;
  const raw = formData.getAll(field).map((entry) => String(entry ?? ""));
  if (raw.length !== count) {
    throw new Error("Nomes de arquivo inconsistentes. Recarregue a página e tente de novo.");
  }
  return raw.map((entry) => normalizeDisplayNameInput(entry));
}

export function readDisplayNamesForCareType(formData: FormData, fileCount: number, careType?: string | null) {
  const names = healthAttachmentFieldNames(careType);
  try {
    return readDisplayNames(formData, names.displayNames, fileCount);
  } catch (error) {
    if (!careType) return readDisplayNames(formData, "display_names", fileCount);
    throw error;
  }
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

/**
 * Stable health_record id for create retries.
 * Preferred shape: { [petId]: { [careType]: uuid } }
 * Legacy shape: { [petId]: uuid } (single care type only).
 */
export function readStableRecordIdForPetType(
  formData: FormData,
  petId: string,
  careType: string,
  petIds: string[],
): string | null {
  const jsonRaw = String(formData.get("record_ids_json") ?? "").trim();
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw) as Record<string, unknown>;
      const byPet = parsed[petId];
      if (byPet && typeof byPet === "object" && !Array.isArray(byPet)) {
        const id = String((byPet as Record<string, unknown>)[careType] ?? "").trim();
        if (isUuid(id)) return id;
      }
      // Legacy flat map petId → uuid
      const legacy = String(byPet ?? "").trim();
      if (isUuid(legacy)) return legacy;
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

/** @deprecated Prefer readStableRecordIdForPetType — kept for narrow single-type callers. */
export function readStableRecordIdForPet(formData: FormData, petId: string, petIds: string[]): string | null {
  return readStableRecordIdForPetType(formData, petId, "", petIds);
}

export function attachmentHeadingForCareType(careType: string, label?: string): string {
  const named = label?.trim();
  switch (careType) {
    case "exam":
      return "Arquivos do exame";
    case "vaccine":
      return "Arquivos da vacina";
    case "consultation":
      return "Arquivos da consulta";
    case "deworming":
      return "Arquivos do vermífugo";
    case "medication":
      return "Arquivos do medicamento";
    case "hygiene":
      return "Arquivos da higiene";
    case "observation":
      return "Arquivos da observação";
    default:
      return named ? `Arquivos — ${named}` : "Arquivos / Anexos";
  }
}
