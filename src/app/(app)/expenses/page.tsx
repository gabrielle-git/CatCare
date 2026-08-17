import Link from "next/link";
import { ArrowUpRight, PawPrint, Pencil, Plus, ReceiptText, Trash2, Users } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { listExpenses } from "@/lib/commerce";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoExpenses, demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory } from "@/types/database";
import { deleteExpense } from "./actions";

const categoryLabels: Record<ExpenseCategory, string> = {
  veterinary: "Veterinário", food: "Alimentação", medication: "Medicamentos", hygiene: "Higiene", accessory: "Acessórios", transport: "Transporte", other: "Outros",
};

async function loadPage() {
  if (!hasSupabaseEnv()) return { expenses: demoExpenses, pets: demoPets, configured: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { expenses: [], pets: [], configured: true };
  const household = await ensureHousehold(supabase, data.user.id);
  const [expenses, pets] = await Promise.all([listExpenses(supabase, household.id), listPets(supabase, household.id)]);
  return { expenses, pets, configured: true };
}

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [{ expenses, pets, configured }, flags] = await Promise.all([loadPage(), searchParams]);
  const current = new Date();
  const monthExpenses = expenses.filter((item) => {
    const date = new Date(item.occurred_at);
    return date.getMonth() === current.getMonth() && date.getFullYear() === current.getFullYear();
  });
  const total = monthExpenses.reduce((sum, item) => sum + item.amount_cents, 0);
  const shared = monthExpenses.filter((item) => item.shared).reduce((sum, item) => sum + item.amount_cents, 0);
  const individual = total - shared;
  const names = new Map(pets.map((pet) => [pet.id, pet.name]));
  const totalsByCategory = Object.entries(categoryLabels).map(([category, label]) => ({
    category, label, total: monthExpenses.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount_cents, 0),
  })).filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
  const maxCategory = Math.max(1, ...totalsByCategory.map((item) => item.total));

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Vida financeira</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Gastos da família</h1><p className="mt-2 max-w-[620px] text-sm text-[var(--muted)]">Descubra para onde o dinheiro está indo sem perder o contexto de cada cuidado.</p></div>
        <Link href="/expenses/new" className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white"><Plus size={18} /> Adicionar gasto</Link>
      </header>
      {!configured && <div className="mt-6 rounded-[20px] bg-[var(--lavender-soft)] px-4 py-3 text-sm"><strong>Modo de demonstração.</strong> Os valores mostram como sua visão financeira ficará após conectar a conta.</div>}
      {flags.saved && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Gasto registrado e incluído no resumo.</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total neste mês", value: total, icon: ReceiptText, tone: "bg-[var(--lavender-soft)]" },
          { label: "Compartilhado", value: shared, icon: Users, tone: "bg-[var(--mint-soft)]" },
          { label: "Individual", value: individual, icon: PawPrint, tone: "bg-[var(--rose-soft)]" },
        ].map(({ label, value, icon: Icon, tone }) => <div key={label} className="cat-card p-5"><div className={`grid size-9 place-items-center rounded-[14px] ${tone}`}><Icon size={17} /></div><p className="mt-4 text-xs font-semibold text-[var(--muted)]">{label}</p><p className="mt-1 text-2xl font-bold tracking-[-0.04em]">{formatCurrency(value)}</p></div>)}
      </section>

      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
        <section className="cat-card min-w-0 p-5 md:p-6">
          <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Movimentações</p><h2 className="mt-1 text-xl font-bold">Histórico recente</h2></div><span className="shrink-0 text-xs text-[var(--muted)]">{monthExpenses.length} no mês</span></div>
          <div className="mt-4 min-w-0 space-y-2.5">{monthExpenses.length === 0 ? <p className="rounded-2xl bg-[var(--cream)] p-5 text-sm text-[var(--muted)]">Nenhum gasto neste mês.</p> : monthExpenses.slice(0, 12).map((item) => {
            const remove = deleteExpense.bind(null, item.id);
            return <div key={item.id} className="rounded-[18px] border border-[var(--border)] p-3.5"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[15px] bg-[var(--cream)]"><ReceiptText size={17} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.description}</p><p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{formatShortDate(item.occurred_at)} • {item.shared ? "Família" : names.get(item.pet_id ?? "") ?? "Individual"} • {categoryLabels[item.category]}</p></div><strong className="shrink-0 text-sm">{formatCurrency(item.amount_cents)}</strong></div>{configured && <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3"><Link href={`/expenses/${item.id}/edit`} className="focus-ring inline-flex items-center gap-1 rounded-xl bg-[var(--lavender-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--lavender-strong)]"><Pencil size={12} /> Editar</Link><form action={remove}><ConfirmButton message="Apagar este gasto permanentemente?" className="focus-ring inline-flex items-center gap-1 rounded-xl border border-red-200 px-2.5 py-1 text-[10px] font-bold text-[var(--danger)]"><Trash2 size={12} /> Apagar</ConfirmButton></form></div>}</div>;
          })}</div>
        </section>

        <aside className="cat-card min-w-0 p-5 md:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Distribuição</p><h2 className="mt-1 text-xl font-bold">Por categoria</h2>
          <div className="mt-5 space-y-5">{totalsByCategory.length === 0 ? <p className="text-sm text-[var(--muted)]">As categorias aparecem quando houver gastos.</p> : totalsByCategory.map((item) => <div key={item.category}><div className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="font-bold">{item.label}</span><span className="text-[var(--muted)]">{formatCurrency(item.total)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--lavender-soft)]"><div className="h-full rounded-full bg-[var(--graphite)]" style={{ width: `${Math.max(8, (item.total / maxCategory) * 100)}%` }} /></div></div>)}</div>
          <Link href="/shopping" className="focus-ring mt-7 flex items-center justify-between rounded-[18px] bg-[var(--mint-soft)] p-4 text-sm font-bold"><span>Comparar produtos e preços</span><ArrowUpRight size={18} /></Link>
        </aside>
      </div>
    </div>
  );
}
