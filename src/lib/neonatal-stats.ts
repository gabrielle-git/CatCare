import type { NeonatalRecord } from "@/types/database";
import { APP_TIMEZONE, formatDateTime, formatTime } from "@/lib/format";

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

function zonedCalendarDate(value: Date | string, timeZone = APP_TIMEZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function shiftCalendarDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return shifted.toISOString().slice(0, 10);
}

export function todayIsoDate(now = new Date()) {
  return zonedCalendarDate(now);
}

export function isInDateRange(iso: string, from: string, to: string) {
  const day = zonedCalendarDate(iso);
  return day >= from && day <= to;
}

export function formatTimeAgo(iso: string, now = new Date()) {
  const time = formatTime(iso);
  const thenDay = zonedCalendarDate(iso);
  const nowDay = zonedCalendarDate(now);
  if (thenDay === nowDay) return `hoje às ${time}`;
  if (thenDay === shiftCalendarDate(nowDay, -1)) return `ontem às ${time}`;
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
