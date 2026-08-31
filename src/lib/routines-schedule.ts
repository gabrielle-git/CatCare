import { APP_TIMEZONE } from "@/lib/format";
import type { CareRoutine } from "@/types/database";

export type PetRoutineStatusKind = "paused" | "as_needed" | "overdue" | "due_today" | "upcoming" | "done";

export type PetRoutineStatus = {
  kind: PetRoutineStatusKind;
  label: string;
  nextDueAt: Date | null;
  nextDueDateIso: string | null;
  nextDueHasTime: boolean;
  completedToday: boolean;
};

type CompletionLike = { pet_id: string; completed_at: string };

function datePartsInTz(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addCalendarDays(dateIso: string, days: number) {
  const base = new Date(`${dateIso}T12:00:00-03:00`);
  base.setDate(base.getDate() + days);
  return datePartsInTz(base);
}

function isSameCalendarDay(a: Date, b: Date) {
  return datePartsInTz(a) === datePartsInTz(b);
}

function compareCalendarDates(a: string, b: string) {
  return a.localeCompare(b);
}

function hasPreferredTime(preferredTime: string | null) {
  return !!preferredTime && /^\d{2}:\d{2}/.test(preferredTime);
}

/** Instante exato quando há horário preferido; null quando é “em algum momento do dia”. */
export function routineDueInstant(dateIso: string, preferredTime: string | null): Date | null {
  if (!hasPreferredTime(preferredTime)) return null;
  const match = /^(\d{2}):(\d{2})/.exec(preferredTime!);
  if (!match) return null;
  return new Date(`${dateIso}T${match[1]}:${match[2]}:00-03:00`);
}

function nextDueDateIso(
  routine: Pick<CareRoutine, "starts_on" | "recurrence_days">,
  lastCompletion: CompletionLike | null,
) {
  if (lastCompletion) {
    return addCalendarDays(datePartsInTz(new Date(lastCompletion.completed_at)), routine.recurrence_days ?? 1);
  }
  return routine.starts_on;
}

function statusFromDateOnly(today: string, dueDateIso: string, completedToday: boolean): PetRoutineStatus {
  const cmp = compareCalendarDates(today, dueDateIso);
  if (cmp < 0) {
    return {
      kind: "done",
      label: completedToday ? "Concluído hoje" : "Em dia",
      nextDueAt: null,
      nextDueDateIso: dueDateIso,
      nextDueHasTime: false,
      completedToday,
    };
  }
  if (cmp === 0) {
    return {
      kind: "due_today",
      label: "Para hoje",
      nextDueAt: null,
      nextDueDateIso: dueDateIso,
      nextDueHasTime: false,
      completedToday: false,
    };
  }
  return {
    kind: "overdue",
    label: "Atrasada",
    nextDueAt: null,
    nextDueDateIso: dueDateIso,
    nextDueHasTime: false,
    completedToday: false,
  };
}

export function getPetRoutineStatus(
  routine: Pick<CareRoutine, "active" | "starts_on" | "preferred_time" | "recurrence_days">,
  lastCompletion: CompletionLike | null,
  now = new Date(),
): PetRoutineStatus {
  if (!routine.active) {
    return { kind: "paused", label: "Pausada", nextDueAt: null, nextDueDateIso: null, nextDueHasTime: false, completedToday: false };
  }
  if (routine.recurrence_days == null) {
    return { kind: "as_needed", label: "Quando necessário", nextDueAt: null, nextDueDateIso: null, nextDueHasTime: false, completedToday: false };
  }

  const today = datePartsInTz(now);
  const completedToday = lastCompletion ? isSameCalendarDay(new Date(lastCompletion.completed_at), now) : false;
  const dueDateIso = nextDueDateIso(routine, lastCompletion);
  const timed = hasPreferredTime(routine.preferred_time);
  const dueInstant = timed ? routineDueInstant(dueDateIso, routine.preferred_time) : null;

  if (!timed) {
    if (lastCompletion) {
      const cmp = compareCalendarDates(today, dueDateIso);
      if (cmp < 0) {
        return {
          kind: "done",
          label: completedToday ? "Concluído hoje" : "Em dia",
          nextDueAt: null,
          nextDueDateIso: dueDateIso,
          nextDueHasTime: false,
          completedToday,
        };
      }
      return statusFromDateOnly(today, dueDateIso, false);
    }

    const cmp = compareCalendarDates(today, dueDateIso);
    if (cmp < 0) {
      return { kind: "upcoming", label: "Próxima", nextDueAt: null, nextDueDateIso: dueDateIso, nextDueHasTime: false, completedToday: false };
    }
    if (cmp === 0) {
      return { kind: "due_today", label: "Para hoje", nextDueAt: null, nextDueDateIso: dueDateIso, nextDueHasTime: false, completedToday: false };
    }
    return { kind: "overdue", label: "Atrasada", nextDueAt: null, nextDueDateIso: dueDateIso, nextDueHasTime: false, completedToday: false };
  }

  if (!dueInstant) {
    return statusFromDateOnly(today, dueDateIso, completedToday);
  }

  if (lastCompletion) {
    if (now.getTime() < dueInstant.getTime()) {
      return {
        kind: "done",
        label: completedToday ? "Concluído hoje" : "Em dia",
        nextDueAt: dueInstant,
        nextDueDateIso: dueDateIso,
        nextDueHasTime: true,
        completedToday,
      };
    }
    return {
      kind: "overdue",
      label: "Atrasada",
      nextDueAt: dueInstant,
      nextDueDateIso: dueDateIso,
      nextDueHasTime: true,
      completedToday: false,
    };
  }

  if (now.getTime() < dueInstant.getTime()) {
    return {
      kind: isSameCalendarDay(dueInstant, now) ? "due_today" : "upcoming",
      label: isSameCalendarDay(dueInstant, now) ? "Para hoje" : "Próxima",
      nextDueAt: dueInstant,
      nextDueDateIso: dueDateIso,
      nextDueHasTime: true,
      completedToday: false,
    };
  }

  return {
    kind: "overdue",
    label: "Atrasada",
    nextDueAt: dueInstant,
    nextDueDateIso: dueDateIso,
    nextDueHasTime: true,
    completedToday: false,
  };
}

export type RoutineListSection = "attention" | "upcoming" | "as_needed" | "paused";

export function routineListSection(
  routine: Pick<CareRoutine, "active" | "recurrence_days">,
  petStatuses: PetRoutineStatus[],
): RoutineListSection {
  if (!routine.active) return "paused";
  if (routine.recurrence_days == null) return "as_needed";
  if (petStatuses.some((s) => s.kind === "overdue" || s.kind === "due_today")) return "attention";
  return "upcoming";
}

export function formatRecurrenceLabel(recurrenceDays: number | null) {
  if (recurrenceDays == null) return "Quando necessário";
  if (recurrenceDays === 1) return "Todos os dias";
  if (recurrenceDays === 7) return "Toda semana";
  if (recurrenceDays === 30) return "A cada 30 dias";
  return `A cada ${recurrenceDays} dias`;
}

export function formatPreferredTime(preferredTime: string | null) {
  if (!preferredTime) return null;
  const match = /^(\d{2}):(\d{2})/.exec(preferredTime);
  if (!match) return preferredTime;
  return `${match[1]}:${match[2]}`;
}

export function formatNextDueShort(status: Pick<PetRoutineStatus, "nextDueDateIso" | "nextDueHasTime" | "nextDueAt">) {
  if (!status.nextDueDateIso) return null;
  if (status.nextDueHasTime && status.nextDueAt) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: APP_TIMEZONE,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(status.nextDueAt);
  }
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "short",
  }).format(new Date(`${status.nextDueDateIso}T12:00:00-03:00`));
}
