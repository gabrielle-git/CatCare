import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildExpenseMonthView, EXPENSE_SUMMARY_BATCH, loadExpenseMonth, loadExpenseMonthSummary } from "@/lib/expense-history";
import {
  currentMonthKey,
  formatMonthLabel,
  isInMonth,
  monthKeyOf,
  monthRangeUtc,
  pageWindow,
  parseMonthKey,
  parsePageParam,
  resolveRequestedMonth,
  shiftMonthKey,
  summarizeExpenses,
} from "@/lib/expense-period";
import { demoExpenses } from "@/lib/mock-data";
import type { Expense, ExpenseCategory } from "@/types/database";

const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const PET_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const POSTGREST_MAX_ROWS = 1000;

type Row = Record<string, unknown>;

function expense(id: string, occurredAt: string, amount: number, overrides: Partial<Expense> = {}): Expense {
  return {
    id,
    household_id: HOUSEHOLD_A,
    pet_id: null,
    health_record_id: null,
    category: "food",
    description: `Gasto ${id}`,
    amount_cents: amount,
    occurred_at: occurredAt,
    shared: false,
    receipt_path: null,
    notes: null,
    created_at: occurredAt,
    ...overrides,
  };
}

/**
 * In-memory PostgREST stand-in for a member of `viewer`: RLS hides other households' rows,
 * and every response is capped at POSTGREST_MAX_ROWS like Supabase's default `max_rows`.
 */
function rlsClient(viewer: string, seed: Record<string, Row[]>) {
  const queries: { table: string; eqs: [string, unknown][] }[] = [];
  const client = {
    from(table: string) {
      const rows = seed[table] ?? [];
      const eqs: [string, unknown][] = [];
      const filters: ((row: Row) => boolean)[] = [];
      const orders: [string, boolean][] = [];
      let window: [number, number] | null = null;
      let limit: number | null = null;
      let columns = "*";
      const builder = {
        select(cols: string) {
          columns = cols;
          return builder;
        },
        eq(key: string, value: unknown) {
          eqs.push([key, value]);
          filters.push((row) => row[key] === value);
          return builder;
        },
        gte(key: string, value: string) {
          filters.push((row) => new Date(String(row[key])).getTime() >= new Date(value).getTime());
          return builder;
        },
        lt(key: string, value: string) {
          filters.push((row) => new Date(String(row[key])).getTime() < new Date(value).getTime());
          return builder;
        },
        in(key: string, values: unknown[]) {
          filters.push((row) => values.includes(row[key]));
          return builder;
        },
        order(key: string, options?: { ascending?: boolean }) {
          orders.push([key, options?.ascending !== false]);
          return builder;
        },
        range(from: number, to: number) {
          window = [from, to];
          return builder;
        },
        limit(value: number) {
          limit = value;
          return builder;
        },
        then(resolve: (value: { data: Row[]; error: null }) => unknown) {
          queries.push({ table, eqs: [...eqs] });
          let result = rows.filter((row) => row.household_id === viewer && filters.every((filter) => filter(row)));
          result = [...result].sort((a, b) => {
            for (const [key, ascending] of orders) {
              const left = key.endsWith("_at") ? new Date(String(a[key])).getTime() : String(a[key]);
              const right = key.endsWith("_at") ? new Date(String(b[key])).getTime() : String(b[key]);
              if (left < right) return ascending ? -1 : 1;
              if (left > right) return ascending ? 1 : -1;
            }
            return 0;
          });
          if (window) result = result.slice(window[0], window[1] + 1);
          if (limit != null) result = result.slice(0, limit);
          result = result.slice(0, POSTGREST_MAX_ROWS);
          const projected = columns === "*" ? result : result.map((row) => Object.fromEntries(columns.split(",").map((col) => [col.trim(), row[col.trim()]])));
          return Promise.resolve({ data: projected, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
  return { supabase: client as unknown as SupabaseClient, queries };
}

describe("expense period — America/Sao_Paulo", () => {
  it("identifies the current month in Brasília, not UTC, at the month transition", () => {
    const lastEveningOfSeptember = new Date("2026-09-30T23:30:00-03:00");
    assert.equal(lastEveningOfSeptember.getUTCMonth(), 9, "UTC already says October");
    assert.equal(currentMonthKey(lastEveningOfSeptember), "2026-09");
    assert.equal(currentMonthKey(new Date("2026-10-01T00:10:00-03:00")), "2026-10");
    assert.equal(currentMonthKey(new Date("2026-12-31T22:00:00-03:00")), "2026-12");
    assert.equal(currentMonthKey(new Date("2027-01-01T00:00:00-03:00")), "2027-01");
  });

  it("builds half-open month ranges at local midnight", () => {
    assert.deepEqual(monthRangeUtc("2026-10"), { startIso: "2026-10-01T03:00:00.000Z", endIso: "2026-11-01T03:00:00.000Z" });
    assert.deepEqual(monthRangeUtc("2026-12"), { startIso: "2026-12-01T03:00:00.000Z", endIso: "2027-01-01T03:00:00.000Z" });
    assert.ok(isInMonth("2026-09-30T23:59:59-03:00", "2026-09"));
    assert.ok(isInMonth("2026-10-01T00:00:00-03:00", "2026-10"));
    assert.equal(monthKeyOf("2026-10-01T02:30:00Z"), "2026-09");
  });

  it("parses, shifts and resolves requested months", () => {
    const now = new Date("2026-10-13T06:00:00-03:00");
    assert.equal(parseMonthKey("2026-09"), "2026-09");
    for (const bad of ["2026-13", "2026-9", "1999-12", "abc", "", undefined, ["2026-09"]]) assert.equal(parseMonthKey(bad), null);
    assert.equal(shiftMonthKey("2026-01", -1), "2025-12");
    assert.equal(shiftMonthKey("2026-12", 1), "2027-01");
    assert.equal(resolveRequestedMonth("2026-09", now), "2026-09");
    assert.equal(resolveRequestedMonth("2026-11", now), "2026-10", "future months fall back to the current month");
    assert.equal(resolveRequestedMonth("lixo", now), "2026-10");
    assert.equal(resolveRequestedMonth(undefined, now), "2026-10");
    assert.equal(formatMonthLabel("2026-10"), "outubro de 2026");
  });

  it("parses page params and clamps windows", () => {
    assert.equal(parsePageParam("3"), 3);
    for (const bad of ["0", "-1", "1.5", "x", undefined, ""]) assert.equal(parsePageParam(bad), 1);
    assert.deepEqual(pageWindow(1, 45, 20), { page: 1, from: 0, to: 19 });
    assert.deepEqual(pageWindow(3, 45, 20), { page: 3, from: 40, to: 59 });
    assert.deepEqual(pageWindow(99, 45, 20), { page: 3, from: 40, to: 59 });
    assert.deepEqual(pageWindow(5, 0, 20), { page: 1, from: 0, to: 19 });
  });
});

describe("expense summary", () => {
  it("totals by category, shared and individual", () => {
    const summary = summarizeExpenses([
      { amount_cents: 15000, category: "veterinary", shared: false },
      { amount_cents: 8990, category: "food", shared: true },
      { amount_cents: 3954, category: "food", shared: false },
      { amount_cents: 0, category: "other", shared: true },
    ]);
    assert.equal(summary.count, 4);
    assert.equal(summary.total, 27944);
    assert.equal(summary.shared, 8990);
    assert.equal(summary.individual, 18954);
    assert.deepEqual(summary.byCategory, [
      { category: "veterinary", total: 15000 },
      { category: "food", total: 12944 },
    ]);
  });
});

describe("expense month loader", () => {
  const september = [
    expense("e-sep-1", "2026-09-09T12:00:00-03:00", 5340, { shared: true }),
    expense("e-sep-2", "2026-09-30T23:30:00-03:00", 5340, { category: "hygiene" }),
  ];
  const august = expense("e-aug-1", "2026-08-20T12:00:00-03:00", 3691, { pet_id: PET_A });
  const foreign = expense("e-b-1", "2026-09-15T12:00:00-03:00", 99999, { household_id: HOUSEHOLD_B });
  const foreignOctober = expense("e-b-2", "2026-10-05T12:00:00-03:00", 77777, { household_id: HOUSEHOLD_B });
  const seed = () => ({
    expenses: [...september, august, foreign, foreignOctober] as Row[],
    purchases: [
      { id: "p-sep-1", household_id: HOUSEHOLD_A, expense_id: "e-sep-1" },
      { id: "p-b-1", household_id: HOUSEHOLD_B, expense_id: "e-b-1" },
    ] as Row[],
    expense_pets: [{ household_id: HOUSEHOLD_A, expense_id: "e-sep-1", pet_id: PET_A }] as Row[],
  });

  it("current month without expenses: zero totals, clear empty state with the last expense", async () => {
    const { supabase } = rlsClient(HOUSEHOLD_A, seed());
    const view = await loadExpenseMonth(supabase, HOUSEHOLD_A, "2026-10", 1);
    assert.equal(view.summary.total, 0);
    assert.equal(view.summary.count, 0);
    assert.deepEqual(view.rows, []);
    assert.equal(view.lastExpenseAt, "2026-09-30T23:30:00-03:00", "other household's October expense is invisible");
  });

  it("previous month with expenses: rows, totals, Purchase link and pets", async () => {
    const { supabase } = rlsClient(HOUSEHOLD_A, seed());
    const view = await loadExpenseMonth(supabase, HOUSEHOLD_A, "2026-09", 1);
    assert.equal(view.summary.count, 2);
    assert.equal(view.summary.total, 10680);
    assert.equal(view.summary.shared, 5340);
    assert.equal(view.summary.individual, 5340);
    assert.deepEqual(view.rows.map((row) => row.id), ["e-sep-2", "e-sep-1"]);
    const linked = view.rows.find((row) => row.id === "e-sep-1");
    assert.equal(linked?.purchase_id, "p-sep-1");
    assert.deepEqual(linked?.pet_ids, [PET_A]);
    assert.equal(view.rows.find((row) => row.id === "e-sep-2")?.purchase_id, null);
    assert.equal(view.lastExpenseAt, null);
  });

  it("month boundary in Brasília: 30/09 23:30 belongs to September only", async () => {
    const { supabase } = rlsClient(HOUSEHOLD_A, seed());
    const september = await loadExpenseMonthSummary(supabase, HOUSEHOLD_A, "2026-09");
    const october = await loadExpenseMonthSummary(supabase, HOUSEHOLD_A, "2026-10");
    assert.equal(september.count, 2);
    assert.equal(october.count, 0);
  });

  it("household isolation: every query is scoped and foreign rows never count", async () => {
    const { supabase, queries } = rlsClient(HOUSEHOLD_A, seed());
    const view = await loadExpenseMonth(supabase, HOUSEHOLD_A, "2026-09", 1);
    assert.ok(view.rows.every((row) => row.household_id === HOUSEHOLD_A));
    assert.equal(view.summary.total, 10680);
    for (const query of queries) {
      assert.ok(query.eqs.some(([key, value]) => key === "household_id" && value === HOUSEHOLD_A), `${query.table} query scoped by household`);
    }
  });

  it("more than 120 (and more than one PostgREST page of) expenses: totals stay complete", async () => {
    const many: Row[] = [];
    let expectedTotal = 0;
    let expectedShared = 0;
    const categories: ExpenseCategory[] = ["food", "hygiene", "veterinary"];
    for (let index = 0; index < 2_345; index += 1) {
      const amount = 100 + index;
      const shared = index % 3 === 0;
      expectedTotal += amount;
      if (shared) expectedShared += amount;
      const day = String((index % 28) + 1).padStart(2, "0");
      many.push(expense(`m-${String(index).padStart(5, "0")}`, `2026-07-${day}T12:00:00-03:00`, amount, { shared, category: categories[index % 3] }) as Row);
    }
    const { supabase, queries } = rlsClient(HOUSEHOLD_A, { expenses: many, purchases: [], expense_pets: [] });
    const view = await loadExpenseMonth(supabase, HOUSEHOLD_A, "2026-07", 1);
    assert.equal(view.summary.count, 2_345);
    assert.equal(view.summary.total, expectedTotal);
    assert.equal(view.summary.shared, expectedShared);
    assert.equal(view.summary.individual, expectedTotal - expectedShared);
    assert.equal(view.summary.byCategory.reduce((sum, item) => sum + item.total, 0), expectedTotal);
    assert.equal(view.rows.length, 20);
    assert.equal(view.pageCount, Math.ceil(2_345 / 20));
    assert.ok(queries.filter((query) => query.table === "expenses").length >= Math.ceil(2_345 / EXPENSE_SUMMARY_BATCH));

    const last = await loadExpenseMonth(supabase, HOUSEHOLD_A, "2026-07", 999);
    assert.equal(last.page, last.pageCount, "out-of-range page clamps to the last page");
    assert.equal(last.rows.length, 2_345 % 20 || 20);
    const seen = new Set<string>();
    for (let page = 1; page <= view.pageCount; page += 1) {
      for (const row of (await loadExpenseMonth(supabase, HOUSEHOLD_A, "2026-07", page)).rows) seen.add(row.id);
    }
    assert.equal(seen.size, 2_345, "pagination reaches every expense exactly once");
  });
});

describe("expense month view — demo mode", () => {
  it("shows demo expenses in their month and an empty state elsewhere", () => {
    const august = buildExpenseMonthView(demoExpenses, "2026-08", 1);
    assert.equal(august.summary.count, demoExpenses.length);
    assert.equal(august.summary.total, demoExpenses.reduce((sum, item) => sum + item.amount_cents, 0));
    assert.equal(august.summary.shared, demoExpenses.filter((item) => item.shared).reduce((sum, item) => sum + item.amount_cents, 0));
    assert.equal(august.rows[0].id, "exp-1", "most recent first");

    const october = buildExpenseMonthView(demoExpenses, "2026-10", 1);
    assert.equal(october.summary.total, 0);
    assert.deepEqual(october.rows, []);
    assert.equal(october.lastExpenseAt, "2026-08-15T10:00:00-03:00");
  });
});

describe("Shopping / Expenses / Assistant regressions", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
  const expensesPage = read("src/app/(app)/expenses/page.tsx");
  const shoppingPage = read("src/app/(app)/shopping/page.tsx");
  const assistantPage = read("src/app/(app)/assistant/page.tsx");

  it("no month math in server UTC", () => {
    for (const source of [expensesPage, shoppingPage, assistantPage]) assert.ok(!/getMonth\(\)/.test(source));
    assert.match(shoppingPage, /isInMonth\(item\.purchased_at, thisMonth\)/);
    assert.match(assistantPage, /loadExpenseMonthSummary\(supabase, household\.id, currentMonthKey\(\)\)/);
  });

  it("Expenses reads by month and keeps Purchase links, permissions and demo mode", () => {
    assert.match(expensesPage, /loadExpenseMonth\(supabase, household\.id, month, page\)/);
    assert.match(expensesPage, /buildExpenseMonthView\(expenses, month, page\)/);
    assert.ok(!expensesPage.includes("listExpenses"));
    assert.match(expensesPage, /\/shopping\/purchases\/\$\{item\.purchase_id\}\/edit/);
    assert.match(expensesPage, /Apagar este gasto e a compra vinculada em Compras\?/);
    assert.match(expensesPage, /editable: canEdit\(role\)/);
    assert.match(expensesPage, /if \(!\(await isLiveData\(\)\)\)/);
  });
});
