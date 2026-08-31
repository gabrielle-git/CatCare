import { APP_TIMEZONE } from "@/lib/format";
import type { CareRoutineCompletion } from "@/types/database";

export type RoutineHistoryGroup = {
  completedAt: string;
  petIds: string[];
  completionIds: string[];
};

function sameInstantGroup(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= 60_000;
}

export function groupRoutineCompletions(completions: CareRoutineCompletion[]): RoutineHistoryGroup[] {
  const sorted = [...completions].sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
  );
  const groups: RoutineHistoryGroup[] = [];

  for (const row of sorted) {
    const existing = groups.find((group) => sameInstantGroup(group.completedAt, row.completed_at));
    if (existing) {
      existing.petIds.push(row.pet_id);
      existing.completionIds.push(row.id);
    } else {
      groups.push({
        completedAt: row.completed_at,
        petIds: [row.pet_id],
        completionIds: [row.id],
      });
    }
  }

  return groups;
}

export function formatCompletionGroupLabel(completedAt: string, petNames: string[], now = new Date()) {
  const date = new Date(completedAt);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  const dayLabel = (() => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    if (day === today) return "Hoje";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(yesterday);
    if (day === yDay) return "Ontem";
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: APP_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
    }).format(date);
  })();

  return `${dayLabel} ${time} — ${petNames.join(" + ")}`;
}
