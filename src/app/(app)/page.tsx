import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, Cat, ChevronRight, HeartPulse, Plus, Sparkles, Syringe } from "lucide-react";
import { PetAvatar } from "@/components/pet-avatar";
import { formatDateTime, formatHumanEquivalentAge, formatLongDate, formatPetAge, formatWeight, isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoPets, demoReminders, demoTimeline } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { listHouseholdTimeline, listPetVaccineDoses, listUpcomingReminders } from "@/lib/records";
import { canEdit, getMyRole } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { buildVaccineSchedule, countOverdue, countDue } from "@/lib/vaccine-schedule";

export const dynamic = "force-dynamic";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

type VaccineAlert = { petId: string; petName: string; overdue: number; due: number };

async function loadDashboard() {
  const empty = { pets: [] as typeof demoPets, timeline: [] as typeof demoTimeline, reminders: [] as typeof demoReminders, configured: true, editable: false, error: null as string | null, vaccineAlerts: [] as VaccineAlert[] };
  if (!hasSupabaseEnv()) return { ...empty, pets: demoPets, timeline: demoTimeline, reminders: demoReminders, configured: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return empty;
  try {
    const household = await ensureHousehold(supabase, data.user.id);
    const role = await getMyRole(supabase);
    const [pets, timeline, reminders] = await Promise.all([
      listPets(supabase, household.id),
      listHouseholdTimeline(supabase, household.id, 6),
      listUpcomingReminders(supabase, household.id, 4),
    ]);
    const vaccineAlerts: VaccineAlert[] = [];
    for (const pet of pets) {
      const doses = await listPetVaccineDoses(supabase, pet.id);
      const schedule = buildVaccineSchedule(pet.birth_date, doses);
      const overdue = countOverdue(schedule);
      const due = countDue(schedule);
      if (overdue > 0 || due > 0) vaccineAlerts.push({ petId: pet.id, petName: pet.name, overdue, due });
    }
    return { pets, timeline, reminders, configured: true, editable: canEdit(role), error: null as string | null, vaccineAlerts };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Não foi possível carregar os dados da família.";
    return { ...empty, error };
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string; joined?: string }> }) {
  const flags = await searchParams;
  const { pets, timeline, reminders, configured, editable, error, vaccineAlerts } = await loadDashboard();
  const petNames = new Map(pets.map((pet) => [pet.id, pet.name]));
  const babies = pets.filter(isNeonatalPet);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-8 pt-7 md:px-8 lg:px-10 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">{formatLongDate()}</p>
            {!configured && <span className="rounded-full bg-[var(--lavender-soft)] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[var(--lavender-strong)]">Demonstração</span>}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">{greeting()}, família.</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Um resumo tranquilo do que importa hoje.</p>
        </div>
        {editable && <Link href="/records/new" className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15"><Plus size={18} /> Registrar cuidado</Link>}
      </header>

      {error && <div className="cat-card mt-5 border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {flags.error && <div className="cat-card mt-5 border-red-200 bg-red-50 p-4 text-sm text-red-800">{flags.error}</div>}
      {configured && !editable && <div className="cat-card mt-5 bg-[var(--cream)] p-4 text-sm"><strong>Modo visitante.</strong> Você pode ver tudo, mas não registrar nem editar nesta família.</div>}
      {flags.joined && <div className="cat-card mt-5 bg-[var(--mint-soft)] p-4 text-sm font-semibold text-[var(--success)]">Você entrou na família! Troque entre famílias em Configurações → Suas famílias.</div>}

      {vaccineAlerts.length > 0 && (
        <section className="mt-5 space-y-2">
          {vaccineAlerts.map((alert) => (
            <Link key={alert.petId} href={`/pets/${alert.petId}`} className="focus-ring flex items-center gap-3 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-[var(--danger)]">
              {alert.overdue > 0 ? <AlertTriangle size={17} /> : <Syringe size={17} />}
              <span>
                {alert.overdue > 0
                  ? `${alert.petName} tem ${alert.overdue} vacina${alert.overdue > 1 ? "s" : ""} atrasada${alert.overdue > 1 ? "s" : ""}`
                  : `${alert.petName} tem ${alert.due} vacina${alert.due > 1 ? "s" : ""} para aplicar agora`}
              </span>
            </Link>
          ))}
        </section>
      )}

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-[26px] bg-[var(--lavender)] text-white shadow-xl shadow-[#8e7dbe]/15">
            <div className="grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:items-center md:p-7">
              <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-white/75"><Sparkles size={15} /> Registro rápido</p><h2 className="mt-3 max-w-lg text-2xl font-bold tracking-[-0.03em]">Quanto menos passos, mais completo fica o histórico.</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80">Anote uma pesagem, vacina, mamada ou medicamento em menos de um minuto.</p></div>
              {editable && <Link href="/records/new" className="focus-ring inline-flex items-center justify-center gap-2 rounded-[20px] bg-white px-4 py-3 text-sm font-bold text-[var(--lavender-strong)]">Abrir registro rápido <ArrowRight size={18} /></Link>}
            </div>
          </section>

          {babies.length > 0 && (
            <Link href="/neonatal" className="focus-ring flex items-center justify-between gap-4 rounded-[24px] border border-[#e3b6c4] bg-[var(--rose-soft)] p-5">
              <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[18px] bg-[var(--rose)]"><HeartPulse size={20} /></span><div><h2 className="font-bold">{babies.length === 1 ? "1 bebê em acompanhamento" : `${babies.length} bebês em acompanhamento`}</h2><p className="mt-1 text-xs text-[var(--muted)]">Mamada, peso e eliminações em um painel próprio.</p></div></div><ChevronRight size={19} className="shrink-0" />
            </Link>
          )}

          <section className="cat-card p-5 md:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Família</p><h2 className="mt-1 text-xl font-bold">Meus gatos</h2></div><Link href="/pets" className="focus-ring rounded-xl px-2 py-1 text-xs font-bold text-[var(--lavender-strong)]">Ver todos</Link></div>
            {pets.length === 0 ? (
              <div className="mt-4 rounded-[20px] border border-dashed border-[var(--border)] p-6 text-center"><p className="text-sm font-bold">Nenhum gatinho cadastrado.</p>{editable && <Link href="/pets/new" className="mt-3 inline-flex text-xs font-bold text-[var(--lavender-strong)]">Adicionar o primeiro</Link>}</div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {pets.slice(0, 4).map((pet) => <Link key={pet.id} href={`/pets/${pet.id}`} className="focus-ring flex items-center gap-3 rounded-[20px] border border-[var(--border)] bg-white p-3.5 transition hover:-translate-y-0.5"><PetAvatar name={pet.name} photoUrl={pet.photo_url} size="sm" /><div className="min-w-0"><p className="truncate font-bold">{pet.name}</p><p className="mt-0.5 truncate text-xs text-[var(--muted)]">{formatWeight(pet.current_weight_grams)} • {formatPetAge(pet.birth_date, pet.birth_date_estimated) ?? "idade não informada"}</p>{formatHumanEquivalentAge(pet.birth_date) && <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{formatHumanEquivalentAge(pet.birth_date)}</p>}</div></Link>)}
              </div>
            )}
          </section>

          <section className="cat-card p-5 md:p-6">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Histórico</p><h2 className="mt-1 text-xl font-bold">Últimos cuidados</h2></div>
            <div className="mt-4 space-y-2.5">
              {timeline.length === 0 ? <p className="rounded-[18px] border border-dashed border-[var(--border)] p-5 text-center text-sm text-[var(--muted)]">Os registros recentes aparecerão aqui.</p> : timeline.map((item) => <Link key={`${item.kind}-${item.id}`} href={`/pets/${item.pet_id}`} className="focus-ring flex items-center justify-between gap-4 rounded-[18px] border border-[var(--border)] bg-white px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.title} <span className="font-normal text-[var(--muted)]">• {petNames.get(item.pet_id) ?? "Gatinho"}</span></p><p className="mt-0.5 truncate text-xs text-[var(--muted)]">{item.detail || "Sem observações"}</p></div><time className="shrink-0 text-[10px] text-[var(--muted)]">{formatDateTime(item.occurred_at)}</time></Link>)}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="cat-card p-5 md:p-6">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--success)]"><CalendarClock size={18} /></span><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Agenda</p><h2 className="font-bold">Próximos cuidados</h2></div></div>
            <div className="mt-5 space-y-3">
              {reminders.length === 0 ? <p className="rounded-[18px] bg-[var(--cream)] p-4 text-sm text-[var(--muted)]">Nada pendente por enquanto.</p> : reminders.map((reminder) => <div key={reminder.id} className="rounded-[18px] border border-[var(--border)] p-3.5"><p className="text-sm font-bold">{reminder.title}</p><p className="mt-1 text-xs text-[var(--muted)]">{petNames.get(reminder.pet_id ?? "") ?? "Família"} • {formatDateTime(reminder.due_at)}</p></div>)}
            </div>
            <Link href="/agenda" className="focus-ring mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-xs font-bold text-[var(--success)]">Abrir agenda <ChevronRight size={15} /></Link>
          </section>

          <section className="rounded-[24px] bg-[var(--cream)] p-5"><p className="flex items-center gap-2 text-sm font-bold"><Cat size={17} /> Visão da família</p><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><strong className="block text-2xl">{pets.length}</strong><span className="text-[10px] text-[var(--muted)]">gatos</span></div><div><strong className="block text-2xl">{timeline.length}</strong><span className="text-[10px] text-[var(--muted)]">recentes</span></div><div><strong className="block text-2xl">{reminders.length}</strong><span className="text-[10px] text-[var(--muted)]">pendentes</span></div></div></section>
        </aside>
      </div>
    </div>
  );
}
