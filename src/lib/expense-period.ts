import { civilPartsInAppTz } from "@/lib/factual-datetime";
import { APP_TIMEZONE } from "@/lib/format";
import type { Expense, ExpenseCategory } from "@/types/database";

/** Calendar month in APP_TIMEZONE, formatted `YYYY-MM`. */
export type MonthKey = string;

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export const EXPENSE_PAGE_SIZE = 20;
const MAX_PAGE = 10_000;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function splitMonthKey(key: MonthKey) {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

export function monthKeyOf(instant: Date | string, timeZone: string = APP_TIMEZONE): MonthKey {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const parts = civilPartsInAppTz(date, timeZone);
  return `${parts.year}-${parts.month}`;
}

export function currentMonthKey(now: Date = new Date(), timeZone: string = APP_TIMEZONE): MonthKey {
  return monthKeyOf(now, timeZone);
}

export function parseMonthKey(raw: unknown): MonthKey | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  const match = MONTH_KEY_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  return value;
}

export function shiftMonthKey(key: MonthKey, delta: number): MonthKey {
  const { year, month } = splitMonthKey(key);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${pad2((index % 12) + 1)}`;
}

/** Requested month from the URL; invalid or future months fall back to the current month. */
export function resolveRequestedMonth(raw: unknown, now: Date = new Date(), timeZone: string = APP_TIMEZONE): MonthKey {
  const current = currentMonthKey(now, timeZone);
  const parsed = parseMonthKey(raw);
  if (!parsed || parsed > current) return current;
  return parsed;
}

/** UTC instant of local midnight on the 1st of the month in `timeZone` (handles offset changes). */
function monthStartInstant(year: number, month: number, timeZone: string) {
  const target = Date.UTC(year, month - 1, 1, 0, 0, 0);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = civilPartsInAppTz(new Date(guess), timeZone);
    const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const diff = asUtc - target;
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess);
}

/** Half-open interval [startIso, endIso) covering the whole month in `timeZone`. */
export function monthRangeUtc(key: MonthKey, timeZone: string = APP_TIMEZONE) {
  const { year, month } = splitMonthKey(key);
  const next = splitMonthKey(shiftMonthKey(key, 1));
  return {
    startIso: monthStartInstant(year, month, timeZone).toISOString(),
    endIso: monthStartInstant(next.year, next.month, timeZone).toISOString(),
  };
}

export function isInMonth(instant: Date | string, key: MonthKey, timeZone: string = APP_TIMEZONE) {
  return monthKeyOf(instant, timeZone) === key;
}

export function formatMonthLabel(key: MonthKey) {
  const { year, month } = splitMonthKey(key);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 15)));
}

export type ExpenseSummaryRow = Pick<Expense, "amount_cents" | "category" | "shared">;

export type ExpenseSummary = {
  count: number;
  total: number;
  shared: number;
  individual: number;
  byCategory: { category: ExpenseCategory; total: number }[];
};

export function summarizeExpenses(rows: ExpenseSummaryRow[]): ExpenseSummary {
  let total = 0;
  let shared = 0;
  const byCategory = new Map<ExpenseCategory, number>();
  for (const row of rows) {
    total += row.amount_cents;
    if (row.shared) shared += row.amount_cents;
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount_cents);
  }
  return {
    count: rows.length,
    total,
    shared,
    individual: total - shared,
    byCategory: [...byCategory.entries()]
      .filter(([, value]) => value > 0)
      .map(([category, value]) => ({ category, total: value }))
      .sort((a, b) => b.total - a.total),
  };
}

export function parsePageParam(raw: unknown): number {
  if (typeof raw !== "string" || !/^\d{1,6}$/.test(raw.trim())) return 1;
  const page = Number(raw.trim());
  if (page < 1) return 1;
  return Math.min(page, MAX_PAGE);
}

export function pageCount(count: number, pageSize: number = EXPENSE_PAGE_SIZE) {
  return Math.max(1, Math.ceil(count / pageSize));
}

/** Clamps `page` into the available pages and returns the inclusive row window. */
export function pageWindow(page: number, count: number, pageSize: number = EXPENSE_PAGE_SIZE) {
  const safePage = Math.min(Math.max(1, page), pageCount(count, pageSize));
  const from = (safePage - 1) * pageSize;
  return { page: safePage, from, to: from + pageSize - 1 };
}
