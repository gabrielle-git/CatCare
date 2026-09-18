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

/** Controlled soft accent families for profile hero tint (builtin avatars only). */
export const BUILTIN_AVATAR_ACCENTS = [
  "cream",
  "peach",
  "lavender",
  "rose",
  "sage",
  "sky",
  "warm-neutral",
] as const;
export type BuiltinPetAvatarAccent = (typeof BUILTIN_AVATAR_ACCENTS)[number];

/** Soft hero gradients — light enough for dark text; standard CatCare lavender is the default. */
export const PROFILE_HERO_ACCENT_BACKGROUNDS: Record<BuiltinPetAvatarAccent, string> = {
  cream: "linear-gradient(135deg,#F7F0E6,#EFE0D0)",
  peach: "linear-gradient(135deg,#FBEAD9,#F3CDB8)",
  lavender: "linear-gradient(135deg,var(--lavender-soft),var(--rose-soft))",
  rose: "linear-gradient(135deg,#F8E4EC,#EEC8D6)",
  sage: "linear-gradient(135deg,var(--mint-soft),#D5E8DC)",
  sky: "linear-gradient(135deg,#E6EEF8,#D2E0F0)",
  "warm-neutral": "linear-gradient(135deg,#F1EBE4,#E2D6C8)",
};

export const DEFAULT_PROFILE_HERO_BACKGROUND = PROFILE_HERO_ACCENT_BACKGROUNDS.lavender;

export type BuiltinPetAvatarMeta = {
  id: string;
  label: string;
  category: BuiltinPetAvatarCategory;
  tags: readonly string[];
  accent: BuiltinPetAvatarAccent;
};

/** Expanded starter library (not a permanent product limit). */
export const BUILTIN_PET_AVATARS = [
  // Cats
  { id: "cat-cream", label: "Gato creme", category: "cat", tags: ["cream", "shorthair"], accent: "cream" },
  { id: "cat-orange", label: "Gato laranja", category: "cat", tags: ["orange"], accent: "peach" },
  { id: "cat-black", label: "Gato preto", category: "cat", tags: ["black"], accent: "warm-neutral" },
  { id: "cat-gray", label: "Gato cinza", category: "cat", tags: ["gray"], accent: "lavender" },
  { id: "cat-white", label: "Gato branco", category: "cat", tags: ["white"], accent: "cream" },
  { id: "cat-tabby", label: "Gato tigrado", category: "cat", tags: ["tabby"], accent: "warm-neutral" },
  { id: "cat-calico", label: "Gato tricolor", category: "cat", tags: ["calico"], accent: "rose" },
  { id: "cat-tuxedo", label: "Gato frajola", category: "cat", tags: ["tuxedo", "black", "white"], accent: "warm-neutral" },
  { id: "cat-siamese", label: "Siamês", category: "cat", tags: ["siamese"], accent: "sky" },
  { id: "cat-persian", label: "Persa", category: "cat", tags: ["persian", "longhair"], accent: "cream" },
  { id: "cat-maine-coon", label: "Maine Coon", category: "cat", tags: ["maine-coon", "longhair"], accent: "warm-neutral" },
  { id: "cat-sphynx", label: "Sphynx", category: "cat", tags: ["sphynx"], accent: "peach" },
  { id: "cat-tortie", label: "Escaminha", category: "cat", tags: ["tortie"], accent: "rose" },
  { id: "cat-blue", label: "Gato azul", category: "cat", tags: ["blue", "gray"], accent: "sky" },
  { id: "cat-fluffy", label: "Gato peludo", category: "cat", tags: ["longhair", "fluffy"], accent: "lavender" },
  { id: "cat-srd", label: "Gato SRD", category: "cat", tags: ["srd"], accent: "sage" },
  // Dogs
  { id: "dog-cream", label: "Cão creme", category: "dog", tags: ["cream"], accent: "cream" },
  { id: "dog-brown", label: "Cão marrom", category: "dog", tags: ["brown"], accent: "warm-neutral" },
  { id: "dog-caramel", label: "Cão caramelo", category: "dog", tags: ["caramel", "srd"], accent: "peach" },
  { id: "dog-black", label: "Cão preto", category: "dog", tags: ["black"], accent: "warm-neutral" },
  { id: "dog-white", label: "Cão branco", category: "dog", tags: ["white"], accent: "cream" },
  { id: "dog-golden", label: "Golden Retriever", category: "dog", tags: ["golden"], accent: "peach" },
  { id: "dog-labrador", label: "Labrador", category: "dog", tags: ["labrador"], accent: "warm-neutral" },
  { id: "dog-shih-tzu", label: "Shih-tzu", category: "dog", tags: ["shih-tzu", "longhair"], accent: "cream" },
  { id: "dog-poodle", label: "Poodle", category: "dog", tags: ["poodle"], accent: "lavender" },
  { id: "dog-dachshund", label: "Dachshund", category: "dog", tags: ["dachshund"], accent: "warm-neutral" },
  { id: "dog-husky", label: "Husky", category: "dog", tags: ["husky"], accent: "sky" },
  { id: "dog-shepherd", label: "Pastor Alemão", category: "dog", tags: ["shepherd"], accent: "warm-neutral" },
  { id: "dog-french-bulldog", label: "Bulldog Francês", category: "dog", tags: ["french-bulldog"], accent: "lavender" },
  // Other
  { id: "bird-cockatiel", label: "Calopsita", category: "other", tags: ["bird", "cockatiel"], accent: "sky" },
  { id: "bird-parakeet", label: "Periquito", category: "other", tags: ["bird", "parakeet"], accent: "sage" },
  { id: "bird-canary", label: "Canário", category: "other", tags: ["bird", "canary"], accent: "peach" },
  { id: "bird-parrot", label: "Papagaio", category: "other", tags: ["bird", "parrot"], accent: "rose" },
  { id: "rabbit-cream", label: "Coelho", category: "other", tags: ["rabbit"], accent: "cream" },
  { id: "hamster-brown", label: "Hamster", category: "other", tags: ["hamster"], accent: "peach" },
  { id: "paw-neutral", label: "Patinha", category: "other", tags: ["neutral", "paw"], accent: "lavender" },
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
const BUILTIN_BY_ID = new Map(BUILTIN_PET_AVATARS.map((item) => [item.id, item]));
const ACCENT_SET = new Set<string>(BUILTIN_AVATAR_ACCENTS);

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

export function getBuiltinPetAvatarMeta(id: BuiltinPetAvatarId) {
  return BUILTIN_BY_ID.get(id) ?? null;
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

/**
 * Profile hero background from photo_path.
 * Builtin whitelist → controlled accent. Uploaded photo / null / invalid → standard lavender.
 * Never samples uploaded image pixels.
 */
export function resolveProfileHeroBackground(photoPath: string | null | undefined): string {
  const builtinId = parseBuiltinPetAvatarId(photoPath);
  if (!builtinId) return DEFAULT_PROFILE_HERO_BACKGROUND;
  const meta = getBuiltinPetAvatarMeta(builtinId);
  if (!meta || !ACCENT_SET.has(meta.accent)) return DEFAULT_PROFILE_HERO_BACKGROUND;
  return PROFILE_HERO_ACCENT_BACKGROUNDS[meta.accent] ?? DEFAULT_PROFILE_HERO_BACKGROUND;
}
