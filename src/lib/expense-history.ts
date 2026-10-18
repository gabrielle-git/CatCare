import type { SupabaseClient } from "@supabase/supabase-js";
import { attachExpenseLinks } from "@/lib/commerce";
import {
  EXPENSE_PAGE_SIZE,
  isInMonth,
  monthRangeUtc,
  pageCount,
  pageWindow,
  summarizeExpenses,
  type ExpenseSummary,
  type ExpenseSummaryRow,
  type MonthKey,
} from "@/lib/expense-period";
import type { Expense } from "@/types/database";

/** PostgREST caps responses (Supabase default max rows = 1000); totals read in batches below it. */
export const EXPENSE_SUMMARY_BATCH = 1000;

export type ExpenseMonthView = {
  month: MonthKey;
  summary: ExpenseSummary;
  rows: Expense[];
  page: number;
  pageCount: number;
  /** Most recent expense of the household (any month); only loaded when the month is empty. */
  lastExpenseAt: string | null;
};

/** Every expense of the month, without a row window, so totals cover the whole period. */
export async function loadExpenseMonthSummary(supabase: SupabaseClient, householdId: string, month: MonthKey): Promise<ExpenseSummary> {
  const { startIso, endIso } = monthRangeUtc(month);
  const rows: ExpenseSummaryRow[] = [];
  for (let from = 0; ; from += EXPENSE_SUMMARY_BATCH) {
    const { data, error } = await supabase
      .from("expenses")
      .select("id, amount_cents, category, shared")
      .eq("household_id", householdId)
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIso)
      .order("id", { ascending: true })
      .range(from, from + EXPENSE_SUMMARY_BATCH - 1);
    if (error) throw error;
    const batch = (data ?? []) as ExpenseSummaryRow[];
    rows.push(...batch);
    if (batch.length < EXPENSE_SUMMARY_BATCH) break;
  }
  return summarizeExpenses(rows);
}

async function loadLastExpenseAt(supabase: SupabaseClient, householdId: string) {
  const { data, error } = await supabase
    .from("expenses")
    .select("occurred_at")
    .eq("household_id", householdId)
    .order("occurred_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const first = (data ?? [])[0] as { occurred_at?: string } | undefined;
  return first?.occurred_at ?? null;
}

export async function loadExpenseMonth(
  supabase: SupabaseClient,
  householdId: string,
  month: MonthKey,
  requestedPage: number,
  pageSize: number = EXPENSE_PAGE_SIZE,
): Promise<ExpenseMonthView> {
  const summary = await loadExpenseMonthSummary(supabase, householdId, month);
  if (summary.count === 0) {
    return { month, summary, rows: [], page: 1, pageCount: 1, lastExpenseAt: await loadLastExpenseAt(supabase, householdId) };
  }
  const { startIso, endIso } = monthRangeUtc(month);
  const window = pageWindow(requestedPage, summary.count, pageSize);
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("household_id", householdId)
    .gte("occurred_at", startIso)
    .lt("occurred_at", endIso)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .range(window.from, window.to);
  if (error) throw error;
  const rows = await attachExpenseLinks(supabase, householdId, (data ?? []) as Expense[]);
  return { month, summary, rows, page: window.page, pageCount: pageCount(summary.count, pageSize), lastExpenseAt: null };
}

/** Same view computed in memory (demo mode). */
export function buildExpenseMonthView(
  expenses: Expense[],
  month: MonthKey,
  requestedPage: number,
  pageSize: number = EXPENSE_PAGE_SIZE,
): ExpenseMonthView {
  const inMonth = expenses
    .filter((item) => isInMonth(item.occurred_at, month))
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime() || b.id.localeCompare(a.id));
  const summary = summarizeExpenses(inMonth);
  if (inMonth.length === 0) {
    const last = [...expenses].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())[0];
    return { month, summary, rows: [], page: 1, pageCount: 1, lastExpenseAt: last?.occurred_at ?? null };
  }
  const window = pageWindow(requestedPage, inMonth.length, pageSize);
  return {
    month,
    summary,
    rows: inMonth.slice(window.from, window.to + 1),
    page: window.page,
    pageCount: pageCount(inMonth.length, pageSize),
    lastExpenseAt: null,
  };
}
