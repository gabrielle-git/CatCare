/**
 * Built-in CatCare avatar references stored in pets.photo_path.
 * Format: `builtin:{id}` — never a Storage object; never signed; never Storage-deleted.
 *
 * Expanded starter library — add original CatCare SVG under /public/avatars/{id}.svg
 * and append metadata here. No schema migration. No copyrighted characters.
 */

export const BUILTIN_AVATAR_PREFIX = "builtin:";

export const BUILTIN_AVATAR_CATEGORIES = ["cat", "dog", "other"] as const;
export type BuiltinPetAvatarCategory = (typeof BUILTIN_AVATAR_CATEGORIES)[number];

export type BuiltinPetAvatarMeta = {
  id: string;
  label: string;
  category: BuiltinPetAvatarCategory;
  tags: readonly string[];
};

/** Expanded starter library (not a permanent product limit). */
export const BUILTIN_PET_AVATARS = [
  // Cats
  { id: "cat-cream", label: "Gato creme", category: "cat", tags: ["cream", "shorthair"] },
  { id: "cat-orange", label: "Gato laranja", category: "cat", tags: ["orange"] },
  { id: "cat-black", label: "Gato preto", category: "cat", tags: ["black"] },
  { id: "cat-gray", label: "Gato cinza", category: "cat", tags: ["gray"] },
  { id: "cat-white", label: "Gato branco", category: "cat", tags: ["white"] },
  { id: "cat-tabby", label: "Gato tigrado", category: "cat", tags: ["tabby"] },
  { id: "cat-calico", label: "Gato tricolor", category: "cat", tags: ["calico"] },
  { id: "cat-tuxedo", label: "Gato frajola", category: "cat", tags: ["tuxedo", "black", "white"] },
  { id: "cat-siamese", label: "Siamês", category: "cat", tags: ["siamese"] },
  { id: "cat-persian", label: "Persa", category: "cat", tags: ["persian", "longhair"] },
  { id: "cat-maine-coon", label: "Maine Coon", category: "cat", tags: ["maine-coon", "longhair"] },
  { id: "cat-sphynx", label: "Sphynx", category: "cat", tags: ["sphynx"] },
  { id: "cat-tortie", label: "Escaminha", category: "cat", tags: ["tortie"] },
  { id: "cat-blue", label: "Gato azul", category: "cat", tags: ["blue", "gray"] },
  { id: "cat-fluffy", label: "Gato peludo", category: "cat", tags: ["longhair", "fluffy"] },
  { id: "cat-srd", label: "Gato SRD", category: "cat", tags: ["srd"] },
  // Dogs
  { id: "dog-cream", label: "Cão creme", category: "dog", tags: ["cream"] },
  { id: "dog-brown", label: "Cão marrom", category: "dog", tags: ["brown"] },
  { id: "dog-caramel", label: "Cão caramelo", category: "dog", tags: ["caramel", "srd"] },
  { id: "dog-black", label: "Cão preto", category: "dog", tags: ["black"] },
  { id: "dog-white", label: "Cão branco", category: "dog", tags: ["white"] },
  { id: "dog-golden", label: "Golden Retriever", category: "dog", tags: ["golden"] },
  { id: "dog-labrador", label: "Labrador", category: "dog", tags: ["labrador"] },
  { id: "dog-shih-tzu", label: "Shih-tzu", category: "dog", tags: ["shih-tzu", "longhair"] },
  { id: "dog-poodle", label: "Poodle", category: "dog", tags: ["poodle"] },
  { id: "dog-dachshund", label: "Dachshund", category: "dog", tags: ["dachshund"] },
  { id: "dog-husky", label: "Husky", category: "dog", tags: ["husky"] },
  { id: "dog-shepherd", label: "Pastor Alemão", category: "dog", tags: ["shepherd"] },
  { id: "dog-french-bulldog", label: "Bulldog Francês", category: "dog", tags: ["french-bulldog"] },
  // Other
  { id: "bird-cockatiel", label: "Calopsita", category: "other", tags: ["bird", "cockatiel"] },
  { id: "bird-parakeet", label: "Periquito", category: "other", tags: ["bird", "parakeet"] },
  { id: "bird-canary", label: "Canário", category: "other", tags: ["bird", "canary"] },
  { id: "bird-parrot", label: "Papagaio", category: "other", tags: ["bird", "parrot"] },
  { id: "rabbit-cream", label: "Coelho", category: "other", tags: ["rabbit"] },
  { id: "hamster-brown", label: "Hamster", category: "other", tags: ["hamster"] },
  { id: "paw-neutral", label: "Patinha", category: "other", tags: ["neutral", "paw"] },
] as const satisfies readonly BuiltinPetAvatarMeta[];

export type BuiltinPetAvatarId = (typeof BUILTIN_PET_AVATARS)[number]["id"];

export type BuiltinAvatarFilter = "all" | BuiltinPetAvatarCategory;

export const BUILTIN_AVATAR_FILTERS: { id: BuiltinAvatarFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "cat", label: "Gatos" },
  { id: "dog", label: "Cães" },
  { id: "other", label: "Outros" },
];

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

export function filterBuiltinPetAvatars(filter: BuiltinAvatarFilter = "all") {
  if (filter === "all") return BUILTIN_PET_AVATARS;
  return BUILTIN_PET_AVATARS.filter((avatar) => avatar.category === filter);
}

export function resolvePetPhotoDisplayUrl(photoPath: string | null | undefined, signedStorageUrl: string | null): string | null {
  const builtinId = parseBuiltinPetAvatarId(photoPath);
  if (builtinId) return builtinPetAvatarPublicUrl(builtinId);
  if (!photoPath) return null;
  return signedStorageUrl;
}
