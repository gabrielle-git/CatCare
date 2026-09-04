import Link from "next/link";
import { ArrowRight, ChevronRight, HeartPulse, Plus, Sparkles } from "lucide-react";
import { HomeAgendaPanel } from "@/components/home-agenda-panel";
import { HomeCareAlerts } from "@/components/home-care-alerts";
import { HomeFamilyStats } from "@/components/home-family-stats";
import { PetAvatar } from "@/components/pet-avatar";
import { formatDateTime, formatHumanEquivalentAge, formatLongDate, formatPetAge, formatWeight, isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoPets, demoReminders, demoTimeline } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { listHouseholdTimeline, listPetDewormingDoses, listPetVaccineDoses, listUpcomingReminders } from "@/lib/records";
import { buildDewormingSchedule, isDewormingDue, isDewormingOverdue } from "@/lib/deworming-schedule";
import { canEdit, getMyRole } from "@/lib/roles";
import { isLiveData } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";
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
  const empty = { pets: [] as typeof demoPets, timeline: [] as typeof demoTimeline, reminders: [] as typeof demoReminders, configured: true, editable: false, error: null as string | null, vaccineAlerts: [] as VaccineAlert[], dewormingAlerts: [] as DewormingAlert[] };
  if (!(await isLiveData())) return { ...empty, pets: demoPets, timeline: demoTimeline, reminders: demoReminders, configured: false };
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
    const dewormingAlerts: DewormingAlert[] = [];
    for (const pet of pets) {
      const [doses, dewormingDoses] = await Promise.all([
        listPetVaccineDoses(supabase, pet.id),
        listPetDewormingDoses(supabase, pet.id),
      ]);
      const schedule = buildVaccineSchedule(pet.birth_date, doses);
      const overdue = countOverdue(schedule);
      const due = countDue(schedule);
      const actionable = firstActionableVaccine(schedule);
      const registerHref = actionable ? vaccineAlertHref(pet.id, actionable.name, actionable.doseLabel, "/") : null;
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
    return { pets, timeline, reminders, configured: true, editable: canEdit(role), error: null as string | null, vaccineAlerts, dewormingAlerts };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Não foi possível carregar os dados da família.";
    return { ...empty, error };
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string; joined?: string }> }) {
  const flags = await searchParams;
  const { pets, timeline, reminders, configured, editable, error, vaccineAlerts, dewormingAlerts } = await loadDashboard();
  const petNames = new Map(pets.map((pet) => [pet.id, pet.name]));
  const babies = pets.filter(isNeonatalPet);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1180px] px-4 pb-8 pt-6 sm:px-5 md:px-8 lg:px-10 lg:py-10">
      <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">{formatLongDate()}</p>
          <h1 className="mt-2 text-[1.65rem] font-bold leading-tight tracking-[-0.04em] sm:text-3xl md:text-4xl">{greeting()}, família.</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Um resumo tranquilo do que importa hoje.</p>
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

      <HomeCareAlerts vaccineAlerts={vaccineAlerts} dewormingAlerts={dewormingAlerts} />

      <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="min-w-0 overflow-hidden rounded-[26px] bg-[var(--lavender)] text-white shadow-xl shadow-[#8e7dbe]/15">
            <div className="flex min-w-0 flex-col gap-5 p-5 sm:p-6 md:p-7">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-white/75">
                  <Sparkles size={15} aria-hidden="true" /> Registro rápido
                </p>
                <h2 className="mt-3 text-balance text-xl font-bold tracking-[-0.03em] sm:text-2xl">
                  Quanto menos passos, mais completo fica o histórico.
                </h2>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-white/80">
                  Anote uma pesagem, vacina, mamada ou medicamento em menos de um minuto.
                </p>
              </div>
              {editable && (
                <Link
                  href="/records/new"
                  className="focus-ring inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-[20px] bg-white px-4 py-3 text-sm font-bold text-[var(--lavender-strong)] sm:w-fit"
                >
                  Abrir registro rápido <ArrowRight size={18} aria-hidden="true" />
                </Link>
              )}
            </div>
          </section>

          {babies.length > 0 && (
            <Link
              href="/neonatal"
              className="focus-ring flex min-w-0 items-center justify-between gap-3 rounded-[24px] border border-[#e3b6c4] bg-[var(--rose-soft)] p-4 sm:gap-4 sm:p-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-[18px] bg-[var(--rose)]">
                  <HeartPulse size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-balance font-bold">
                    {babies.length === 1 ? "1 filhote em acompanhamento" : `${babies.length} filhotes em acompanhamento`}
                  </h2>
                  <p className="mt-1 text-pretty text-xs text-[var(--muted)]">Mamada, peso e eliminações em um painel próprio.</p>
                </div>
              </div>
              <ChevronRight size={19} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
            </Link>
          )}

          <section className="cat-card min-w-0 p-5 md:p-6">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Família</p>
                <h2 className="mt-1 text-xl font-bold">Meus pets</h2>
              </div>
              <Link href="/pets" className="focus-ring shrink-0 rounded-xl px-2 py-1 text-xs font-bold text-[var(--lavender-strong)]">
                Ver todos
              </Link>
            </div>
            {pets.length === 0 ? (
              <div className="mt-4 rounded-[20px] border border-dashed border-[var(--border)] p-6 text-center">
                <p className="text-sm font-bold">Nenhum pet cadastrado.</p>
                {editable && (
                  <Link href="/pets/new" className="mt-3 inline-flex text-xs font-bold text-[var(--lavender-strong)]">
                    Adicionar o primeiro
                  </Link>
                )}
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pets.slice(0, 4).map((pet) => (
                  <Link
                    key={pet.id}
                    href={`/pets/${pet.id}`}
                    className="focus-ring flex min-w-0 items-center gap-3 rounded-[20px] border border-[var(--border)] bg-white p-3.5 transition hover:-translate-y-0.5"
                  >
                    <PetAvatar name={pet.name} photoUrl={pet.photo_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{pet.name}</p>
                      <p className="mt-0.5 text-pretty text-xs text-[var(--muted)]">
                        {formatWeight(pet.current_weight_grams)} • {formatPetAge(pet.birth_date, pet.birth_date_estimated) ?? "idade não informada"}
                      </p>
                      {formatHumanEquivalentAge(pet.birth_date) && (
                        <p className="mt-0.5 text-pretty text-[10px] text-[var(--muted)]">{formatHumanEquivalentAge(pet.birth_date)}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <div className="xl:hidden">
            <HomeAgendaPanel reminders={reminders} petNames={petNames} />
          </div>

          <section className="cat-card min-w-0 p-5 md:p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Histórico</p>
              <h2 className="mt-1 text-xl font-bold">Últimos cuidados</h2>
            </div>
            <div className="mt-4 space-y-2.5">
              {timeline.length === 0 ? (
                <p className="rounded-[18px] border border-dashed border-[var(--border)] p-5 text-center text-sm text-[var(--muted)]">
                  Os registros recentes aparecerão aqui.
                </p>
              ) : (
                timeline.map((item) => (
                  <Link
                    key={`${item.kind}-${item.id}`}
                    href={`/pets/${item.pet_id}`}
                    className="focus-ring flex min-w-0 items-center justify-between gap-3 rounded-[18px] border border-[var(--border)] bg-white px-4 py-3 sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-pretty text-sm font-bold">
                        {item.title} <span className="font-normal text-[var(--muted)]">• {petNames.get(item.pet_id) ?? "Pet"}</span>
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

        <aside className="hidden min-w-0 flex-col gap-5 xl:flex">
          <HomeAgendaPanel reminders={reminders} petNames={petNames} />
          <HomeFamilyStats petCount={pets.length} timelineCount={timeline.length} reminderCount={reminders.length} />
        </aside>
      </div>

      <div className="mt-5 xl:hidden">
        <HomeFamilyStats petCount={pets.length} timelineCount={timeline.length} reminderCount={reminders.length} />
      </div>
    </div>
  );
}
