import type { QuickRecordType } from "@/components/record-fields-types";
import { parseWeightKg } from "@/lib/format";
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
  feedingSubtype: string;
  feedingAmountValue: string;
  feedingUnitPreset: string;
  feedingUnitOther: string;
  /** Edit of legacy feeding may omit subtype while preserving amount_ml. */
  allowLegacyFeedingWithoutSubtype?: boolean;
  temperatureC: string;
  /** Edit: single subtype. Create multi-select may omit this and use hygieneSubtypes. */
  hygieneSubtype: string;
  /** Create multi-select keys; when present and non-empty, takes precedence over hygieneSubtype. */
  hygieneSubtypes?: readonly string[];
  hygieneCustomLabel: string;
  petNames: Map<string, string>;
};

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
