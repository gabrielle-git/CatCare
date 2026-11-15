import { civilDateInAppTz, shiftCivilDate } from "@/lib/factual-datetime";
import { APP_TIMEZONE } from "@/lib/format";

export type AgendaGroups<T> = {
  late: T[];
  todayItems: T[];
  tomorrowItems: T[];
  later: T[];
};

/**
 * Classifies reminders into Atrasados (`late`), Hoje (`todayItems`), Amanhã (`tomorrowItems`),
 * and Próximos dias (`later`) using civil calendar boundaries in `APP_TIMEZONE` (`America/Sao_Paulo`),
 * independent of the host/server OS timezone.
 */
export function groupAgendaReminders<T extends { due_at: string }>(
  reminders: readonly T[],
  now: number | Date = Date.now(),
  timeZone: string = APP_TIMEZONE,
): AgendaGroups<T> {
  const nowDate = typeof now === "number" ? new Date(now) : now;
  const nowMs = nowDate.getTime();
  const todayYmd = civilDateInAppTz(nowDate, timeZone);
  const tomorrowYmd = shiftCivilDate(todayYmd, 1);

  const late: T[] = [];
  const todayItems: T[] = [];
  const tomorrowItems: T[] = [];
  const later: T[] = [];

  for (const item of reminders) {
    const dueDate = new Date(item.due_at);
    const dueMs = dueDate.getTime();
    if (dueMs < nowMs) {
      late.push(item);
      continue;
    }
    const dueYmd = civilDateInAppTz(dueDate, timeZone);
    if (dueYmd <= todayYmd) {
      todayItems.push(item);
    } else if (dueYmd === tomorrowYmd) {
      tomorrowItems.push(item);
    } else {
      later.push(item);
    }
  }

  return { late, todayItems, tomorrowItems, later };
}
