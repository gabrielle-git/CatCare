import type { Pet, PetLifeStage } from "@/types/database";

function dateOnly(value: string) {
  return new Date(`${value}T12:00:00`);
}

export function getPetAgeDays(birthDate: string | null) {
  if (!birthDate) return null;
  return Math.max(0, Math.floor((Date.now() - dateOnly(birthDate).getTime()) / 86_400_000));
}

export function formatPetAge(birthDate: string | null, estimated = false) {
  const days = getPetAgeDays(birthDate);
  if (days == null) return null;
  const prefix = estimated ? "cerca de " : "";
  if (days < 56) return `${prefix}${days} ${days === 1 ? "dia" : "dias"}`;
  const months = Math.max(1, Math.floor(days / 30.44));
  if (months < 24) return `${prefix}${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${prefix}${years} ${years === 1 ? "ano" : "anos"}`;
}

export function formatBirthDate(birthDate: string | null, estimated = false) {
  if (!birthDate) return null;
  const formatted = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(dateOnly(birthDate));
  return estimated ? `${formatted} (estimada)` : formatted;
}

export function formatHumanEquivalentAge(birthDate: string | null) {
  const days = getPetAgeDays(birthDate);
  if (days == null) return null;
  if (days < 30) return "menos de 1 ano humano";
  const months = days / 30.44;
  const humanYears = months <= 12
    ? Math.max(1, Math.round((months / 12) * 15))
    : months <= 24
      ? Math.round(15 + ((months - 12) / 12) * 9)
      : Math.round(24 + ((months - 24) / 12) * 4);
  return `≈ ${humanYears} ${humanYears === 1 ? "ano humano" : "anos humanos"}`;
}

export function getPetLifeStage(birthDate: string | null): PetLifeStage {
  const days = getPetAgeDays(birthDate);
  if (days == null) return "unknown";
  if (days < 56) return "neonatal";
  if (days < 365) return "kitten";
  if (days < 365 * 7) return "adult";
  if (days < 365 * 11) return "mature";
  return "senior";
}

export const petLifeStageLabels: Record<PetLifeStage, string> = {
  neonatal: "Fase neonatal",
  kitten: "Filhote",
  adult: "Adulto",
  mature: "Maduro",
  senior: "Sênior",
  unknown: "Fase não identificada",
};

export function formatWeight(grams: number | null) {
  if (grams == null) return "Sem peso";
  if (grams < 1000) return `${grams} g`;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(grams / 1000)} kg`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatCurrency(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amountCents / 100);
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value));
}

export function formatLongDate(value = new Date()) {
  const text = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function isNeonatalPet(pet: Pick<Pet, "birth_date">) {
  return getPetLifeStage(pet.birth_date) === "neonatal";
}
