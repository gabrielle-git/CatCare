import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, PawPrint, Pencil, Plus, ReceiptText, ShoppingBasket, Trash2, Users } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { PetNameChips } from "@/components/pet-name-chips";
import { buildExpenseMonthView, loadExpenseMonth, type ExpenseMonthView } from "@/lib/expense-history";
import { currentMonthKey, formatMonthLabel, monthKeyOf, parsePageParam, resolveRequestedMonth, shiftMonthKey, type MonthKey } from "@/lib/expense-period";
import { formatCurrency, formatFullDate, formatShortDate } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoExpenses, demoPets, demoPurchases } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { canEdit, getMyRole } from "@/lib/roles";
import { isLiveData } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory } from "@/types/database";
import { deleteExpense } from "./actions";

const categoryLabels: Record<ExpenseCategory, string> = {
  veterinary: "Veterinário", food: "Alimentação", medication: "Medicamentos", hygiene: "Higiene", accessory: "Acessórios", transport: "Transporte", other: "Outros",
};

type ExpensesSearchParams = { saved?: string; month?: string; page?: string };

function emptyView(month: MonthKey): ExpenseMonthView {
  return { month, summary: { count: 0, total: 0, shared: 0, individual: 0, byCategory: [] }, rows: [], page: 1, pageCount: 1, lastExpenseAt: null };
}

async function loadPage(month: MonthKey, page: number) {
  if (!(await isLiveData())) {
    const purchaseByExpense = new Map(demoPurchases.filter((item) => item.expense_id).map((item) => [item.expense_id as string, item.id]));
    const expenses = demoExpenses.map((item) => ({ ...item, purchase_id: purchaseByExpense.get(item.id) ?? null }));
    return { view: buildExpenseMonthView(expenses, month, page), pets: demoPets, configured: false, editable: false };
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { view: emptyView(month), pets: [], configured: true, editable: false };
  const household = await ensureHousehold(supabase, data.user.id);
  const role = await getMyRole(supabase);
  const [view, pets] = await Promise.all([loadExpenseMonth(supabase, household.id, month, page), listPets(supabase, household.id)]);
  return { view, pets, configured: true, editable: canEdit(role) };
}

function periodHref(month: MonthKey, current: MonthKey, page = 1) {
  const params = new URLSearchParams();
  if (month !== current) params.set("month", month);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/expenses?${query}` : "/expenses";
}

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<ExpensesSearchParams> }) {
  const flags = await searchParams;
  const current = currentMonthKey();
  const month = resolveRequestedMonth(flags.month, new Date());
  const { view, pets, editable } = await loadPage(month, parsePageParam(flags.page));
  const { summary, rows } = view;
  const isCurrent = month === current;
  const monthLabel = formatMonthLabel(month);
  const previousMonth = shiftMonthKey(month, -1);
  const nextMonth = shiftMonthKey(month, 1);
  const names = new Map(pets.map((pet) => [pet.id, pet.name]));
  const maxCategory = Math.max(1, ...summary.byCategory.map((item) => item.total));
  const lastExpenseMonth = view.lastExpenseAt ? monthKeyOf(view.lastExpenseAt) : null;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Vida financeira</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Gastos da família</h1><p className="mt-2 max-w-[620px] text-sm text-[var(--muted)]">Descubra para onde o dinheiro está indo sem perder o contexto de cada cuidado.</p></div>
        {editable && <Link href="/expenses/new" className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white"><Plus size={18} /> Adicionar gasto</Link>}
      </header>
      {flags.saved && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Gasto registrado. Ele aparece no mês da data informada.</div>}

      <nav aria-label="Período" className="cat-card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link href={periodHref(previousMonth, current)} aria-label={`Ver ${formatMonthLabel(previousMonth)}`} className="focus-ring grid size-9 place-items-center rounded-xl border border-[var(--border)]"><ChevronLeft size={16} /></Link>
          <p className="min-w-[150px] text-center text-sm font-bold first-letter:uppercase">{monthLabel}{isCurrent && <span className="ml-1.5 text-[10px] font-semibold normal-case text-[var(--muted)]">(mês atual)</span>}</p>
          {isCurrent
            ? <span aria-disabled="true" className="grid size-9 place-items-center rounded-xl border border-[var(--border)] opacity-40"><ChevronRight size={16} /></span>
            : <Link href={periodHref(nextMonth, current)} aria-label={`Ver ${formatMonthLabel(nextMonth)}`} className="focus-ring grid size-9 place-items-center rounded-xl border border-[var(--border)]"><ChevronRight size={16} /></Link>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isCurrent && <Link href="/expenses" className="focus-ring rounded-xl bg-[var(--lavender-soft)] px-3 py-2 text-xs font-bold text-[var(--lavender-strong)]">Mês atual</Link>}
          <form method="get" action="/expenses" className="flex items-center gap-2">
            <label htmlFor="expenses-month" className="text-xs font-semibold text-[var(--muted)]">Ir para</label>
            <input id="expenses-month" type="month" name="month" defaultValue={month} max={current} className="focus-ring rounded-xl border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs" />
            <button type="submit" className="focus-ring rounded-xl bg-[var(--graphite)] px-3 py-2 text-xs font-bold text-white">Ver</button>
          </form>
        </div>
      </nav>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: isCurrent ? "Total neste mês" : "Total no mês", value: summary.total, icon: ReceiptText, tone: "bg-[var(--lavender-soft)]" },
          { label: "Compartilhado", value: summary.shared, icon: Users, tone: "bg-[var(--mint-soft)]" },
          { label: "Individual", value: summary.individual, icon: PawPrint, tone: "bg-[var(--rose-soft)]" },
        ].map(({ label, value, icon: Icon, tone }) => <div key={label} className="cat-card p-5"><div className={`grid size-9 place-items-center rounded-[14px] ${tone}`}><Icon size={17} /></div><p className="mt-4 text-xs font-semibold text-[var(--muted)]">{label}</p><p className="mt-1 text-2xl font-bold tracking-[-0.04em]">{formatCurrency(value)}</p></div>)}
      </section>

      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
        <section className="cat-card min-w-0 p-5 md:p-6">
          <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Movimentações</p><h2 className="mt-1 text-xl font-bold first-letter:uppercase">{monthLabel}</h2></div><span className="shrink-0 text-xs text-[var(--muted)]">{summary.count} {summary.count === 1 ? "lançamento" : "lançamentos"}</span></div>
          <div className="mt-4 min-w-0 space-y-2.5">{rows.length === 0 ? (
            <div className="rounded-2xl bg-[var(--cream)] p-5 text-sm text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">Nenhum gasto em {monthLabel}.</p>
              {view.lastExpenseAt && lastExpenseMonth
                ? <p className="mt-1">O último gasto registrado foi em {formatFullDate(view.lastExpenseAt)}. <Link href={periodHref(lastExpenseMonth, current)} className="font-bold text-[var(--lavender-strong)] underline">Ver {formatMonthLabel(lastExpenseMonth)}</Link></p>
                : <p className="mt-1">Ainda não há gastos registrados. Use as setas ou “Ir para” para consultar outros meses.</p>}
            </div>
          ) : rows.map((item) => {
            const remove = deleteExpense.bind(null, item.id);
            return <div key={item.id} className="rounded-[18px] border border-[var(--border)] p-3.5"><div className="flex min-w-0 items-center gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-[15px] ${item.purchase_id ? "bg-[var(--mint-soft)]" : "bg-[var(--cream)]"}`}>{item.purchase_id ? <ShoppingBasket size={17} /> : <ReceiptText size={17} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{item.description}</p>{item.purchase_id && <span className="rounded-full bg-[var(--mint-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--success)]">Compra</span>}</div><p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--muted)]"><span>{formatShortDate(item.occurred_at)}</span><span>•</span><PetNameChips petIds={item.pet_ids ?? (item.pet_id ? [item.pet_id] : [])} names={names} /><span>•</span><span>{categoryLabels[item.category]}</span></p></div><strong className="shrink-0 text-sm">{formatCurrency(item.amount_cents)}</strong></div>{editable && <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">{item.purchase_id ? <Link href={`/shopping/purchases/${item.purchase_id}/edit`} className="focus-ring inline-flex items-center gap-1 rounded-xl bg-[var(--mint-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--success)]"><ShoppingBasket size={12} /> Editar compra</Link> : null}<Link href={`/expenses/${item.id}/edit`} className="focus-ring inline-flex items-center gap-1 rounded-xl bg-[var(--lavender-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--lavender-strong)]"><Pencil size={12} /> Editar</Link><form action={remove}><ConfirmButton message={item.purchase_id ? "Apagar este gasto e a compra vinculada em Compras?" : "Apagar este gasto permanentemente?"} className="focus-ring inline-flex items-center gap-1 rounded-xl border border-red-200 px-2.5 py-1 text-[10px] font-bold text-[var(--danger)]"><Trash2 size={12} /> Apagar</ConfirmButton></form></div>}</div>;
          })}</div>
          {view.pageCount > 1 && (
            <nav aria-label="Páginas" className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-xs">
              {view.page > 1 ? <Link href={periodHref(month, current, view.page - 1)} className="focus-ring inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-2 font-bold"><ChevronLeft size={14} /> Mais recentes</Link> : <span />}
              <span className="text-[var(--muted)]">Página {view.page} de {view.pageCount}</span>
              {view.page < view.pageCount ? <Link href={periodHref(month, current, view.page + 1)} className="focus-ring inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-2 font-bold">Anteriores <ChevronRight size={14} /></Link> : <span />}
            </nav>
          )}
        </section>

        <aside className="cat-card min-w-0 p-5 md:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Distribuição</p><h2 className="mt-1 text-xl font-bold">Por categoria</h2>
          <div className="mt-5 space-y-5">{summary.byCategory.length === 0 ? <p className="text-sm text-[var(--muted)]">As categorias aparecem quando houver gastos no mês.</p> : summary.byCategory.map((item) => <div key={item.category}><div className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="font-bold">{categoryLabels[item.category]}</span><span className="text-[var(--muted)]">{formatCurrency(item.total)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--lavender-soft)]"><div className="h-full rounded-full bg-[var(--graphite)]" style={{ width: `${Math.max(8, (item.total / maxCategory) * 100)}%` }} /></div></div>)}</div>
          <Link href="/shopping" className="focus-ring mt-7 flex items-center justify-between rounded-[18px] bg-[var(--mint-soft)] p-4 text-sm font-bold"><span>Compras e avaliações — cada compra vira gasto aqui</span><ArrowUpRight size={18} /></Link>
        </aside>
      </div>
    </div>
  );
}
