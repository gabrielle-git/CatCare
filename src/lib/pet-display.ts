import type { Pet, PetSex } from "@/types/database";

const SEX_LABEL: Record<PetSex, string> = {
  male: "macho",
  female: "fêmea",
  unknown: "sexo não informado",
};

const SPECIES_LABEL: Record<string, string> = {
  cat: "Gato",
  dog: "Cão",
  gato: "Gato",
  cão: "Cão",
  cao: "Cão",
};

/** Short context line for pet header / list — no color, birth, weight, or microchip. */
export function petContextLine(pet: Pick<Pet, "species" | "breed" | "sex">) {
  const species = SPECIES_LABEL[pet.species.trim().toLowerCase()] ?? (pet.species.trim() || "Pet");
  const parts = [species];
  if (pet.breed?.trim()) parts.push(pet.breed.trim());
  if (pet.sex !== "unknown") parts.push(SEX_LABEL[pet.sex]);
  return parts.join(" · ");
}

export function petSexLabel(sex: PetSex) {
  if (sex === "male") return "Macho";
  if (sex === "female") return "Fêmea";
  return "Não informado";
}

export function petSpeciesLabel(species: string) {
  return SPECIES_LABEL[species.trim().toLowerCase()] ?? (species.trim() || "Não informada");
}

export function neuteredLabel(sex: PetSex) {
  return sex === "female" ? "Castrada" : "Castrado";
}

/** Weight is “recent” for overview when last weighing is within this window. */
export const RECENT_WEIGHT_DAYS = 30;

export function isRecentWeightDate(isoDate: string, withinDays = RECENT_WEIGHT_DAYS) {
  const t = Date.parse(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`);
  if (!Number.isFinite(t)) return false;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  return days >= 0 && days <= withinDays;
}
