import { getPetAgeDays } from "@/lib/format";

export type DewormingStatus = "done" | "due" | "overdue" | "upcoming";

export type AppliedDeworming = {
  title: string;
  occurredAt: string;
};

export type ScheduledDeworming = {
  name: string;
  label: string;
  intervalDays: number;
  dueAt: string | null;
  overdueAt: string | null;
  status: DewormingStatus;
  appliedAt: string | null;
};

const KITTEN_INTERVAL_DAYS = 30;
const KITTEN_GRACE_DAYS = 7;
const ADULT_INTERVAL_DAYS = 90;
const ADULT_GRACE_DAYS = 14;
const FIRST_DOSE_MIN_AGE_DAYS = 21;

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00-03:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function intervalForAge(ageDays: number | null) {
  if (ageDays != null && ageDays < 365) {
    return { intervalDays: KITTEN_INTERVAL_DAYS, graceDays: KITTEN_GRACE_DAYS };
  }
  return { intervalDays: ADULT_INTERVAL_DAYS, graceDays: ADULT_GRACE_DAYS };
}

function statusFromDates(dueAt: string, overdueAt: string, now = Date.now()): Exclude<DewormingStatus, "done"> {
  const dueMs = new Date(dueAt).getTime();
  const overdueMs = new Date(overdueAt).getTime();
  if (now >= overdueMs) return "overdue";
  if (now >= dueMs) return "due";
  return "upcoming";
}

/**
 * Build the next deworming reminder for a pet from birth date and applied doses.
 * Kittens (< 1 year): every 30 days. Adults: every 90 days.
 */
export function buildDewormingSchedule(
  birthDate: string | null,
  appliedDoses: AppliedDeworming[],
): ScheduledDeworming {
  const ageDays = getPetAgeDays(birthDate);
  const sorted = [...appliedDoses].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const lastApplied = sorted[0] ?? null;
  const { intervalDays, graceDays } = intervalForAge(ageDays);

  if (lastApplied) {
    const dueAt = addDays(lastApplied.occurredAt, intervalDays);
    const overdueAt = addDays(dueAt, graceDays);
    const status = statusFromDates(dueAt, overdueAt);
    return {
      name: "Vermífugo",
      label: "Próxima dose",
      intervalDays,
      dueAt,
      overdueAt,
      status,
      appliedAt: lastApplied.occurredAt,
    };
  }

  if (!birthDate || ageDays == null) {
    return {
      name: "Vermífugo",
      label: "Primeira dose",
      intervalDays,
      dueAt: null,
      overdueAt: null,
      status: "upcoming",
      appliedAt: null,
    };
  }

  const dueAt = addDays(birthDate, FIRST_DOSE_MIN_AGE_DAYS);
  const overdueAt = addDays(dueAt, graceDays);
  const status = statusFromDates(dueAt, overdueAt);

  return {
    name: "Vermífugo",
    label: "Primeira dose",
    intervalDays,
    dueAt,
    overdueAt,
    status,
    appliedAt: null,
  };
}

export function isDewormingOverdue(schedule: ScheduledDeworming): boolean {
  return schedule.status === "overdue";
}

export function isDewormingDue(schedule: ScheduledDeworming): boolean {
  return schedule.status === "due";
}

export function formatDueInDays(dueAt: string | null): string {
  if (!dueAt) return "data pendente";
  const diffDays = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
  if (diffDays < 0) return `${Math.abs(diffDays)} dia${Math.abs(diffDays) === 1 ? "" : "s"} atrás`;
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "amanhã";
  return `em ${diffDays} dias`;
}
