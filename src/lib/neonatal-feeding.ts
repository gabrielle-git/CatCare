import type { NeonatalRecord } from "@/types/database";

/** Structured feeding subtypes (type remains `feeding`). */
export const FEEDING_SUBTYPES = ["milk", "wet_food", "puree", "other"] as const;
export type FeedingSubtype = (typeof FEEDING_SUBTYPES)[number];

/** UI unit presets; custom text is allowed when preset is `other`. */
export const FEEDING_UNIT_PRESETS = ["ml", "g", "spoon", "other"] as const;
export type FeedingUnitPreset = (typeof FEEDING_UNIT_PRESETS)[number];

export const FEEDING_SUBTYPE_LABELS: Record<FeedingSubtype, string> = {
  milk: "Leite / mamadeira",
  wet_food: "Sachê / alimento úmido",
  puree: "Papinha",
  other: "Outro",
};

export const FEEDING_UNIT_PRESET_LABELS: Record<FeedingUnitPreset, string> = {
  ml: "ml",
  g: "g",
  spoon: "colher",
  other: "outra",
};

export const FEEDING_UNIT_DISPLAY: Record<string, string> = {
  ml: "ml",
  g: "g",
  spoon: "colher",
};

/** Safe label when subtype is unknown / legacy null. */
export const FEEDING_GENERIC_LABEL = "Alimentação";

export type FeedingAmountSource = "structured" | "legacy_ml" | "none";

export type ResolvedFeedingAmount = {
  value: number;
  unit: string;
  source: Exclude<FeedingAmountSource, "none">;
};

export type FeedingRowLike = Pick<
  NeonatalRecord,
  "type" | "amount_ml" | "feeding_subtype" | "feeding_amount_value" | "feeding_amount_unit"
>;

export function isFeedingSubtype(value: string | null | undefined): value is FeedingSubtype {
  return FEEDING_SUBTYPES.includes(value as FeedingSubtype);
}

export function feedingSubtypeLabel(subtype: string | null | undefined): string {
  if (subtype && isFeedingSubtype(subtype)) return FEEDING_SUBTYPE_LABELS[subtype];
  return FEEDING_GENERIC_LABEL;
}

/** Title for timeline / history: subtype label or generic "Alimentação". */
export function feedingRecordTitle(row: Pick<FeedingRowLike, "feeding_subtype"> | null | undefined): string {
  return feedingSubtypeLabel(row?.feeding_subtype ?? null);
}

export function formatFeedingUnit(unit: string): string {
  const key = unit.trim().toLowerCase();
  return FEEDING_UNIT_DISPLAY[key] ?? unit.trim();
}

/**
 * Resolve display/storage amount with precedence:
 * 1) feeding_amount_value + feeding_amount_unit
 * 2) legacy amount_ml as ml
 */
export function resolveFeedingAmount(row: FeedingRowLike | null | undefined): ResolvedFeedingAmount | null {
  if (!row || row.type !== "feeding") return null;
  if (row.feeding_amount_value != null && row.feeding_amount_unit) {
    const value = Number(row.feeding_amount_value);
    if (!Number.isFinite(value) || value <= 0) return null;
    return { value, unit: row.feeding_amount_unit, source: "structured" };
  }
  if (row.amount_ml != null) {
    const value = Number(row.amount_ml);
    if (!Number.isFinite(value) || value <= 0) return null;
    return { value, unit: "ml", source: "legacy_ml" };
  }
  return null;
}

/** Only true millilitres contribute to totalMl / lastFeedingMl. */
export function feedingAmountInMl(row: FeedingRowLike | null | undefined): number | null {
  const resolved = resolveFeedingAmount(row);
  if (!resolved) return null;
  if (resolved.unit.trim().toLowerCase() !== "ml") return null;
  return resolved.value;
}

export function formatFeedingAmount(resolved: ResolvedFeedingAmount | null | undefined): string | null {
  if (!resolved) return null;
  const value = resolved.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${value} ${formatFeedingUnit(resolved.unit)}`;
}

export function formatFeedingAmountFromRow(row: FeedingRowLike | null | undefined): string | null {
  return formatFeedingAmount(resolveFeedingAmount(row));
}

export type FeedingDisplay = {
  title: string;
  amountLabel: string | null;
  detailParts: string[];
};

/** Timeline/history presentation for a feeding row. */
export function getFeedingDisplay(
  row: FeedingRowLike & { quality?: string | null; notes?: string | null },
): FeedingDisplay {
  const title = feedingRecordTitle(row);
  const amountLabel = formatFeedingAmountFromRow(row);
  const quality = row.quality?.trim() || null;
  const notes = row.notes?.trim() || null;
  const detailParts = [amountLabel, quality, notes].filter((part): part is string => Boolean(part));
  return { title, amountLabel, detailParts };
}

export function parseFeedingAmountValue(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const parsed = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1000) return null;
  return parsed;
}

export function normalizeFeedingUnit(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === "ml" || lower === "g" || lower === "spoon") return lower;
  if (lower === "colher") return "spoon";
  return trimmed.slice(0, 32);
}

export function resolveFeedingUnitFromForm(preset: string, custom: string): string | null {
  const p = preset.trim().toLowerCase();
  if (p === "ml" || p === "g" || p === "spoon") return p;
  if (p === "other") return normalizeFeedingUnit(custom);
  return normalizeFeedingUnit(preset);
}

/**
 * Resolve per-pet notes: individual replaces shared; empty individual falls back to shared.
 * Never concatenates.
 */
export function resolvePetNotes(shared: string | null | undefined, individual: string | null | undefined): string | null {
  const own = individual?.trim() || "";
  if (own) return own;
  const common = shared?.trim() || "";
  return common || null;
}

export function notesFieldNameForPet(petId: string) {
  return `notes__${petId}`;
}

export function isLegacyFeedingAmount(row: FeedingRowLike): boolean {
  return row.type === "feeding" && row.amount_ml != null && row.feeding_amount_value == null;
}

/**
 * Edit save decision: keep legacy amount_ml only when the user did not change
 * quantity, unit, or subtype relative to the loaded legacy row.
 */
export function shouldPreserveLegacyFeedingAmount(args: {
  existing: FeedingRowLike;
  nextSubtype: string | null;
  nextValue: number | null;
  nextUnit: string | null;
}): boolean {
  if (!isLegacyFeedingAmount(args.existing)) return false;
  if (args.nextSubtype) return false;
  if (args.nextValue == null || args.nextUnit == null) return false;
  if (args.nextUnit.trim().toLowerCase() !== "ml") return false;
  const legacy = Number(args.existing.amount_ml);
  return Number.isFinite(legacy) && legacy === args.nextValue;
}
