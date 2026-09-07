/**
 * Factual temporal integrity.
 *
 * FACT dates/times must not be in the future.
 * PLANNING fields (agenda, reminders, routine starts, renewals, etc.) stay unrestricted.
 *
 * Strategy: compare using APP_TIMEZONE (America/Sao_Paulo), matching how the app
 * already stores civil dates as `YYYY-MM-DDT12:00:00-03:00` and datetime-local as
 * `YYYY-MM-DDTHH:mm:00-03:00`. Never use `new Date("YYYY-MM-DD")` for civil comparisons.
 */

import { APP_TIMEZONE } from "@/lib/format";

export const FACTUAL_DATE_MESSAGE = "Não é possível registrar um acontecimento em uma data futura.";
export const FACTUAL_TIME_MESSAGE = "Não é possível registrar um horário que ainda não aconteceu.";
export const FACTUAL_DATETIME_INVALID = "Informe uma data e hora válidas.";
export const FACTUAL_DATE_INVALID = "Informe uma data válida.";

const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export type FactualValidationOk = { ok: true };
export type FactualValidationErr = { ok: false; message: string };
export type FactualValidation = FactualValidationOk | FactualValidationErr;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Civil calendar parts for an instant in APP_TIMEZONE. */
export function civilPartsInAppTz(instant: Date = new Date(), timeZone: string = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** YYYY-MM-DD in APP_TIMEZONE — safe for DATE comparisons / input max. */
export function civilDateInAppTz(instant: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  const p = civilPartsInAppTz(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** YYYY-MM-DDTHH:mm in APP_TIMEZONE — safe for datetime-local max. */
export function civilDateTimeLocalInAppTz(instant: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  const p = civilPartsInAppTz(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function isCivilDateString(value: string): boolean {
  if (!CIVIL_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/**
 * Parse datetime-local as an instant using the app's fixed -03:00 offset
 * (same contract as parseLocalDateTime / memory/agenda writers).
 */
export function instantFromAppDateTimeLocal(raw: string): Date | null {
  const match = DATETIME_LOCAL_RE.exec(raw.trim());
  if (!match) return null;
  const seconds = match[6] ?? "00";
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${seconds}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Instant from stored ISO / timestamptz string. */
export function instantFromIso(raw: string): Date | null {
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Validate a civil DATE (YYYY-MM-DD) as a factual occurrence day.
 * Lexicographic compare is safe for ISO dates and avoids UTC midnight shifts.
 */
export function validateFactualCivilDate(
  dateYmd: string | null | undefined,
  now: Date = new Date(),
): FactualValidation {
  if (dateYmd == null || dateYmd.trim() === "") {
    return { ok: false, message: FACTUAL_DATE_INVALID };
  }
  const value = dateYmd.trim();
  if (!isCivilDateString(value)) {
    return { ok: false, message: FACTUAL_DATE_INVALID };
  }
  const today = civilDateInAppTz(now);
  if (value > today) {
    return { ok: false, message: FACTUAL_DATE_MESSAGE };
  }
  return { ok: true };
}

/**
 * Validate datetime-local input for a factual event.
 * Instant comparison against `now` (with optional small skew tolerance for clock drift).
 */
export function validateFactualDateTimeLocal(
  raw: string | null | undefined,
  now: Date = new Date(),
  options?: { skewMs?: number },
): FactualValidation {
  if (raw == null || raw.trim() === "") {
    return { ok: false, message: FACTUAL_DATETIME_INVALID };
  }
  const instant = instantFromAppDateTimeLocal(raw.trim());
  if (!instant) {
    return { ok: false, message: FACTUAL_DATETIME_INVALID };
  }
  const skewMs = options?.skewMs ?? 60_000;
  if (instant.getTime() > now.getTime() + skewMs) {
    const today = civilDateInAppTz(now);
    const eventDay = raw.trim().slice(0, 10);
    if (eventDay > today) {
      return { ok: false, message: FACTUAL_DATE_MESSAGE };
    }
    return { ok: false, message: FACTUAL_TIME_MESSAGE };
  }
  return { ok: true };
}

/** Validate an already-parsed ISO timestamp for a factual event. */
export function validateFactualInstant(
  iso: string | null | undefined,
  now: Date = new Date(),
  options?: { skewMs?: number },
): FactualValidation {
  if (iso == null || iso.trim() === "") {
    return { ok: false, message: FACTUAL_DATETIME_INVALID };
  }
  const instant = instantFromIso(iso.trim());
  if (!instant) {
    return { ok: false, message: FACTUAL_DATETIME_INVALID };
  }
  const skewMs = options?.skewMs ?? 60_000;
  if (instant.getTime() > now.getTime() + skewMs) {
    const today = civilDateInAppTz(now);
    const eventDay = civilDateInAppTz(instant);
    if (eventDay > today) {
      return { ok: false, message: FACTUAL_DATE_MESSAGE };
    }
    return { ok: false, message: FACTUAL_TIME_MESSAGE };
  }
  return { ok: true };
}

/** HTML max= for type=date factual fields. */
export function factualDateInputMax(now: Date = new Date()): string {
  return civilDateInAppTz(now);
}

/** HTML max= for type=datetime-local factual fields. */
export function factualDateTimeInputMax(now: Date = new Date()): string {
  return civilDateTimeLocalInAppTz(now);
}

/** Convenience for tests / callers that need yesterday/tomorrow civil dates in APP_TZ. */
export function shiftCivilDate(ymd: string, deltaDays: number): string {
  if (!isCivilDateString(ymd)) throw new Error(`invalid civil date: ${ymd}`);
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}
