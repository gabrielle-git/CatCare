import {
  Bath,
  Brush,
  Droplets,
  Ear,
  Eye,
  Heart,
  Pill,
  Scissors,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

/** Legacy keys — rotinas criadas antes da V2 do picker. */
export const ROUTINE_ICON_KEYS = [
  "heart",
  "brush",
  "dental",
  "bath",
  "scissors",
  "eye",
  "ear",
  "pill",
  "droplets",
  "sparkles",
  "stethoscope",
] as const;

export type RoutineIconKey = (typeof ROUTINE_ICON_KEYS)[number];

export const DEFAULT_ROUTINE_ICON = "lucide:heart";

export const iconMap: Record<RoutineIconKey, LucideIcon> = {
  heart: Heart,
  brush: Brush,
  dental: Stethoscope,
  bath: Bath,
  scissors: Scissors,
  eye: Eye,
  ear: Ear,
  pill: Pill,
  droplets: Droplets,
  sparkles: Sparkles,
  stethoscope: Stethoscope,
};

export type ParsedRoutineIcon =
  | { kind: "emoji"; emoji: string; stored: string }
  | { kind: "lucide"; kebab: string; stored: string };

export function isRoutineIconKey(value: string): value is RoutineIconKey {
  return (ROUTINE_ICON_KEYS as readonly string[]).includes(value);
}

export function pascalToKebab(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

export function kebabToPascal(kebab: string) {
  return kebab
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

const KEBAB_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidLucideKebab(name: string) {
  return KEBAB_PATTERN.test(name) && name.length <= 64;
}

export function isValidEmojiGlyph(value: string) {
  if (!value || value.length > 32) return false;
  if (/[<>&"'`\\]/.test(value)) return false;
  return /\p{Extended_Pictographic}/u.test(value);
}

export function parseRoutineIconKey(value: string | null | undefined): ParsedRoutineIcon {
  const raw = (value ?? "").trim();
  if (raw.startsWith("emoji:")) {
    const emoji = raw.slice(6);
    if (isValidEmojiGlyph(emoji)) return { kind: "emoji", emoji, stored: `emoji:${emoji}` };
    return { kind: "lucide", kebab: "heart", stored: DEFAULT_ROUTINE_ICON };
  }
  if (raw.startsWith("lucide:")) {
    const kebab = raw.slice(7).toLowerCase();
    if (isValidLucideKebab(kebab)) return { kind: "lucide", kebab, stored: `lucide:${kebab}` };
    return { kind: "lucide", kebab: "heart", stored: DEFAULT_ROUTINE_ICON };
  }
  if (isRoutineIconKey(raw)) {
    return { kind: "lucide", kebab: raw, stored: raw };
  }
  return { kind: "lucide", kebab: "heart", stored: DEFAULT_ROUTINE_ICON };
}

/** Valida e normaliza o valor persistido em `icon_key`. */
export function sanitizeRoutineIconKey(value: string | null | undefined) {
  return parseRoutineIconKey(value).stored;
}

export function serializeEmojiIcon(emoji: string) {
  return isValidEmojiGlyph(emoji) ? `emoji:${emoji}` : DEFAULT_ROUTINE_ICON;
}

export function serializeLucideIcon(kebab: string) {
  const normalized = kebab.trim().toLowerCase();
  if (isValidLucideKebab(normalized)) return `lucide:${normalized}`;
  return DEFAULT_ROUTINE_ICON;
}

/** @deprecated use parseRoutineIconKey */
export function resolveRoutineIconKey(value: string | null | undefined): string {
  return parseRoutineIconKey(value).stored;
}

export function routineIconLabel(stored: string) {
  const parsed = parseRoutineIconKey(stored);
  if (parsed.kind === "emoji") return parsed.emoji;
  if (isRoutineIconKey(parsed.stored)) {
    const labels: Record<RoutineIconKey, string> = {
      heart: "Cuidado",
      brush: "Escovação",
      dental: "Dentes",
      bath: "Banho",
      scissors: "Unhas",
      eye: "Olhos",
      ear: "Ouvidos",
      pill: "Medicamento",
      droplets: "Higiene",
      sparkles: "Outro",
      stethoscope: "Saúde",
    };
    return labels[parsed.stored];
  }
  return parsed.kebab.replace(/-/g, " ");
}
