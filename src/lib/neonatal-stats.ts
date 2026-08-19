import type { NeonatalRecord } from "@/types/database";
import { formatDateTime, formatTime } from "@/lib/format";

export type NeonatalDailyStats = {
  petId: string;
  totalMl: number;
  feedingCount: number;
  stoolCount: number;
  urineCount: number;
};

export type NeonatalPetSummary = NeonatalDailyStats & {
  lastFeedingAt: string | null;
  lastFeedingMl: number | null;
  lastStoolAt: string | null;
  lastUrineAt: string | null;
};

export type NeonatalHouseholdSummary = {
  totalMl: number;
  feedingCount: number;
  stoolCount: number;
  urineCount: number;
};

export function todayIsoDate(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isInDateRange(iso: string, from: string, to: string) {
  const day = iso.slice(0, 10);
  return day >= from && day <= to;
}

export function formatTimeAgo(iso: string, now = new Date()) {
  const then = new Date(iso);
  const diffMs = Math.max(0, now.getTime() - then.getTime());
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora há pouco";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24 && then.toDateString() === now.toDateString()) return `há ${diffH} h`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (then.toDateString() === yesterday.toDateString()) return `ontem às ${formatTime(iso)}`;
  return formatDateTime(iso);
}

export function computeNeonatalSummaries(
  records: NeonatalRecord[],
  petIds: string[],
  range?: { from: string; to: string },
): Map<string, NeonatalPetSummary> {
  const stats = new Map<string, NeonatalPetSummary>(
    petIds.map((petId) => [
      petId,
      {
        petId,
        totalMl: 0,
        feedingCount: 0,
        stoolCount: 0,
        urineCount: 0,
        lastFeedingAt: null,
        lastFeedingMl: null,
        lastStoolAt: null,
        lastUrineAt: null,
      },
    ]),
  );

  const inRange = (iso: string) => !range || isInDateRange(iso, range.from, range.to);

  for (const record of records) {
    if (!stats.has(record.pet_id)) continue;
    const entry = stats.get(record.pet_id)!;

    if (record.type === "feeding") {
      if (!entry.lastFeedingAt || new Date(record.occurred_at) > new Date(entry.lastFeedingAt)) {
        entry.lastFeedingAt = record.occurred_at;
        entry.lastFeedingMl = record.amount_ml != null ? Number(record.amount_ml) : null;
      }
    }
    if (record.type === "stool" && (!entry.lastStoolAt || new Date(record.occurred_at) > new Date(entry.lastStoolAt))) {
      entry.lastStoolAt = record.occurred_at;
    }
    if (record.type === "urine" && (!entry.lastUrineAt || new Date(record.occurred_at) > new Date(entry.lastUrineAt))) {
      entry.lastUrineAt = record.occurred_at;
    }
  }

  for (const record of records) {
    if (!stats.has(record.pet_id)) continue;
    if (!inRange(record.occurred_at)) continue;

    const entry = stats.get(record.pet_id)!;

    if (record.type === "feeding") {
      entry.feedingCount += 1;
      if (record.amount_ml != null) entry.totalMl += Number(record.amount_ml);
    }
    if (record.type === "stool") entry.stoolCount += 1;
    if (record.type === "urine") entry.urineCount += 1;
  }

  return stats;
}

export function aggregateHouseholdSummary(summaries: Map<string, NeonatalPetSummary>): NeonatalHouseholdSummary {
  const totals = { totalMl: 0, feedingCount: 0, stoolCount: 0, urineCount: 0 };
  for (const entry of summaries.values()) {
    totals.totalMl += entry.totalMl;
    totals.feedingCount += entry.feedingCount;
    totals.stoolCount += entry.stoolCount;
    totals.urineCount += entry.urineCount;
  }
  return totals;
}

export function formatNeonatalDailyStats(stats: Pick<NeonatalDailyStats, "totalMl" | "feedingCount" | "stoolCount" | "urineCount">) {
  const ml = `${stats.totalMl.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ml`;
  const feedings = `${stats.feedingCount} mamada${stats.feedingCount === 1 ? "" : "s"}`;
  const stools = `${stats.stoolCount} cocô${stats.stoolCount === 1 ? "" : "s"}`;
  const urines = `${stats.urineCount} xixi${stats.urineCount === 1 ? "" : "s"}`;
  return `${ml} · ${feedings} · ${stools} · ${urines}`;
}

export function formatPeriodLabel(from: string, to: string) {
  if (from === to) return "no dia selecionado";
  return `de ${formatShortBr(from)} a ${formatShortBr(to)}`;
}

function formatShortBr(iso: string) {
  const [, m, d] = iso.split("-");
  const y = iso.slice(0, 4);
  return `${d}/${m}/${y.slice(2)}`;
}
