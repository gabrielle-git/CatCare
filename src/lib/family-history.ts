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
  { value: "temperature", label: "Temperatura" },
  { value: "weight", label: "Peso" },
  { value: "vaccine", label: "Vacina" },
  { value: "deworming", label: "Vermífugo" },
  { value: "medication", label: "Remédio" },
  { value: "consultation", label: "Consulta" },
  { value: "exam", label: "Exame" },
  { value: "surgery", label: "Cirurgia" },
  { value: "observation", label: "Nota" },
  { value: "other", label: "Outro" },
] as const;

export type FamilyHistoryTypeFilter = (typeof FAMILY_HISTORY_TYPE_OPTIONS)[number]["value"];

const TYPE_VALUES = new Set<string>(FAMILY_HISTORY_TYPE_OPTIONS.map((option) => option.value));

const KIND_SEARCH_LABELS: Record<string, string> = Object.fromEntries(
  FAMILY_HISTORY_TYPE_OPTIONS.filter((option) => option.value !== "all").map((option) => [option.value, option.label]),
);

export type FamilyHistoryFilters = {
  q: string;
  from: string | null;
  to: string | null;
  type: FamilyHistoryTypeFilter;
};

/** Lowercase + strip combining marks for accent-tolerant matching. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

/**
 * Central searchable blob for a timeline row.
 * Only uses fields that exist on TimelineItem (+ optional pet name).
 * Structured for a future server-side search without UI rewrites.
 */
export function buildTimelineSearchText(
  item: TimelineItem,
  petNames?: Record<string, string> | Map<string, string>,
): string {
  const petName =
    petNames instanceof Map ? petNames.get(item.pet_id) : petNames?.[item.pet_id];
  const kindLabel = KIND_SEARCH_LABELS[item.kind] ?? item.kind;
  return [item.title, item.detail, kindLabel, petName].filter(Boolean).join(" ");
}

export function timelineItemMatchesQuery(
  item: TimelineItem,
  rawQuery: string,
  petNames?: Record<string, string> | Map<string, string>,
): boolean {
  const needle = normalizeSearchText(rawQuery);
  if (!needle) return true;
  return normalizeSearchText(buildTimelineSearchText(item, petNames)).includes(needle);
}

export function resolveFamilyHistoryType(raw: string | null | undefined): FamilyHistoryTypeFilter {
  const value = String(raw ?? "").trim();
  if (TYPE_VALUES.has(value)) return value as FamilyHistoryTypeFilter;
  return "all";
}

export function resolveFamilyHistoryQuery(raw: string | null | undefined): string {
  return String(raw ?? "").trim().slice(0, 120);
}

/**
 * Query filters for /historico (family-wide — no pet chip filter).
 * Missing from/to = no date window.
 */
export function resolveFamilyHistoryFilters(input: {
  q?: string | null;
  from?: string | null;
  to?: string | null;
  type?: string | null;
}): FamilyHistoryFilters {
  let from = input.from && isCivilDateString(input.from) ? input.from : null;
  let to = input.to && isCivilDateString(input.to) ? input.to : null;
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  return {
    q: resolveFamilyHistoryQuery(input.q),
    from,
    to,
    type: resolveFamilyHistoryType(input.type),
  };
}

export function familyHistoryHasAdvancedFilters(filters: FamilyHistoryFilters): boolean {
  return Boolean(filters.from || filters.to || filters.type !== "all");
}

/** Build /historico?... preserving active search/filters. */
export function familyHistoryHref(filters: FamilyHistoryFilters, basePath = "/historico"): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
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
  petNames?: Record<string, string> | Map<string, string>,
): TimelineItem[] {
  return items.filter((item) => {
    if (filters.type !== "all" && item.kind !== filters.type) return false;
    if (!matchesDateFilter(item.occurred_at, filters.from, filters.to)) return false;
    return timelineItemMatchesQuery(item, filters.q, petNames);
  });
}
