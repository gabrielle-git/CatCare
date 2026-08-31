import type { QuickRecordType } from "@/components/record-fields-types";
import { parseWeightKg } from "@/lib/format";

export function parseAmountMl(raw: string) {
  const parsed = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1000) return null;
  return parsed;
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
  amountMl: string;
  temperatureC: string;
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

  if (input.types.includes("feeding") && parseAmountMl(input.amountMl) == null) {
    return "Informe a quantidade da mamada.";
  }

  if (input.types.includes("temperature") && parseTemperatureC(input.temperatureC) == null) {
    return "Informe uma temperatura válida.";
  }

  return null;
}
