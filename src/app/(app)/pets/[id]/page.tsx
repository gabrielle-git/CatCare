import Link from "next/link";
import { notFound } from "next/navigation";
import { Bug, HeartPulse, Pill, Plus, Scale, Syringe } from "lucide-react";
import { PetChrome } from "@/components/pet-chrome";
import { TimelineList } from "@/components/timeline-list";
import { formatShortDate, formatWeight, isNeonatalPet } from "@/lib/format";
import { healthPlanContextLabel, listHealthPlansForPet } from "@/lib/health-plan";
import { isRecentWeightDate } from "@/lib/pet-display";
import { demoPets, demoTimeline, demoWeights } from "@/lib/mock-data";
import { getPet } from "@/lib/pets";
import { listPetTimeline, listPetDewormingDoses, listPetVaccineDoses, listPetWeights } from "@/lib/records";
import { preselectRecordHref, typedRecordHref } from "@/lib/record-links";
import { buildDewormingSchedule, type AppliedDeworming } from "@/lib/deworming-schedule";
import { buildVaccineSchedule, firstActionableVaccine, type AppliedDose } from "@/lib/vaccine-schedule";
import { getAuthenticatedContext } from "@/lib/auth-context";
import { isLiveData } from "@/lib/demo-mode";
import { getPerfTraceId, timed } from "@/lib/perf";
import type { HealthPlanWithCopays } from "@/types/database";

async function loadPetPage(id: string) {
  const pageStart = performance.now();
  const trace = getPerfTraceId();
  if (!(await timed("/pets/:id.isLiveData", () => isLiveData()))) {
    const pet = demoPets.find((item) => item.id === id);
    return {
      pet: pet ?? null,
      timeline: demoTimeline.filter((item) => item.pet_id === id),
      weights: demoWeights[id] ?? [],
      vaccineDoses: [] as AppliedDose[],
      dewormingDoses: [] as AppliedDeworming[],
      plans: [] as HealthPlanWithCopays[],
      configured: false,
      editable: false,
    };
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    return {
      pet: null,
      timeline: [],
      weights: [],
      vaccineDoses: [] as AppliedDose[],
      dewormingDoses: [] as AppliedDeworming[],
      plans: [] as HealthPlanWithCopays[],
      configured: true,
      editable: false,
    };
  }
  const pet = await timed("/pets/:id.getPet", () => getPet(ctx.supabase, id));
  if (!pet) {
    return {
      pet: null,
      timeline: [],
      weights: [],
      vaccineDoses: [] as AppliedDose[],
      dewormingDoses: [] as AppliedDeworming[],
      plans: [] as HealthPlanWithCopays[],
      configured: true,
      editable: false,
    };
  }
  const [timeline, weights, vaccineDoses, dewormingDoses, plans] = await Promise.all([
    timed("/pets/:id.timeline", () => listPetTimeline(ctx.supabase, id)),
    timed("/pets/:id.weights", () => listPetWeights(ctx.supabase, id)),
    timed("/pets/:id.vaccines", () => listPetVaccineDoses(ctx.supabase, id)),
    timed("/pets/:id.deworming", () => listPetDewormingDoses(ctx.supabase, id)),
    timed("/pets/:id.plan", () => listHealthPlansForPet(ctx.supabase, ctx.household.id, id)),
  ]);
  console.log(`[CATCARE_PERF][trace ${trace}][/pets/:id] total=${Math.round(performance.now() - pageStart)}ms`);
  return { pet, timeline, weights, vaccineDoses, dewormingDoses, plans, configured: true, editable: ctx.editable };
}

const QUICK = [
  { type: "weight", label: "Peso", icon: Scale },
  { type: "vaccine", label: "Vacina", icon: Syringe },
  { type: "deworming", label: "Vermífugo", icon: Bug },
  { type: "medication", label: "Remédio", icon: Pill },
] as const;

export default async function PetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; saved?: string; deleted?: string; error?: string }>;
}) {
  const { id } = await params;
  const flags = await searchParams;
  const { pet, timeline, weights, vaccineDoses, dewormingDoses, plans, editable } = await loadPetPage(id);
  if (!pet) notFound();

  const neonatal = isNeonatalPet(pet);
  const hasNeonatalHistory = !neonatal && timeline.some((item: { source?: string }) => item.source === "neonatal");
  const profileTimeline = neonatal ? timeline : timeline.filter((item: { source?: string }) => item.source !== "neonatal");
  const vaccineSchedule = buildVaccineSchedule(pet.birth_date, vaccineDoses, { species: pet.species });
  const dewormingSchedule = buildDewormingSchedule(pet.birth_date, dewormingDoses);
  const actionableVaccine = firstActionableVaccine(vaccineSchedule);
  const actionableDeworming =
    dewormingSchedule.status === "due" || dewormingSchedule.status === "overdue" ? dewormingSchedule : null;
  const lastWeight = weights.length ? weights[weights.length - 1] : null;
  const showWeight = lastWeight ? isRecentWeightDate(lastWeight.date) : false;
  const petReturnTo = `/pets/${pet.id}`;
  const planLabel = healthPlanContextLabel(plans);

  const flash = (
    <>
      {(flags.created || flags.updated || flags.saved) && (
        <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Tudo salvo direitinho.</div>
      )}
      {flags.error && <div className="mt-5 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
      {flags.deleted && (
        <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          {Number(flags.deleted) === 1 ? "1 registro apagado." : `${flags.deleted} registros apagados.`}
        </div>
      )}
    </>
  );

  return (
    <PetChrome pet={pet} editable={editable} active="overview" flash={flash}>
      <div className="cd-pet-read">
      {editable ? (
        <div className="cd-pet-actions" role="group" aria-label={`Registrar para ${pet.name}`}>
          <span className="cd-pet-actions-label">
            <Plus size={13} strokeWidth={2} aria-hidden />
            Registrar
          </span>
          {QUICK.map(({ type, label, icon: Icon }) => (
            <Link key={type} href={typedRecordHref(pet.id, type, petReturnTo)} className="cd-pet-action focus-ring">
              <Icon size={14} strokeWidth={1.75} aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      ) : null}

      {neonatal && editable ? (
        <Link href={preselectRecordHref({ pet: pet.id, returnTo: petReturnTo })} className="cd-pet-neonatal-cta focus-ring">
          <span className="inline-flex items-center gap-2">
            <HeartPulse size={18} aria-hidden />
            Registrar cuidado neonatal
          </span>
          <Plus size={18} aria-hidden />
        </Link>
      ) : null}

      <div className="cd-pet-overview">
          <section className="cd-pet-section" aria-label="Próximos cuidados">
            <h2 className="cd-pet-section-title">Próximos cuidados</h2>
            <ul className="cd-pet-rows">
              {actionableVaccine ? (
                <li>
                  <Link href={`/pets/${pet.id}/saude`} className="cd-pet-row focus-ring">
                    <span className="cd-pet-row-icon" data-tone="saude">
                      <Syringe size={14} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold">
                        {actionableVaccine.name} · {actionableVaccine.doseLabel}
                      </span>
                      <span className="cd-meta block">
                        {actionableVaccine.status === "overdue" ? "Atrasada" : actionableVaccine.status === "due" ? "Na hora" : "Em breve"}
                      </span>
                    </span>
                    <span className="cd-pet-row-cta">Ver em Saúde</span>
                  </Link>
                </li>
              ) : null}
              {actionableDeworming ? (
                <li>
                  <Link href={`/pets/${pet.id}/saude`} className="cd-pet-row focus-ring">
                    <span className="cd-pet-row-icon" data-tone="saude">
                      <Bug size={14} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold">Vermífugo</span>
                      <span className="cd-meta block">
                        {actionableDeworming.status === "overdue" ? "Atrasado" : "Na hora"}
                      </span>
                    </span>
                    <span className="cd-pet-row-cta">Ver em Saúde</span>
                  </Link>
                </li>
              ) : null}
              {!actionableVaccine && !actionableDeworming ? (
                <li>
                  <p className="cd-pet-empty">Nada urgente no protocolo preventivo de {pet.name}.</p>
                </li>
              ) : null}
            </ul>
            <div className="cd-pet-links">
              <Link href="/agenda" className="cd-pet-text-link focus-ring">
                Ver agenda
              </Link>
            </div>
          </section>

          <section className="cd-pet-section" aria-label="Atividade recente">
            <div className="cd-pet-section-head">
              <h2 className="cd-pet-section-title">Atividade recente</h2>
              {profileTimeline.length > 8 ? (
                <Link href={`/pets/${pet.id}/historico`} className="cd-pet-text-link focus-ring">
                  Ver histórico
                </Link>
              ) : null}
            </div>
            <TimelineList
              items={profileTimeline}
              limit={6}
              fullHistoryHref={`/pets/${pet.id}/historico`}
              editable={editable}
              returnTo={`/pets/${pet.id}`}
              filterMode={neonatal ? "neonatal" : "adult"}
              newRecordPetId={pet.id}
              showNewRecord={editable}
              variant="rows"
            />
          </section>

          {showWeight && lastWeight ? (
            <section className="cd-pet-section" aria-label="Último peso">
              <h2 className="cd-pet-section-title">Último peso</h2>
              <p className="cd-body">
                <strong>{formatWeight(lastWeight.grams)}</strong>
                <span className="cd-meta"> · {formatShortDate(lastWeight.date)}</span>
              </p>
              <div className="cd-pet-links">
                {editable ? (
                  <Link href={typedRecordHref(pet.id, "weight", petReturnTo)} className="cd-pet-text-link focus-ring">
                    Registrar peso
                  </Link>
                ) : null}
                <Link href={`/pets/${pet.id}/saude`} className="cd-pet-text-link focus-ring">
                  Ver em Saúde
                </Link>
              </div>
            </section>
          ) : null}

          {planLabel ? (
            <section className="cd-pet-section" aria-label="Plano de saúde">
              <h2 className="cd-pet-section-title">Plano de saúde</h2>
              <p className="cd-body">
                {[planLabel.provider, planLabel.name].filter(Boolean).join(" · ")}
                <span className="cd-meta"> · {planLabel.active ? "Ativo" : "Inativo"}{planLabel.more > 0 ? ` · +${planLabel.more}` : ""}</span>
              </p>
              <div className="cd-pet-links">
                <Link href="/health-plan" className="cd-pet-text-link focus-ring">
                  Ver plano
                </Link>
              </div>
            </section>
          ) : null}
      </div>

      {hasNeonatalHistory ? (
        <Link href={`/pets/${pet.id}/neonatal-history`} className="cd-pet-neonatal-archive focus-ring">
          <span>
            <span className="cd-pet-section-title" style={{ display: "block" }}>
              Arquivo neonatal
            </span>
            <span className="mt-1 block text-sm font-semibold">Ver histórico neonatal</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Alimentação, xixi e cocô de quando {pet.name} ainda era filhote.
            </span>
          </span>
          <HeartPulse className="shrink-0 text-[var(--rose)]" size={22} aria-hidden />
        </Link>
      ) : null}
      </div>
    </PetChrome>
  );
}
