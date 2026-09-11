import { isUuid, normalizeDisplayNameInput } from "@/lib/attachments";

export type HealthAttachmentFieldScope = {
  careType?: string | null;
  petId?: string | null;
};

/** FormData field names for clinical attachments, scoped by pet and/or care type. */
export function healthAttachmentFieldNames(careType?: string | null, petId?: string | null) {
  const scope = careType?.trim();
  const pet = petId?.trim();
  if (scope && pet) {
    return {
      files: `files__${pet}__${scope}`,
      attachmentIds: `attachment_ids__${pet}__${scope}`,
      displayNames: `display_names__${pet}__${scope}`,
    } as const;
  }
  if (scope) {
    return {
      files: `files__${scope}`,
      attachmentIds: `attachment_ids__${scope}`,
      displayNames: `display_names__${scope}`,
    } as const;
  }
  return {
    files: "files",
    attachmentIds: "attachment_ids",
    displayNames: "display_names",
  } as const;
}

/**
 * Read files for one health_record intention.
 * Prefer pet+type keys. Type-only / unscoped fallbacks are only for single-pet creates and edit.
 */
export function readAttachmentFiles(
  formData: FormData,
  careType?: string | null,
  petId?: string | null,
  options?: { allowLegacyFallback?: boolean },
) {
  const allowLegacy = options?.allowLegacyFallback !== false;
  const petScoped = healthAttachmentFieldNames(careType, petId);
  const petFiles = formData.getAll(petScoped.files).filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (petFiles.length > 0) return petFiles;
  if (petId && careType) {
    // Multi-pet must not inherit another pet's type-only bucket.
    if (!allowLegacy) return [] as File[];
  }
  if (careType) {
    const typeScoped = healthAttachmentFieldNames(careType);
    const typeFiles = formData.getAll(typeScoped.files).filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (typeFiles.length > 0 || !allowLegacy) return typeFiles;
  }
  if (!allowLegacy) return [] as File[];
  return formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export function readAttachmentIds(
  formData: FormData,
  fileCount: number,
  careType?: string | null,
  petId?: string | null,
  options?: { allowLegacyFallback?: boolean },
) {
  if (fileCount === 0) return [] as string[];
  const allowLegacy = options?.allowLegacyFallback !== false;
  const names = healthAttachmentFieldNames(careType, petId);
  let ids = formData.getAll(names.attachmentIds).map((entry) => String(entry).trim()).filter(Boolean);
  if (ids.length === 0 && allowLegacy && petId && careType) {
    ids = formData.getAll(healthAttachmentFieldNames(careType).attachmentIds).map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (ids.length === 0 && allowLegacy && !careType) {
    ids = formData.getAll("attachment_ids").map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (ids.length === 0 && allowLegacy && careType && !petId) {
    ids = formData.getAll("attachment_ids").map((entry) => String(entry).trim()).filter(Boolean);
  }
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

export function readDisplayNamesForCareType(
  formData: FormData,
  fileCount: number,
  careType?: string | null,
  petId?: string | null,
  options?: { allowLegacyFallback?: boolean },
) {
  if (fileCount === 0) return [] as Array<string | null>;
  const allowLegacy = options?.allowLegacyFallback !== false;
  const names = healthAttachmentFieldNames(careType, petId);
  try {
    return readDisplayNames(formData, names.displayNames, fileCount);
  } catch (error) {
    if (!allowLegacy) throw error;
    if (petId && careType) {
      try {
        return readDisplayNames(formData, healthAttachmentFieldNames(careType).displayNames, fileCount);
      } catch {
        // fall through
      }
    }
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

export function attachmentHeadingForPetCareType(petName: string, careType: string, typeLabel?: string): string {
  const name = petName.trim() || "Pet";
  const endsWithA = /a$/i.test(name);
  const article = endsWithA ? "da" : "do";
  switch (careType) {
    case "exam":
      return `Arquivos ${article} ${name} — exame`;
    case "vaccine":
      return `Arquivos ${article} ${name} — vacina`;
    case "consultation":
      return `Arquivos ${article} ${name} — consulta`;
    case "deworming":
      return `Arquivos ${article} ${name} — vermífugo`;
    case "medication":
      return `Arquivos ${article} ${name} — medicamento`;
    case "hygiene":
      return `Arquivos ${article} ${name} — higiene`;
    case "observation":
      return `Arquivos ${article} ${name} — observação`;
    default: {
      const named = typeLabel?.trim();
      return named ? `Arquivos ${article} ${name} — ${named}` : `Arquivos ${article} ${name}`;
    }
  }
}

/** Stable client key for local selection maps: petId + careType. */
export function healthAttachmentRecordKey(petId: string, careType: string) {
  return `${petId}:${careType}`;
}
