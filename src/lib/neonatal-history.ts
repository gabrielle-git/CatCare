import type { TimelineItem } from "@/types/database";
import { isCivilDateString } from "@/lib/factual-datetime";
import { todayIsoDate } from "@/lib/neonatal-stats";

/** Stable presentation order for neonatal history (not alphabetical). */
export const NEONATAL_HISTORY_KIND_RANK: Record<string, number> = {
  feeding: 0,
  urine: 1,
  stool: 2,
  weight: 3,
  temperature: 4,
  observation: 5,
};

export const NEONATAL_HISTORY_KINDS = new Set(Object.keys(NEONATAL_HISTORY_KIND_RANK));

export function isNeonatalHistoryKind(kind: string): boolean {
  return NEONATAL_HISTORY_KINDS.has(kind);
}

export type NeonatalHistoryRange = { from: string; to: string };

export function resolveNeonatalHistoryRange(
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
  today: string = todayIsoDate(),
): NeonatalHistoryRange {
  let from = fromRaw && isCivilDateString(fromRaw) ? fromRaw : today;
  let to = toRaw && isCivilDateString(toRaw) ? toRaw : today;
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return { from, to };
}

/** Build /neonatal/historico?... with navigable filter state. */
export function neonatalHistoryHref(range: NeonatalHistoryRange, basePath = "/neonatal/historico"): string {
  const params = new URLSearchParams();
  params.set("from", range.from);
  params.set("to", range.to);
  return `${basePath}?${params.toString()}`;
}

/**
 * Deterministic neonatal history ordering:
 * 1. occurred_at DESC
 * 2. kind rank (feeding → urine → stool → weight → temperature → observation)
 * 3. pet name (pt-BR)
 * 4. id (stable)
 */
export function compareNeonatalTimelineItems(
  a: TimelineItem,
  b: TimelineItem,
  petNames: Record<string, string> = {},
): number {
  const timeA = new Date(a.occurred_at).getTime();
  const timeB = new Date(b.occurred_at).getTime();
  if (timeA !== timeB) return timeB - timeA;

  const rankA = NEONATAL_HISTORY_KIND_RANK[a.kind] ?? 99;
  const rankB = NEONATAL_HISTORY_KIND_RANK[b.kind] ?? 99;
  if (rankA !== rankB) return rankA - rankB;

  const nameA = petNames[a.pet_id] ?? "";
  const nameB = petNames[b.pet_id] ?? "";
  const byName = nameA.localeCompare(nameB, "pt-BR", { sensitivity: "base" });
  if (byName !== 0) return byName;

  return a.id.localeCompare(b.id);
}

export function sortNeonatalTimelineItems(
  items: readonly TimelineItem[],
  petNames: Record<string, string> = {},
): TimelineItem[] {
  return [...items].sort((a, b) => compareNeonatalTimelineItems(a, b, petNames));
}
