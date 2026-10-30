/**
 * America/Sao_Paulo civil calendar for reminder recurrence.
 * The app stores the programmed clock as a fixed −03:00 offset. The zone has no
 * daylight saving since 2019, so calendar math uses that offset instead of IANA
 * history (which would turn an old 08:00−03 timestamp into 09:00).
 * public.next_reminder_due is the runtime source of truth and uses the same offset.
 */

const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;

export type RecurrenceRule = "FREQ=DAILY" | "FREQ=WEEKLY" | "FREQ=MONTHLY";

export type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function saoPauloWallClock(value: Date): WallClock {
  const shifted = new Date(value.getTime() - SAO_PAULO_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

export function wallClockToUtc(clock: WallClock): Date {
  const iso = `${pad(clock.year)}-${pad(clock.month)}-${pad(clock.day)}T${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}-03:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("invalid wall clock");
  return date;
}

function compareWall(left: WallClock, right: WallClock) {
  const order: Array<keyof WallClock> = ["year", "month", "day", "hour", "minute", "second"];
  for (const key of order) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  return 0;
}

function addCalendarDays(clock: WallClock, days: number): WallClock {
  const shifted = new Date(Date.UTC(clock.year, clock.month - 1, clock.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: clock.hour,
    minute: clock.minute,
    second: clock.second,
  };
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthIndex(clock: WallClock) {
  return clock.year * 12 + (clock.month - 1);
}

function monthlyCandidate(due: WallClock, anchor: number, steps: number): WallClock {
  const index = monthIndex(due) + steps;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const day = Math.min(anchor, lastDayOfMonth(year, month));
  return { year, month, day, hour: due.hour, minute: due.minute, second: due.second };
}

/** Soonest grid point strictly after asOf. At least one interval ahead of the scheduled due. */
export function nextReminderDue(due: Date, rule: string, anchorDay: number | null, asOf: Date): Date {
  if (rule !== "FREQ=DAILY" && rule !== "FREQ=WEEKLY" && rule !== "FREQ=MONTHLY") {
    throw new Error("unsupported recurrence");
  }
  const dueWall = saoPauloWallClock(due);
  const asOfWall = saoPauloWallClock(asOf);

  if (rule === "FREQ=DAILY" || rule === "FREQ=WEEKLY") {
    const step = rule === "FREQ=WEEKLY" ? 7 : 1;
    const dueUtc = Date.UTC(dueWall.year, dueWall.month - 1, dueWall.day);
    const asOfUtc = Date.UTC(asOfWall.year, asOfWall.month - 1, asOfWall.day);
    const dayDiff = Math.round((asOfUtc - dueUtc) / 86_400_000);
    let steps = dayDiff <= 0 ? 1 : Math.ceil(dayDiff / step);
    if (steps < 1) steps = 1;
    let candidate = addCalendarDays(dueWall, steps * step);
    if (compareWall(candidate, asOfWall) <= 0) {
      steps += 1;
      candidate = addCalendarDays(dueWall, steps * step);
    }
    if (compareWall(candidate, asOfWall) <= 0) throw new Error("recurrence did not advance");
    return wallClockToUtc(candidate);
  }

  const anchor = anchorDay ?? dueWall.day;
  if (anchor < 1 || anchor > 31) throw new Error("invalid recurrence anchor");
  let steps = monthIndex(asOfWall) - monthIndex(dueWall);
  if (steps < 1) steps = 1;
  let candidate = monthlyCandidate(dueWall, anchor, steps);
  if (compareWall(candidate, asOfWall) <= 0) {
    steps += 1;
    candidate = monthlyCandidate(dueWall, anchor, steps);
  }
  if (compareWall(candidate, asOfWall) <= 0) throw new Error("recurrence did not advance");
  return wallClockToUtc(candidate);
}

function displayedCalendarDay(iso: string) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const day = Number(formatted.find((part) => part.type === "day")?.value);
  return day >= 1 && day <= 31 ? day : null;
}

export function submittedCalendarDay(submittedDue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(submittedDue);
  if (!match) return null;
  const day = Number(match[3]);
  return day >= 1 && day <= 31 ? day : null;
}

/**
 * Monthly anchor follows the programmed day.
 * Editing notes or the time, while the displayed day stays the same, keeps a clamped month's original day.
 */
export function recurrenceAnchorDayForSave(input: {
  recurrence: "none" | "daily" | "weekly" | "monthly";
  submittedDue: string;
  currentDueAt?: string | null;
  currentRule?: string | null;
  currentAnchor?: number | null;
}) {
  if (input.recurrence !== "monthly") return null;
  const submittedDay = submittedCalendarDay(input.submittedDue);
  if (submittedDay == null) return null;
  if (
    input.currentRule === "FREQ=MONTHLY"
    && input.currentAnchor != null
    && input.currentDueAt
  ) {
    const currentDay = displayedCalendarDay(input.currentDueAt);
    if (submittedDay === currentDay) return input.currentAnchor;
  }
  return submittedDay;
}
