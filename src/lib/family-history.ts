import { isCivilDateString } from "@/lib/factual-datetime";
import { isInDateRange } from "@/lib/neonatal-stats";
import type { TimelineItem } from "@/types/database";

/** Soft fetch cap for the first household history page — not a UI metric. */
export const FAMILY_HISTORY_FETCH_LIMIT = 500;

/** Home mini-history preview size. */
export const HOME_ACTIVITY_PREVIEW_LIMIT = 3;

export const FAMILY_HISTORY_TYPE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "feeding", label: "Alimentação" },
  { value: "urine", label: "Xixi" },
  { value: "stool", label: "Cocô" },
  { value: "temperature", label: "Temp." },
  { value: "weight", label: "Peso" },
  { value: "vaccine", label: "Vacina" },
  { value: "deworming", label: "Vermífugo" },
  { value: "medication", label: "Remédio" },
  { value: "consultation", label: "Consulta" },
  { value: "observation", label: "Nota" },
] as const;

export type FamilyHistoryTypeFilter = (typeof FAMILY_HISTORY_TYPE_OPTIONS)[number]["value"];

const TYPE_VALUES = new Set<string>(FAMILY_HISTORY_TYPE_OPTIONS.map((option) => option.value));

export type FamilyHistoryFilters = {
  petId: string | null;
  from: string | null;
  to: string | null;
  type: FamilyHistoryTypeFilter;
};

export function resolveFamilyHistoryType(raw: string | null | undefined): FamilyHistoryTypeFilter {
  const value = String(raw ?? "").trim();
  if (TYPE_VALUES.has(value)) return value as FamilyHistoryTypeFilter;
  return "all";
}

/**
 * Query filters for /historico.
 * Missing from/to = no date window (show all loaded events).
 * Invalid civil dates are ignored (search filters, not factual writes).
 */
export function resolveFamilyHistoryFilters(input: {
  pet?: string | null;
  from?: string | null;
  to?: string | null;
  type?: string | null;
  knownPetIds?: ReadonlySet<string> | readonly string[];
}): FamilyHistoryFilters {
  const known = input.knownPetIds
    ? input.knownPetIds instanceof Set
      ? input.knownPetIds
      : new Set(input.knownPetIds)
    : null;

  const petRaw = String(input.pet ?? "").trim();
  const petId = petRaw && (!known || known.has(petRaw)) ? petRaw : null;

  let from = input.from && isCivilDateString(input.from) ? input.from : null;
  let to = input.to && isCivilDateString(input.to) ? input.to : null;
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  return {
    petId,
    from,
    to,
    type: resolveFamilyHistoryType(input.type),
  };
}

/** Build /historico?... preserving only active filters. */
export function familyHistoryHref(filters: FamilyHistoryFilters, basePath = "/historico"): string {
  const params = new URLSearchParams();
  if (filters.petId) params.set("pet", filters.petId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.type !== "all") params.set("type", filters.type);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function matchesDateFilter(occurredAt: string, from: string | null, to: string | null): boolean {
  if (!from && !to) return true;
  if (from && to) return isInDateRange(occurredAt, from, to);
  if (from) return isInDateRange(occurredAt, from, "9999-12-31");
  return isInDateRange(occurredAt, "0001-01-01", to!);
}

export function filterFamilyHistoryItems(
  items: readonly TimelineItem[],
  filters: FamilyHistoryFilters,
): TimelineItem[] {
  return items.filter((item) => {
    if (filters.petId && item.pet_id !== filters.petId) return false;
    if (filters.type !== "all" && item.kind !== filters.type) return false;
    return matchesDateFilter(item.occurred_at, filters.from, filters.to);
  });
}
