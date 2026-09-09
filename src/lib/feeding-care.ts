/**
 * Canonical feeding catalog (feeding_sessions + feeding_items).
 * Presets live in the app; DB stores open-text subtype (+ custom_label for other).
 *
 * Form field naming (create):
 * - feeding_item_subtype          — getAll (selected components)
 * - feeding_custom_label          — required when "other" is selected
 * - feeding_amount_value__{subtype}
 * - feeding_amount_unit_preset__{subtype}
 * - feeding_amount_unit_other__{subtype}
 * - include_feeding_amount_overrides = "1"
 * - feeding_amount_override_pet   — getAll (pets with overrides)
 * - feeding_amount_value__{petId}__{subtype}
 * - feeding_amount_unit_preset__{petId}__{subtype}
 * - feeding_amount_unit_other__{petId}__{subtype}
 *
 * Form field naming (edit session — indexed, allows duplicate subtypes):
 * - feeding_item_subtype__{i}
 * - feeding_item_custom_label__{i}
 * - feeding_item_amount_value__{i}
 * - feeding_item_amount_unit_preset__{i}
 * - feeding_item_amount_unit_other__{i}
 *
 * Notes helpers: reuse neonatal-feeding (notesFieldNameForPet, resolvePetNotesForCreate, …).
 */

import {
  FEEDING_UNIT_PRESET_LABELS,
  FEEDING_UNIT_PRESETS,
  formatFeedingUnit,
  parseFeedingAmountValue,
  resolveFeedingUnitFromForm,
  type FeedingUnitPreset,
} from "@/lib/neonatal-feeding";
import type { FeedingItem } from "@/types/database";

export { FEEDING_UNIT_PRESETS, FEEDING_UNIT_PRESET_LABELS, parseFeedingAmountValue, resolveFeedingUnitFromForm };
export type { FeedingUnitPreset };

export const FEEDING_CARE_SUBTYPE_KEYS = [
  "milk",
  "wet_food",
  "puree",
  "dry_food",
  "treat",
  "homemade",
  "other",
] as const;

export type FeedingCareSubtypeKey = (typeof FEEDING_CARE_SUBTYPE_KEYS)[number];

export type FeedingCarePreset = {
  key: FeedingCareSubtypeKey;
  label: string;
  /** Extra tokens for client-side search (normalized separately). */
  searchAliases: string[];
};

export const FEEDING_CARE_PRESETS: readonly FeedingCarePreset[] = [
  {
    key: "milk",
    label: "Leite / mamadeira",
    searchAliases: ["leite", "mamadeira"],
  },
  {
    key: "wet_food",
    label: "Sachê / alimento úmido",
    searchAliases: ["sachê", "sache", "úmido", "umido", "alimento úmido", "alimento umido"],
  },
  {
    key: "puree",
    label: "Papinha",
    searchAliases: ["papinha"],
  },
  {
    key: "dry_food",
    label: "Ração seca",
    searchAliases: ["ração", "racao", "seca", "ração seca", "racao seca"],
  },
  {
    key: "treat",
    label: "Petisco",
    searchAliases: ["petisco"],
  },
  {
    key: "homemade",
    label: "Comida caseira",
    searchAliases: ["caseira", "comida caseira"],
  },
  {
    key: "other",
    label: "Outro",
    searchAliases: ["outro", "custom"],
  },
] as const;

const PRESET_BY_KEY = Object.fromEntries(FEEDING_CARE_PRESETS.map((preset) => [preset.key, preset])) as Record<
  FeedingCareSubtypeKey,
  FeedingCarePreset
>;

export const FEEDING_SESSION_TITLE = "Alimentação";

export type FeedingItemFields = {
  subtype: string;
  custom_label: string | null;
  amount_value: number | null;
  amount_unit: string | null;
};

export type FeedingSessionPayloadEntry = {
  pet_id: string;
  notes: string | null;
  items: FeedingItemFields[];
};

export function isFeedingCareSubtypeKey(value: string | null | undefined): value is FeedingCareSubtypeKey {
  return Boolean(value && (FEEDING_CARE_SUBTYPE_KEYS as readonly string[]).includes(value));
}

export function resolveFeedingCareSubtype(raw: string | null | undefined): FeedingCareSubtypeKey | null {
  const value = String(raw ?? "").trim();
  return isFeedingCareSubtypeKey(value) ? value : null;
}

export function feedingCareDisplayLabel(subtype: string | null | undefined, customLabel?: string | null): string {
  const key = String(subtype ?? "").trim();
  if (key === "other") {
    const custom = String(customLabel ?? "").trim();
    return custom || "Outro";
  }
  if (isFeedingCareSubtypeKey(key)) return PRESET_BY_KEY[key].label;
  return key || FEEDING_SESSION_TITLE;
}

export function feedingAmountValueFieldName(subtype: string) {
  return `feeding_amount_value__${subtype}`;
}

export function feedingAmountUnitPresetFieldName(subtype: string) {
  return `feeding_amount_unit_preset__${subtype}`;
}

export function feedingAmountUnitOtherFieldName(subtype: string) {
  return `feeding_amount_unit_other__${subtype}`;
}

export function feedingAmountOverridePetFieldName() {
  return "feeding_amount_override_pet";
}

export function feedingOverrideAmountValueFieldName(petId: string, subtype: string) {
  return `feeding_amount_value__${petId}__${subtype}`;
}

export function feedingOverrideAmountUnitPresetFieldName(petId: string, subtype: string) {
  return `feeding_amount_unit_preset__${petId}__${subtype}`;
}

export function feedingOverrideAmountUnitOtherFieldName(petId: string, subtype: string) {
  return `feeding_amount_unit_other__${petId}__${subtype}`;
}

export function feedingEditItemSubtypeFieldName(index: number) {
  return `feeding_item_subtype__${index}`;
}

export function feedingEditItemCustomLabelFieldName(index: number) {
  return `feeding_item_custom_label__${index}`;
}

export function feedingEditItemAmountValueFieldName(index: number) {
  return `feeding_item_amount_value__${index}`;
}

export function feedingEditItemAmountUnitPresetFieldName(index: number) {
  return `feeding_item_amount_unit_preset__${index}`;
}

export function feedingEditItemAmountUnitOtherFieldName(index: number) {
  return `feeding_item_amount_unit_other__${index}`;
}

/** Parse multi-select feeding subtypes from form (getAll or comma-separated). */
export function parseFeedingSubtypeList(raw: string | readonly string[] | null | undefined): FeedingCareSubtypeKey[] {
  const parts = Array.isArray(raw)
    ? raw.flatMap((item) => String(item).split(/[,|]+/))
    : String(raw ?? "").split(/[,|]+/);
  const seen = new Set<FeedingCareSubtypeKey>();
  const list: FeedingCareSubtypeKey[] = [];
  for (const part of parts) {
    const key = resolveFeedingCareSubtype(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    list.push(key);
  }
  return list;
}

/**
 * Amount pair: both null OR value > 0 + unit.
 * Empty value → null pair (optional), even if a unit preset is selected in the UI.
 */
export function buildFeedingAmountPair(
  valueRaw: string | null | undefined,
  unitPreset: string | null | undefined,
  unitOther: string | null | undefined,
): { ok: true; amount_value: number | null; amount_unit: string | null } | { ok: false; message: string } {
  const valueTrim = String(valueRaw ?? "").trim();
  if (!valueTrim) {
    return { ok: true, amount_value: null, amount_unit: null };
  }
  const unit = resolveFeedingUnitFromForm(String(unitPreset ?? "").trim(), String(unitOther ?? "").trim());
  if (!unit) {
    return { ok: false, message: "Quantidade e unidade devem vir juntas." };
  }
  const amount_value = parseFeedingAmountValue(valueTrim);
  if (amount_value == null) {
    return { ok: false, message: "Informe uma quantidade válida (até 1000)." };
  }
  return { ok: true, amount_value, amount_unit: unit };
}

export function buildFeedingItem(
  subtypeRaw: string | null | undefined,
  customRaw: string | null | undefined,
  valueRaw?: string | null,
  unitPreset?: string | null,
  unitOther?: string | null,
): { ok: true; item: FeedingItemFields } | { ok: false; message: string } {
  const subtype = resolveFeedingCareSubtype(subtypeRaw);
  if (!subtype) return { ok: false, message: "Escolha o tipo de alimento." };
  const custom = String(customRaw ?? "").trim();
  if (subtype === "other") {
    if (!custom) return { ok: false, message: "Informe qual alimento você registrou." };
  }
  const amount = buildFeedingAmountPair(valueRaw, unitPreset, unitOther);
  if (!amount.ok) return amount;
  return {
    ok: true,
    item: {
      subtype,
      custom_label: subtype === "other" ? custom : null,
      amount_value: amount.amount_value,
      amount_unit: amount.amount_unit,
    },
  };
}

/**
 * Build default items for selected components (create multi-select).
 * "other" shares a single custom label across the selection.
 */
export function buildFeedingItems(
  subtypesRaw: string | readonly string[] | null | undefined,
  customRaw: string | null | undefined,
  amountBySubtype?: ReadonlyMap<string, { value: string; unitPreset: string; unitOther: string }> | null,
): { ok: true; items: FeedingItemFields[] } | { ok: false; message: string } {
  const list = parseFeedingSubtypeList(subtypesRaw);
  if (list.length === 0) return { ok: false, message: "Escolha ao menos um alimento." };
  const custom = String(customRaw ?? "").trim();
  if (list.includes("other") && !custom) {
    return { ok: false, message: "Informe qual alimento você registrou." };
  }
  const items: FeedingItemFields[] = [];
  for (const subtype of list) {
    const amounts = amountBySubtype?.get(subtype);
    const built = buildFeedingItem(
      subtype,
      subtype === "other" ? custom : null,
      amounts?.value,
      amounts?.unitPreset ?? "ml",
      amounts?.unitOther,
    );
    if (!built.ok) return built;
    items.push(built.item);
  }
  return { ok: true, items };
}

/** Read default amount map from FormData for selected subtypes. */
export function readFeedingDefaultAmountsFromForm(
  formData: FormData,
  subtypes: readonly FeedingCareSubtypeKey[],
): Map<string, { value: string; unitPreset: string; unitOther: string }> {
  const map = new Map<string, { value: string; unitPreset: string; unitOther: string }>();
  for (const subtype of subtypes) {
    map.set(subtype, {
      value: String(formData.get(feedingAmountValueFieldName(subtype)) ?? "").trim(),
      unitPreset: String(formData.get(feedingAmountUnitPresetFieldName(subtype)) ?? "ml").trim() || "ml",
      unitOther: String(formData.get(feedingAmountUnitOtherFieldName(subtype)) ?? "").trim(),
    });
  }
  return map;
}

/** Apply per-pet amount overrides on top of default items (empty override inherits default). */
export function applyFeedingAmountOverrides(
  defaults: readonly FeedingItemFields[],
  petId: string,
  formData: FormData,
  overridePetIds: ReadonlySet<string>,
): { ok: true; items: FeedingItemFields[] } | { ok: false; message: string } {
  if (!overridePetIds.has(petId)) {
    return { ok: true, items: defaults.map((item) => ({ ...item })) };
  }
  const items: FeedingItemFields[] = [];
  for (const base of defaults) {
    const valueRaw = String(formData.get(feedingOverrideAmountValueFieldName(petId, base.subtype)) ?? "").trim();
    const unitPresetRaw = String(formData.get(feedingOverrideAmountUnitPresetFieldName(petId, base.subtype)) ?? "").trim();
    const unitOther = String(formData.get(feedingOverrideAmountUnitOtherFieldName(petId, base.subtype)) ?? "").trim();
    // Completely empty override → inherit default pair.
    if (!valueRaw && !unitPresetRaw && !unitOther) {
      items.push({ ...base });
      continue;
    }
    const fallbackUnit = unitPresetFromStoredUnit(base.amount_unit);
    const valueForPair = valueRaw || (base.amount_value != null ? String(base.amount_value) : "");
    const presetForPair = unitPresetRaw || fallbackUnit.preset;
    const otherForPair = unitPresetRaw === "other" || (!unitPresetRaw && fallbackUnit.preset === "other")
      ? (unitOther || fallbackUnit.other)
      : unitOther;
    const amount = buildFeedingAmountPair(valueForPair, presetForPair, otherForPair);
    if (!amount.ok) return amount;
    items.push({
      ...base,
      amount_value: amount.amount_value,
      amount_unit: amount.amount_unit,
    });
  }
  return { ok: true, items };
}

/**
 * Build RPC payload for create_feeding_sessions_batch.
 * Shared quality is passed separately; per-pet notes + amount overrides apply here.
 */
export function buildFeedingSessionBatchPayload(args: {
  petIds: readonly string[];
  notesByPetId: ReadonlyMap<string, string | null> | ((petId: string) => string | null);
  defaultItems: readonly FeedingItemFields[];
  formData?: FormData | null;
  overridePetIds?: ReadonlySet<string>;
}): { ok: true; payload: FeedingSessionPayloadEntry[] } | { ok: false; message: string } {
  if (args.petIds.length === 0) return { ok: false, message: "Selecione ao menos um pet." };
  if (args.defaultItems.length === 0) return { ok: false, message: "Escolha ao menos um alimento." };

  const notesFor = (petId: string) =>
    typeof args.notesByPetId === "function" ? args.notesByPetId(petId) : (args.notesByPetId.get(petId) ?? null);

  const overridePets = args.overridePetIds ?? new Set<string>();
  const payload: FeedingSessionPayloadEntry[] = [];

  for (const petId of args.petIds) {
    let items = args.defaultItems.map((item) => ({ ...item }));
    if (args.formData && overridePets.size > 0) {
      const applied = applyFeedingAmountOverrides(items, petId, args.formData, overridePets);
      if (!applied.ok) return applied;
      items = applied.items;
    }
    payload.push({
      pet_id: petId,
      notes: notesFor(petId),
      items,
    });
  }
  return { ok: true, payload };
}

/** Parse indexed edit items from FormData (contiguous from 0 until missing subtype). */
export function parseFeedingEditItemsFromForm(
  formData: FormData,
): { ok: true; items: FeedingItemFields[] } | { ok: false; message: string } {
  const items: FeedingItemFields[] = [];
  for (let i = 0; i < 40; i += 1) {
    const subtypeRaw = String(formData.get(feedingEditItemSubtypeFieldName(i)) ?? "").trim();
    if (!subtypeRaw) break;
    const built = buildFeedingItem(
      subtypeRaw,
      String(formData.get(feedingEditItemCustomLabelFieldName(i)) ?? ""),
      String(formData.get(feedingEditItemAmountValueFieldName(i)) ?? ""),
      String(formData.get(feedingEditItemAmountUnitPresetFieldName(i)) ?? "ml"),
      String(formData.get(feedingEditItemAmountUnitOtherFieldName(i)) ?? ""),
    );
    if (!built.ok) return built;
    items.push(built.item);
  }
  if (items.length === 0) return { ok: false, message: "Uma refeição precisa ter pelo menos um item." };
  return { ok: true, items };
}

/** Create: pets × 1 feeding session (components do not multiply count). */
export function countFeedingAwareCreateRecords(
  types: readonly string[],
  petCount: number,
  hygieneCareCount: number,
): number {
  if (petCount <= 0 || types.length === 0) return 0;
  let units = 0;
  for (const type of types) {
    if (type === "hygiene") units += Math.max(hygieneCareCount, 0);
    else units += 1; // feeding = 1 session per pet
  }
  return units * petCount;
}

export function formatFeedingItemAmountLabel(item: Pick<FeedingItemFields, "amount_value" | "amount_unit">): string | null {
  if (item.amount_value == null || !item.amount_unit) return null;
  const value = Number(item.amount_value);
  if (!Number.isFinite(value) || value <= 0) return null;
  const formatted = value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${formatted} ${formatFeedingUnit(item.amount_unit)}`;
}

export function formatFeedingItemLine(item: Pick<FeedingItemFields, "subtype" | "custom_label" | "amount_value" | "amount_unit">): string {
  const label = feedingCareDisplayLabel(item.subtype, item.custom_label);
  const amount = formatFeedingItemAmountLabel(item);
  return amount ? `${label} ${amount}` : label;
}

/** One session detail line: "Ração seca 25 g · Sachê 20 g". */
export function formatFeedingSessionDetail(
  items: readonly Pick<FeedingItemFields, "subtype" | "custom_label" | "amount_value" | "amount_unit">[],
): string {
  return items.map(formatFeedingItemLine).join(" · ");
}

export function feedingSessionTimelineTitle() {
  return FEEDING_SESSION_TITLE;
}

export function feedingItemAmountInMl(item: Pick<FeedingItemFields, "amount_value" | "amount_unit">): number | null {
  if (item.amount_value == null || !item.amount_unit) return null;
  if (item.amount_unit.trim().toLowerCase() !== "ml") return null;
  const value = Number(item.amount_value);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function feedingSessionTotalMl(
  items: readonly Pick<FeedingItemFields, "amount_value" | "amount_unit">[],
): number {
  let total = 0;
  for (const item of items) {
    const ml = feedingItemAmountInMl(item);
    if (ml != null) total += ml;
  }
  return total;
}

/** Extra searchable tokens for feeding timeline rows (session or legacy). */
export function feedingSearchExtras(
  itemsOrDetail?:
    | readonly Pick<FeedingItemFields, "subtype" | "custom_label">[]
    | string
    | null,
): string {
  const parts: string[] = ["alimentação", "alimentacao", "refeição", "refeicao", "comida"];
  if (typeof itemsOrDetail === "string") {
    const detail = itemsOrDetail.trim();
    if (detail) parts.push(detail);
    for (const preset of FEEDING_CARE_PRESETS) {
      if (detail.toLocaleLowerCase("pt-BR").includes(preset.label.toLocaleLowerCase("pt-BR"))) {
        parts.push(preset.label, ...preset.searchAliases);
      }
    }
    return parts.join(" ");
  }
  if (Array.isArray(itemsOrDetail)) {
    for (const item of itemsOrDetail) {
      const key = String(item.subtype ?? "").trim();
      if (isFeedingCareSubtypeKey(key)) {
        const preset = PRESET_BY_KEY[key];
        parts.push(preset.label, ...preset.searchAliases);
      }
      if (key === "other") {
        const custom = String(item.custom_label ?? "").trim();
        if (custom) parts.push(custom);
      }
    }
  }
  return parts.join(" ");
}

export function feedingSearchExtrasFromDisplay(title: string | null | undefined, detail: string | null | undefined): string {
  return feedingSearchExtras([title, detail].filter(Boolean).join(" "));
}

/** Map DB FeedingItem rows into form-friendly fields. */
export function feedingItemsFromRows(rows: readonly FeedingItem[]): FeedingItemFields[] {
  return rows.map((row) => ({
    subtype: row.subtype,
    custom_label: row.custom_label,
    amount_value: row.amount_value,
    amount_unit: row.amount_unit,
  }));
}

export function unitPresetFromStoredUnit(unit: string | null | undefined): { preset: FeedingUnitPreset; other: string } {
  const value = String(unit ?? "").trim();
  if (value === "ml" || value === "g" || value === "spoon") return { preset: value, other: "" };
  if (value) return { preset: "other", other: value };
  return { preset: "ml", other: "" };
}
