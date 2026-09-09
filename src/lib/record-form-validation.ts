import type { QuickRecordType } from "@/components/record-fields-types";
import { parseWeightKg } from "@/lib/format";
import {
  buildFeedingItems,
  parseFeedingEditItemsFromForm,
  parseFeedingSubtypeList,
  type FeedingItemFields,
} from "@/lib/feeding-care";
import { buildHygieneFields, buildHygieneFieldsList } from "@/lib/hygiene-care";
import { isFeedingSubtype, parseFeedingAmountValue, resolveFeedingUnitFromForm } from "@/lib/neonatal-feeding";

export function parseAmountMl(raw: string) {
  return parseFeedingAmountValue(raw);
}

export function parseTemperatureC(raw: string) {
  const parsed = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 30 || parsed > 45) return null;
  return parsed;
}

type ValidateInput = {
  petIds: string[];
  types: QuickRecordType[];
  weightKg: string;
  weightKgByPetId: Record<string, string>;
  /** Legacy neonatal edit: single subtype. */
  feedingSubtype: string;
  feedingAmountValue: string;
  feedingUnitPreset: string;
  feedingUnitOther: string;
  /** Edit of legacy feeding may omit subtype while preserving amount_ml. */
  allowLegacyFeedingWithoutSubtype?: boolean;
  /**
   * Create / session edit:
   * - create: multi-select subtype keys
   * - session edit: validated via feedingSessionItems when present
   */
  feedingSubtypes?: readonly string[];
  feedingCustomLabel?: string;
  /** When true, validate as feeding_sessions (optional amounts). When false/omit with single subtype, legacy path. */
  feedingSessionMode?: boolean;
  /** Pre-built session items (edit UI). */
  feedingSessionItems?: readonly FeedingItemFields[] | null;
  temperatureC: string;
  /** Edit: single subtype. Create multi-select may omit this and use hygieneSubtypes. */
  hygieneSubtype: string;
  /** Create multi-select keys; when present and non-empty, takes precedence over hygieneSubtype. */
  hygieneSubtypes?: readonly string[];
  hygieneCustomLabel: string;
  petNames: Map<string, string>;
};

function validateLegacyFeeding(input: ValidateInput): string | null {
  const hasSubtype = isFeedingSubtype(input.feedingSubtype);
  if (!hasSubtype && !input.allowLegacyFeedingWithoutSubtype) {
    return "Escolha o tipo de alimentação.";
  }
  if (parseFeedingAmountValue(input.feedingAmountValue) == null) {
    return "Informe a quantidade da alimentação.";
  }
  if (!resolveFeedingUnitFromForm(input.feedingUnitPreset, input.feedingUnitOther)) {
    return "Informe a unidade da quantidade.";
  }
  return null;
}

function validateSessionFeeding(input: ValidateInput): string | null {
  if (input.feedingSessionItems) {
    if (input.feedingSessionItems.length === 0) {
      return "Uma refeição precisa ter pelo menos um item.";
    }
    for (const item of input.feedingSessionItems) {
      if (!item.subtype?.trim()) return "Escolha o tipo de alimento.";
      if (item.subtype === "other" && !String(item.custom_label ?? "").trim()) {
        return "Informe qual alimento você registrou.";
      }
      const hasValue = item.amount_value != null;
      const hasUnit = Boolean(item.amount_unit?.trim());
      if (hasValue !== hasUnit) return "Quantidade e unidade devem vir juntas.";
      if (hasValue && (Number(item.amount_value) <= 0 || Number(item.amount_value) > 1000)) {
        return "Informe uma quantidade válida (até 1000).";
      }
    }
    return null;
  }
  const built = buildFeedingItems(
    input.feedingSubtypes ?? parseFeedingSubtypeList(input.feedingSubtype ? [input.feedingSubtype] : []),
    input.feedingCustomLabel ?? "",
  );
  if (!built.ok) return built.message;
  return null;
}

export function validateCreateRecordForm(input: ValidateInput): string | null {
  if (input.petIds.length === 0) return "Selecione ao menos um pet.";
  if (input.types.length === 0) return "Selecione ao menos um tipo de cuidado.";

  if (input.types.includes("weight")) {
    if (input.petIds.length === 1) {
      const petId = input.petIds[0];
      const name = input.petNames.get(petId) ?? "o pet";
      if (parseWeightKg(input.weightKg) == null) return `Informe o peso de ${name}.`;
    } else {
      const missing = input.petIds.filter((id) => parseWeightKg(input.weightKgByPetId[id] ?? "") == null);
      if (missing.length > 0) {
        const names = missing.map((id) => input.petNames.get(id) ?? "pet");
        if (names.length === 1) return `Informe o peso de ${names[0]}.`;
        if (names.length === 2) return `Informe os pesos de ${names[0]} e ${names[1]}.`;
        return `Informe os pesos de ${names.slice(0, -1).join(", ")} e ${names.at(-1)}.`;
      }
    }
  }

  if (input.types.includes("feeding")) {
    if (input.feedingSessionMode || input.feedingSubtypes !== undefined || input.feedingSessionItems) {
      const sessionError = validateSessionFeeding(input);
      if (sessionError) return sessionError;
    } else {
      const legacyError = validateLegacyFeeding(input);
      if (legacyError) return legacyError;
    }
  }

  if (input.types.includes("temperature") && parseTemperatureC(input.temperatureC) == null) {
    return "Informe uma temperatura válida.";
  }

  if (input.types.includes("hygiene")) {
    if (input.hygieneSubtypes !== undefined) {
      const multi = buildHygieneFieldsList(input.hygieneSubtypes, input.hygieneCustomLabel);
      if (!multi.ok) return multi.message;
    } else {
      const hygiene = buildHygieneFields(input.hygieneSubtype, input.hygieneCustomLabel);
      if (!hygiene.ok) return hygiene.message;
    }
  }

  return null;
}

/** Server-side helper: validate edit session items from FormData. */
export function validateFeedingSessionItemsForm(formData: FormData): string | null {
  const parsed = parseFeedingEditItemsFromForm(formData);
  if (!parsed.ok) return parsed.message;
  return null;
}
