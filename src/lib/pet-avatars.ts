/**
 * Built-in CatCare avatar references stored in pets.photo_path.
 * Format: `builtin:{id}` — never a Storage object; never signed; never Storage-deleted.
 *
 * STARTER PACK (not a permanent product limit): add original CatCare SVG assets under
 * /public/avatars/{id}.svg and append to BUILTIN_PET_AVATARS — no schema migration.
 * Do not add copyrighted third-party characters.
 */

export const BUILTIN_AVATAR_PREFIX = "builtin:";

export const BUILTIN_PET_AVATARS = [
  { id: "cat-cream", label: "Gato creme", species: "cat" },
  { id: "cat-orange", label: "Gato laranja", species: "cat" },
  { id: "cat-black", label: "Gato preto", species: "cat" },
  { id: "cat-gray", label: "Gato cinza", species: "cat" },
  { id: "cat-white", label: "Gato branco", species: "cat" },
  { id: "cat-tabby", label: "Gato tigrado", species: "cat" },
  { id: "dog-cream", label: "Cão creme", species: "dog" },
  { id: "dog-brown", label: "Cão marrom", species: "dog" },
  { id: "paw-neutral", label: "Patinha", species: "neutral" },
] as const;

export type BuiltinPetAvatarId = (typeof BUILTIN_PET_AVATARS)[number]["id"];

const BUILTIN_ID_SET = new Set<string>(BUILTIN_PET_AVATARS.map((item) => item.id));

export function isBuiltinPetAvatarPath(path: string | null | undefined): boolean {
  return Boolean(path && path.startsWith(BUILTIN_AVATAR_PREFIX));
}

/** True when photo_path points at a private Storage object (not builtin, not empty). */
export function isStoragePetPhotoPath(path: string | null | undefined): boolean {
  return Boolean(path && !isBuiltinPetAvatarPath(path));
}

export function parseBuiltinPetAvatarId(path: string | null | undefined): BuiltinPetAvatarId | null {
  if (!isBuiltinPetAvatarPath(path)) return null;
  const id = path!.slice(BUILTIN_AVATAR_PREFIX.length);
  return BUILTIN_ID_SET.has(id) ? (id as BuiltinPetAvatarId) : null;
}

export function builtinPetAvatarPath(id: BuiltinPetAvatarId): string {
  return `${BUILTIN_AVATAR_PREFIX}${id}`;
}

export function resolveBuiltinPetAvatarId(raw: string): BuiltinPetAvatarId | null {
  const id = raw.trim();
  return BUILTIN_ID_SET.has(id) ? (id as BuiltinPetAvatarId) : null;
}

/** Public app asset URL for a whitelisted builtin avatar. */
export function builtinPetAvatarPublicUrl(id: BuiltinPetAvatarId): string {
  return `/avatars/${id}.svg`;
}

export function resolvePetPhotoDisplayUrl(photoPath: string | null | undefined, signedStorageUrl: string | null): string | null {
  const builtinId = parseBuiltinPetAvatarId(photoPath);
  if (builtinId) return builtinPetAvatarPublicUrl(builtinId);
  if (!photoPath) return null;
  return signedStorageUrl;
}
