import { notesFieldNameForPet, notesTargetPetFieldName } from "@/lib/neonatal-feeding";

/**
 * Create-time notes for one pet × care type.
 *
 * Precedence:
 * 1. note for this pet and this type
 * 2. note shared by every pet of this type
 * 3. legacy per-pet note (notes__{petId}), when that mode is on and this pet is targeted
 * 4. launch-wide note (`notes`)
 * 5. empty
 *
 * An empty more-specific field falls through. Notes are never concatenated.
 * Edit keeps using the single `notes` field of that one record.
 */

export function notesFieldNameForType(careType: string) {
  return `notes__${careType}`;
}

export function notesFieldNameForPetType(careType: string, petId: string) {
  return `notes__${careType}__${petId}`;
}

function present(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text || null;
}

export function resolveRecordNote(args: {
  petTypeNote?: string | null;
  typeSharedNote?: string | null;
  legacyPetNote?: string | null;
  globalNote?: string | null;
  legacyPerPetEnabled: boolean;
  legacyPetSelected: boolean;
}): string | null {
  const specific = present(args.petTypeNote);
  if (specific) return specific;
  const typeShared = present(args.typeSharedNote);
  if (typeShared) return typeShared;
  if (args.legacyPerPetEnabled && args.legacyPetSelected) {
    const legacy = present(args.legacyPetNote);
    if (legacy) return legacy;
  }
  return present(args.globalNote);
}

export function resolveRecordNoteFromForm(formData: FormData, petId: string, careType: string): string | null {
  const legacyPerPetEnabled = String(formData.get("include_per_pet_notes") ?? "").trim() === "1";
  const legacyPetSelected = formData
    .getAll(notesTargetPetFieldName())
    .map((entry) => String(entry))
    .includes(petId);
  return resolveRecordNote({
    petTypeNote: String(formData.get(notesFieldNameForPetType(careType, petId)) ?? ""),
    typeSharedNote: String(formData.get(notesFieldNameForType(careType)) ?? ""),
    legacyPetNote: String(formData.get(notesFieldNameForPet(petId)) ?? ""),
    globalNote: String(formData.get("notes") ?? ""),
    legacyPerPetEnabled,
    legacyPetSelected,
  });
}

/** Demo preview never calls the server action. */
export function recordFormSubmitMode(previewOnly: boolean): "preview" | "persist" {
  return previewOnly ? "preview" : "persist";
}
