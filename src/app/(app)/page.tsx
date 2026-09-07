import Link from "next/link";
import { ChevronRight, HeartPulse, Plus } from "lucide-react";
import { HomeAssistantCard } from "@/components/home-assistant-card";
import { HomeCareAlerts } from "@/components/home-care-alerts";
import { getAuthenticatedContext } from "@/lib/auth-context";
import { formatDateTime, formatLongDate, isNeonatalPet } from "@/lib/format";
import { HOME_ACTIVITY_PREVIEW_LIMIT } from "@/lib/family-history";
import { demoPets, demoTimeline } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { listHouseholdPreventiveDoses, listHouseholdTimeline } from "@/lib/records";
import { buildDewormingSchedule, isDewormingDue, isDewormingOverdue } from "@/lib/deworming-schedule";
import { isLiveData } from "@/lib/demo-mode";
import { getPerfTraceId, timed } from "@/lib/perf";
import { dewormingAlertHref, vaccineAlertHref } from "@/lib/record-links";
import { buildVaccineSchedule, countOverdue, countDue, firstActionableVaccine } from "@/lib/vaccine-schedule";

export const dynamic = "force-dynamic";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

type VaccineAlert = { petId: string; petName: string; overdue: number; due: number; registerHref: string | null };
type DewormingAlert = { petId: string; petName: string; overdue: boolean; due: boolean; registerHref: string };

async function loadDashboard() {
  const pageStart = performance.now();
  const trace = getPerfTraceId();
  const empty = {
    pets: [] as typeof demoPets,
    timeline: [] as typeof demoTimeline,
    configured: true,
    editable: false,
    error: null as string | null,
    vaccineAlerts: [] as VaccineAlert[],
    dewormingAlerts: [] as DewormingAlert[],
  };
  if (!(await timed("/.isLiveData", () => isLiveData()))) {
    return { ...empty, pets: demoPets, timeline: demoTimeline, configured: false };
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return empty;
  try {
    const { supabase, household, editable } = ctx;
    const [pets, timeline, preventive] = await Promise.all([
      timed("/.listPets", () => listPets(supabase, household.id)),
      timed("/.timeline", () => listHouseholdTimeline(supabase, household.id, HOME_ACTIVITY_PREVIEW_LIMIT)),
      timed("/.preventiveDoses", () => listHouseholdPreventiveDoses(supabase, household.id)),
    ]);
    const vaccineAlerts: VaccineAlert[] = [];
    const dewormingAlerts: DewormingAlert[] = [];
    for (const pet of pets) {
      const doses = preventive.vaccinesByPet.get(pet.id) ?? [];
      const dewormingDoses = preventive.dewormingByPet.get(pet.id) ?? [];
      const schedule = buildVaccineSchedule(pet.birth_date, doses, { species: pet.species });
      const overdue = countOverdue(schedule);
      const due = countDue(schedule);
      const actionable = firstActionableVaccine(schedule);
      const registerHref = actionable ? vaccineAlertHref(pet.id, actionable.name, actionable.doseLabel, "/", actionable.key) : null;
      if (overdue > 0 || due > 0) vaccineAlerts.push({ petId: pet.id, petName: pet.name, overdue, due, registerHref });

      const dewormingSchedule = buildDewormingSchedule(pet.birth_date, dewormingDoses);
      if (isDewormingOverdue(dewormingSchedule) || isDewormingDue(dewormingSchedule)) {
        dewormingAlerts.push({
          petId: pet.id,
          petName: pet.name,
          overdue: isDewormingOverdue(dewormingSchedule),
          due: isDewormingDue(dewormingSchedule),
          registerHref: dewormingAlertHref(pet.id, "/"),
        });
      }
    }
    console.log(`[CATCARE_PERF][trace ${trace}][/] total=${Math.round(performance.now() - pageStart)}ms pets=${pets.length}`);
    return { pets, timeline, configured: true, editable, error: null as string | null, vaccineAlerts, dewormingAlerts };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Não foi possível carregar os dados da família.";
    return { ...empty, error };
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string; joined?: string }> }) {
  const flags = await searchParams;
  const { pets, timeline, configured, editable, error, vaccineAlerts, dewormingAlerts } = await loadDashboard();
  const petNames = new Map(pets.map((pet) => [pet.id, pet.name]));
  const babies = pets.filter(isNeonatalPet);
  const preview = timeline.slice(0, HOME_ACTIVITY_PREVIEW_LIMIT);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[860px] px-4 pb-8 pt-6 sm:px-5 md:px-8 lg:px-10 lg:py-10">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">{formatLongDate()}</p>
          <h1 className="mt-2 text-[1.65rem] font-bold leading-tight tracking-[-0.04em] sm:text-3xl md:text-4xl">{greeting()}, família.</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">O que precisa de você agora — e o que aconteceu por aqui.</p>
        </div>
        {editable && (
          <Link
            href="/records/new?return_to=%2F"
            className="focus-ring inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15 sm:w-auto"
          >
            <Plus size={18} aria-hidden="true" /> Registrar cuidado
          </Link>
        )}
      </header>

      {error && <div className="cat-card mt-5 border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {flags.error && <div className="cat-card mt-5 border-red-200 bg-red-50 p-4 text-sm text-red-800">{flags.error}</div>}
      {configured && !editable && (
        <div className="cat-card mt-5 bg-[var(--cream)] p-4 text-sm">
          <strong>Modo visitante.</strong> Você pode ver tudo, mas não registrar nem editar nesta família.
        </div>
      )}
      {flags.joined && (
        <div className="cat-card mt-5 bg-[var(--mint-soft)] p-4 text-sm font-semibold text-[var(--success)]">
          Você entrou na família! Troque entre famílias em Configurações → Suas famílias.
        </div>
      )}

      <HomeAssistantCard />

      <HomeCareAlerts vaccineAlerts={vaccineAlerts} dewormingAlerts={dewormingAlerts} />

      {babies.length > 0 && (
        <Link
          href="/neonatal"
          className="focus-ring mt-5 flex min-w-0 items-center justify-between gap-3 rounded-[20px] border border-[#e3b6c4] bg-[var(--rose-soft)] px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[14px] bg-[var(--rose)]">
              <HeartPulse size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">Filhotes em acompanhamento</p>
              <p className="text-xs text-[var(--muted)]">
                {babies.length === 1 ? "1 filhote" : `${babies.length} filhotes`} · Abrir neonatal
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
        </Link>
      )}

      <section className="cat-card mt-5 min-w-0 p-5 md:p-6">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Atividade</p>
            <h2 className="mt-1 text-xl font-bold">O que aconteceu por aqui</h2>
          </div>
          <Link href="/historico" className="focus-ring shrink-0 rounded-xl px-2 py-1 text-xs font-bold text-[var(--lavender-strong)]">
            Ver histórico completo
          </Link>
        </div>
        <div className="mt-4 space-y-2.5">
          {preview.length === 0 ? (
            <p className="rounded-[18px] border border-dashed border-[var(--border)] p-5 text-center text-sm text-[var(--muted)]">
              Quando você registrar um cuidado, ele aparece aqui.
            </p>
          ) : (
            preview.map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={`/pets/${item.pet_id}`}
                className="focus-ring flex min-w-0 items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-white px-4 py-3 sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-pretty text-sm font-bold">
                    {item.title}{" "}
                    <span className="font-normal text-[var(--muted)]">• {petNames.get(item.pet_id) ?? "Pet"}</span>
                  </p>
                  <p className="mt-0.5 text-pretty text-xs text-[var(--muted)]">{item.detail || "Sem observações"}</p>
                </div>
                <time className="shrink-0 text-[10px] text-[var(--muted)]">{formatDateTime(item.occurred_at)}</time>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
