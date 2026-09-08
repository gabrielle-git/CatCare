/**
 * Central catalog for hygiene care (health_records.type = 'hygiene').
 * Presets live in the app; DB stores open-text hygiene_subtype (+ custom label for other).
 */

export const HYGIENE_SUBTYPE_KEYS = [
  "bath",
  "dry_bath",
  "coat_brushing",
  "grooming",
  "hygienic_grooming",
  "nail_trim",
  "ear_cleaning",
  "dental_hygiene",
  "eye_cleaning",
  "other",
] as const;

export type HygieneSubtypeKey = (typeof HYGIENE_SUBTYPE_KEYS)[number];

export type HygienePreset = {
  key: HygieneSubtypeKey;
  label: string;
  /** Extra tokens for client-side search (normalized separately). */
  searchAliases: string[];
};

export const HYGIENE_PRESETS: readonly HygienePreset[] = [
  { key: "bath", label: "Banho", searchAliases: ["banho"] },
  { key: "dry_bath", label: "Banho a seco", searchAliases: ["banho seco", "banho a seco", "seco"] },
  { key: "coat_brushing", label: "Escovação da pelagem", searchAliases: ["escovacao", "escovação", "pelagem", "pelo", "escovar"] },
  { key: "grooming", label: "Tosa", searchAliases: ["tosa"] },
  { key: "hygienic_grooming", label: "Tosa higiênica", searchAliases: ["tosa higienica", "tosa higiênica", "higienica"] },
  { key: "nail_trim", label: "Corte de unhas", searchAliases: ["unha", "unhas", "corte de unhas"] },
  { key: "ear_cleaning", label: "Limpeza das orelhas", searchAliases: ["orelha", "orelhas", "ouvido", "ouvidos"] },
  { key: "dental_hygiene", label: "Higiene dental", searchAliases: ["dente", "dentes", "dental", "escovar os dentes"] },
  { key: "eye_cleaning", label: "Limpeza dos olhos", searchAliases: ["olho", "olhos"] },
  { key: "other", label: "Outro", searchAliases: ["outro"] },
] as const;

const PRESET_BY_KEY = Object.fromEntries(HYGIENE_PRESETS.map((preset) => [preset.key, preset])) as Record<
  HygieneSubtypeKey,
  HygienePreset
>;

export function isHygieneSubtypeKey(value: string | null | undefined): value is HygieneSubtypeKey {
  return Boolean(value && (HYGIENE_SUBTYPE_KEYS as readonly string[]).includes(value));
}

export function resolveHygieneSubtype(raw: string | null | undefined): HygieneSubtypeKey | null {
  const value = String(raw ?? "").trim();
  return isHygieneSubtypeKey(value) ? value : null;
}

export function hygieneDisplayLabel(subtype: string | null | undefined, customLabel?: string | null): string {
  const key = String(subtype ?? "").trim();
  if (key === "other") {
    const custom = String(customLabel ?? "").trim();
    return custom || "Outro";
  }
  if (isHygieneSubtypeKey(key)) return PRESET_BY_KEY[key].label;
  return key || "Higiene";
}

/** Title stored on health_records.title for hygiene rows. */
export function hygieneRecordTitle(subtype: string, customLabel?: string | null): string {
  return hygieneDisplayLabel(subtype, customLabel);
}

export type HygieneFields = {
  hygiene_subtype: string;
  hygiene_custom_label: string | null;
};

export function buildHygieneFields(
  subtypeRaw: string | null | undefined,
  customRaw: string | null | undefined,
): { ok: true; fields: HygieneFields } | { ok: false; message: string } {
  const subtype = resolveHygieneSubtype(subtypeRaw);
  if (!subtype) return { ok: false, message: "Escolha qual cuidado de higiene você fez." };
  const custom = String(customRaw ?? "").trim();
  if (subtype === "other") {
    if (!custom) return { ok: false, message: "Informe qual outro cuidado você fez." };
    return { ok: true, fields: { hygiene_subtype: "other", hygiene_custom_label: custom } };
  }
  return { ok: true, fields: { hygiene_subtype: subtype, hygiene_custom_label: null } };
}

/** Parse multi-select hygiene subtypes from form (getAll or comma-separated). */
export function parseHygieneSubtypeList(raw: string | readonly string[] | null | undefined): HygieneSubtypeKey[] {
  const parts = Array.isArray(raw)
    ? raw.flatMap((item) => String(item).split(/[,|]+/))
    : String(raw ?? "").split(/[,|]+/);
  const seen = new Set<HygieneSubtypeKey>();
  const list: HygieneSubtypeKey[] = [];
  for (const part of parts) {
    const key = resolveHygieneSubtype(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    list.push(key);
  }
  return list;
}

/**
 * Build one HygieneFields row per selected care (create multi-select).
 * "other" shares a single custom label across the selection.
 */
export function buildHygieneFieldsList(
  subtypesRaw: string | readonly string[] | null | undefined,
  customRaw: string | null | undefined,
): { ok: true; items: HygieneFields[] } | { ok: false; message: string } {
  const list = parseHygieneSubtypeList(subtypesRaw);
  if (list.length === 0) return { ok: false, message: "Escolha ao menos um cuidado de higiene." };
  const custom = String(customRaw ?? "").trim();
  if (list.includes("other") && !custom) {
    return { ok: false, message: "Informe qual outro cuidado você fez." };
  }
  return {
    ok: true,
    items: list.map((subtype) =>
      subtype === "other"
        ? { hygiene_subtype: "other", hygiene_custom_label: custom }
        : { hygiene_subtype: subtype, hygiene_custom_label: null },
    ),
  };
}

/** Create: pets × hygiene cares (or 1 unit for other types). */
export function countHygieneAwareCreateRecords(
  types: readonly string[],
  petCount: number,
  hygieneCareCount: number,
): number {
  if (petCount <= 0 || types.length === 0) return 0;
  let units = 0;
  for (const type of types) {
    units += type === "hygiene" ? Math.max(hygieneCareCount, 0) : 1;
  }
  return units * petCount;
}

/** Extra searchable tokens for a hygiene timeline row (beyond title/detail). */
export function hygieneSearchExtras(subtype: string | null | undefined, customLabel?: string | null): string {
  const key = String(subtype ?? "").trim();
  const parts: string[] = ["higiene", "cuidados de higiene"];
  if (isHygieneSubtypeKey(key)) {
    const preset = PRESET_BY_KEY[key];
    parts.push(preset.label, ...preset.searchAliases);
  }
  if (key === "other") {
    const custom = String(customLabel ?? "").trim();
    if (custom) parts.push(custom);
  }
  return parts.join(" ");
}

/** Resolve search extras from a timeline title (preset label or custom other). */
export function hygieneSearchExtrasFromDisplayTitle(title: string | null | undefined): string {
  const trimmed = String(title ?? "").trim();
  const preset = HYGIENE_PRESETS.find((entry) => entry.key !== "other" && entry.label === trimmed);
  if (preset) return hygieneSearchExtras(preset.key);
  if (trimmed) return hygieneSearchExtras("other", trimmed);
  return hygieneSearchExtras(null);
}
