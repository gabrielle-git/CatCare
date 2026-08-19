import Link from "next/link";
import { CalendarDays, Check, Clock3, Pencil, Plus, Repeat2, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { formatDateTime, formatTime } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoPets, demoReminders } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { listUpcomingReminders } from "@/lib/records";
import { canEdit, getMyRole } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Reminder } from "@/types/database";
import { completeReminder, deleteReminder } from "./actions";

const categoryLabels: Record<string, string> = { vaccine: "Vacina", medication: "Medicamento", consultation: "Consulta", weight: "Pesagem", feeding: "Alimentação", hygiene: "Higiene", purchase: "Compra", other: "Outro" };

async function loadAgenda() {
  const now = Date.now();
  if (!hasSupabaseEnv()) return { pets: demoPets, reminders: demoReminders, configured: false, editable: false, now };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], reminders: [], configured: true, editable: false, now };
  const household = await ensureHousehold(supabase, data.user.id);
  const role = await getMyRole(supabase);
  const [pets, reminders] = await Promise.all([listPets(supabase, household.id), listUpcomingReminders(supabase, household.id, 60)]);
  return { pets, reminders, configured: true, editable: canEdit(role), now };
}

function ReminderRows({ items, names, editable, late = false }: { items: Reminder[]; names: Map<string, string>; editable: boolean; late?: boolean }) {
  if (items.length === 0) return <p className="rounded-[20px] border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">Nada por aqui.</p>;
  return <div className="space-y-2.5">{items.map((item) => {
    const complete = completeReminder.bind(null, item.id);
    const remove = deleteReminder.bind(null, item.id);
    return <article key={item.id} className={`flex items-center gap-3 rounded-[20px] border p-3.5 ${late ? "border-red-200 bg-red-50" : "border-[var(--border)] bg-white"}`}>
      <form action={complete}><button disabled={!editable} aria-label={`Marcar ${item.title} como concluído`} title={editable ? "Marcar como feito" : "Somente leitura"} className="focus-ring grid size-8 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--muted)] transition hover:border-[var(--mint)] hover:bg-[var(--mint-soft)] hover:text-[var(--success)]"><Check size={16} /></button></form>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{item.title}</p>{item.recurrence_rule && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--lavender-soft)] px-2 py-0.5 text-[9px] font-bold"><Repeat2 size={10} /> Repete</span>}</div><p className="mt-1 truncate text-[11px] text-[var(--muted)]">{categoryLabels[item.category] || "Cuidado"} • {names.get(item.pet_id ?? "") ?? "Família"}{item.notes ? ` • ${item.notes}` : ""}</p>{editable && <div className="mt-2 flex flex-wrap gap-2"><Link href={`/agenda/${item.id}/edit`} className="focus-ring inline-flex items-center gap-1 rounded-xl bg-[var(--lavender-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--lavender-strong)]"><Pencil size={12} /> Editar</Link><form action={remove}><ConfirmButton message="Apagar este lembrete permanentemente?" className="focus-ring inline-flex items-center gap-1 rounded-xl border border-red-200 px-2.5 py-1 text-[10px] font-bold text-[var(--danger)]"><Trash2 size={12} /> Apagar</ConfirmButton></form></div>}</div>
      <time className={`shrink-0 text-right text-[11px] font-bold ${late ? "text-[var(--danger)]" : "text-[var(--muted)]"}`} dateTime={item.due_at}>{formatTime(item.due_at)}</time>
    </article>;
  })}</div>;
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [{ pets, reminders, configured, editable, now }, flags] = await Promise.all([loadAgenda(), searchParams]);
  const names = new Map(pets.map((pet) => [pet.id, pet.name]));
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
  const late = reminders.filter((item) => new Date(item.due_at).getTime() < now);
  const todayItems = reminders.filter((item) => { const due = new Date(item.due_at).getTime(); return due >= now && due < tomorrow.getTime(); });
  const tomorrowItems = reminders.filter((item) => { const due = new Date(item.due_at).getTime(); return due >= tomorrow.getTime() && due < dayAfter.getTime(); });
  const later = reminders.filter((item) => new Date(item.due_at).getTime() >= dayAfter.getTime());

  return <div className="mx-auto w-full max-w-[980px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Rotina organizada</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Agenda</h1><p className="mt-2 max-w-[620px] text-sm text-[var(--muted)]">Hoje, amanhã e tudo que não pode ficar só na memória.</p></div>{editable && <Link href="/agenda/new" className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white"><Plus size={18} /> Novo lembrete</Link>}</header>
    {!configured && <div className="mt-6 rounded-[20px] bg-[var(--lavender-soft)] px-4 py-3 text-sm"><strong>Modo de demonstração.</strong> Os lembretes são exemplos; os botões de concluir ativam após conectar a conta.</div>}
    {flags.saved && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Lembrete salvo. A família já pode se organizar.</div>}
    <section className="mt-7 cat-card overflow-hidden"><div className="flex items-center justify-between bg-[linear-gradient(135deg,var(--lavender-soft),var(--rose-soft))] p-5 md:p-6"><div><p className="text-xs font-semibold text-[var(--muted)]">Próxima ação</p><p className="mt-1 text-lg font-bold">{[...late, ...todayItems, ...tomorrowItems, ...later][0]?.title || "Tudo em dia"}</p>{[...late, ...todayItems, ...tomorrowItems, ...later][0] && <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime([...late, ...todayItems, ...tomorrowItems, ...later][0].due_at)}</p>}</div><span className="grid size-12 place-items-center rounded-[19px] bg-white/75"><CalendarDays size={22} /></span></div></section>
    <div className="mt-7 space-y-7">
      {late.length > 0 && <section><div className="mb-3 flex items-center gap-2"><span className="size-2.5 rounded-full bg-[var(--danger)]" /><h2 className="text-lg font-bold">Atrasados</h2><span className="text-sm text-[var(--muted)]">{late.length}</span></div><ReminderRows items={late} names={names} editable={editable} late /></section>}
      <section><div className="mb-3 flex items-center gap-2"><Clock3 size={17} /><h2 className="text-lg font-bold">Hoje</h2><span className="text-sm text-[var(--muted)]">{todayItems.length}</span></div><ReminderRows items={todayItems} names={names} editable={editable} /></section>
      <section><div className="mb-3 flex items-center gap-2"><CalendarDays size={17} /><h2 className="text-lg font-bold">Amanhã</h2><span className="text-sm text-[var(--muted)]">{tomorrowItems.length}</span></div><ReminderRows items={tomorrowItems} names={names} editable={editable} /></section>
      <section><div className="mb-3 flex items-center gap-2"><CalendarDays size={17} /><h2 className="text-lg font-bold">Próximos dias</h2><span className="text-sm text-[var(--muted)]">{later.length}</span></div><ReminderRows items={later} names={names} editable={editable} /></section>
    </div>
  </div>;
}
