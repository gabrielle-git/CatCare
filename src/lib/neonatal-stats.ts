import type { NeonatalRecord } from "@/types/database";

export type NeonatalDailyStats = {
  petId: string;
  totalMl: number;
  feedingCount: number;
  stoolCount: number;
};

function localDayKey(iso: string, now = new Date()) {
  const date = new Date(iso);
  return date.toDateString() === now.toDateString();
}

export function computeTodayNeonatalStats(records: NeonatalRecord[], petIds: string[], now = new Date()): Map<string, NeonatalDailyStats> {
  const stats = new Map<string, NeonatalDailyStats>(
    petIds.map((petId) => [petId, { petId, totalMl: 0, feedingCount: 0, stoolCount: 0 }]),
  );

  for (const record of records) {
    if (!stats.has(record.pet_id)) continue;
    if (!localDayKey(record.occurred_at, now)) continue;

    const entry = stats.get(record.pet_id)!;
    if (record.type === "feeding") {
      entry.feedingCount += 1;
      if (record.amount_ml != null) entry.totalMl += Number(record.amount_ml);
    }
    if (record.type === "stool") entry.stoolCount += 1;
  }

  return stats;
}

export function formatNeonatalDailyStats(stats: NeonatalDailyStats) {
  const ml = stats.totalMl > 0 ? `${stats.totalMl.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ml` : "0 ml";
  const feedings = `${stats.feedingCount} mamada${stats.feedingCount === 1 ? "" : "s"}`;
  const stools = `${stats.stoolCount} cocô${stats.stoolCount === 1 ? "" : "s"}`;
  return `${ml} · ${feedings} · ${stools}`;
}
