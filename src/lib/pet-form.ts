export function parsePetIds(formData: FormData, field = "pet_ids") {
  return [...new Set(formData.getAll(field).map((entry) => String(entry).trim()).filter(Boolean))];
}

/** Um pet → id dele; vários ou nenhum → null (compartilhado / família). */
export function resolveOptionalPetId(petIds: string[]) {
  if (petIds.length === 1) return petIds[0];
  return null;
}

export function sharedFromPetIds(petIds: string[]) {
  return petIds.length !== 1;
}
