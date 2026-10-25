import Link from "next/link";
import { notFound } from "next/navigation";
import { Bug, FlaskConical, Pill, Scale, Stethoscope, Syringe, Thermometer } from "lucide-react";
import { PetChrome } from "@/components/pet-chrome";
import { PetPreventiveCareCard } from "@/components/pet-preventive-care-card";
import { WeightChart } from "@/components/weight-chart";
import { isNeonatalPet } from "@/lib/format";
import { HEALTH_PLAN_PROVIDER_LABELS, getHealthPlanForPet } from "@/lib/health-plan";
import { demoPets, demoWeights } from "@/lib/mock-data";
import { getPet } from "@/lib/pets";
import { listPetDewormingDoses, listPetVaccineDoses, listPetWeights } from "@/lib/records";
import { typedRecordHref } from "@/lib/record-links";
import { buildDewormingSchedule, type AppliedDeworming } from "@/lib/deworming-schedule";
import { buildVaccineSchedule, type AppliedDose } from "@/lib/vaccine-schedule";
import { getAuthenticatedContext } from "@/lib/auth-context";
import { isLiveData } from "@/lib/demo-mode";
import type { HealthPlanWithCopays } from "@/types/database";

async function loadSaude(id: string) {
  if (!(await isLiveData())) {
    const pet = demoPets.find((item) => item.id === id) ?? null;
    return {
      pet,
      weights: pet ? (demoWeights[pet.id] ?? []) : [],
      vaccineDoses: [] as AppliedDose[],
      dewormingDoses: [] as AppliedDeworming[],
      plan: null as HealthPlanWithCopays | null,
      editable: false,
    };
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    return {
      pet: null,
      weights: [],
      vaccineDoses: [] as AppliedDose[],
      dewormingDoses: [] as AppliedDeworming[],
      plan: null as HealthPlanWithCopays | null,
      editable: false,
    };
  }
  const pet = await getPet(ctx.supabase, id);
  if (!pet) {
    return {
      pet: null,
      weights: [],
      vaccineDoses: [] as AppliedDose[],
      dewormingDoses: [] as AppliedDeworming[],
      plan: null as HealthPlanWithCopays | null,
      editable: false,
    };
  }
  const [weights, vaccineDoses, dewormingDoses, plan] = await Promise.all([
    listPetWeights(ctx.supabase, id),
    listPetVaccineDoses(ctx.supabase, id),
    listPetDewormingDoses(ctx.supabase, id),
    getHealthPlanForPet(ctx.supabase, ctx.household.id, id),
  ]);
  return { pet, weights, vaccineDoses, dewormingDoses, plan, editable: ctx.editable };
}

const CATEGORIES = [
  { type: "consultation", label: "Consultas", icon: Stethoscope, hint: "Consultas e visitas ao vet" },
  { type: "vaccine", label: "Vacinas", icon: Syringe, hint: "Calendário e doses aplicadas" },
  { type: "medication", label: "Medicamentos", icon: Pill, hint: "Remédios e tratamentos" },
  { type: "deworming", label: "Vermífugos", icon: Bug, hint: "Protocolo antiparasitário" },
  { type: "exam", label: "Exames", icon: FlaskConical, hint: "Laboratório e imagem" },
  { type: "weight", label: "Peso", icon: Scale, hint: "Acompanhamento de peso" },
] as const;

export default async function PetSaudePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pet, weights, vaccineDoses, dewormingDoses, plan, editable } = await loadSaude(id);
  if (!pet) notFound();

  const neonatal = isNeonatalPet(pet);
  const vaccineSchedule = buildVaccineSchedule(pet.birth_date, vaccineDoses, { species: pet.species });
  const dewormingSchedule = buildDewormingSchedule(pet.birth_date, dewormingDoses);
  const returnTo = `/pets/${pet.id}/saude`;
  const providerLabel = plan ? HEALTH_PLAN_PROVIDER_LABELS[plan.provider] : null;

  return (
    <PetChrome pet={pet} editable={editable} active="saude">
      <section className="cd-pet-section" aria-label="Categorias de saúde">
        <h2 className="cd-pet-section-title">Saúde de {pet.name}</h2>
        <p className="cd-pet-lede">Registros e atalhos deste pet — sem substituir Cuidados global.</p>
        <ul className="cd-pet-rows mt-3">
          {CATEGORIES.map(({ type, label, icon: Icon, hint }) => (
            <li key={type}>
              <Link href={`/pets/${pet.id}/historico?type=${type}`} className="cd-pet-row focus-ring">
                <span className="cd-pet-row-icon" data-tone="saude">
                  <Icon size={14} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="cd-meta block">{hint}</span>
                </span>
                <span className="cd-pet-row-cta">Ver histórico</span>
              </Link>
            </li>
          ))}
          {neonatal ? (
            <li>
              <Link href={`/pets/${pet.id}/historico?type=temperature`} className="cd-pet-row focus-ring">
                <span className="cd-pet-row-icon" data-tone="neonatal">
                  <Thermometer size={14} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold">Temperatura</span>
                  <span className="cd-meta block">Disponível na fase neonatal</span>
                </span>
                <span className="cd-pet-row-cta">Ver histórico</span>
              </Link>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="cd-pet-section" aria-label="Prevenção">
        <h2 className="cd-pet-section-title">Prevenção</h2>
        <div className="mt-2">
          <PetPreventiveCareCard
            vaccineSchedule={vaccineSchedule}
            dewormingSchedule={dewormingSchedule}
            petId={pet.id}
            petName={pet.name}
            editable={editable}
            compact={false}
          />
        </div>
      </section>

      <section className="cd-pet-section" aria-label="Peso">
        {weights.length > 0 ? (
          <WeightChart
            data={weights}
            petId={pet.id}
            petName={pet.name}
            historyHref={`/pets/${pet.id}/historico?type=weight`}
            registerHref={editable ? typedRecordHref(pet.id, "weight", returnTo) : undefined}
          />
        ) : (
          <>
            <h2 className="cd-pet-section-title">Peso</h2>
            <p className="cd-pet-empty">Sem pesagens ainda.</p>
            {editable ? (
              <div className="cd-pet-links">
                <Link href={typedRecordHref(pet.id, "weight", returnTo)} className="cd-pet-text-link focus-ring">
                  Registrar peso
                </Link>
              </div>
            ) : null}
          </>
        )}
      </section>

      {plan ? (
        <section className="cd-pet-section" aria-label="Plano">
          <h2 className="cd-pet-section-title">Plano de saúde</h2>
          <p className="text-sm font-semibold">
            {[providerLabel, plan.plan_name].filter(Boolean).join(" · ")}
            <span className="cd-meta font-normal">
              {" "}
              · {plan.active ? "Ativo" : "Inativo"}
            </span>
          </p>
          <div className="cd-pet-links">
            <Link href="/health-plan" className="cd-pet-text-link focus-ring">
              Administrar em Finanças → Planos
            </Link>
          </div>
        </section>
      ) : null}

      <div className="cd-pet-links mt-2">
        <Link href={`/pets/${pet.id}/historico`} className="cd-pet-text-link focus-ring">
          Ver histórico completo
        </Link>
        <Link href="/cuidados" className="cd-pet-text-link focus-ring">
          Ir para Cuidados
        </Link>
      </div>
    </PetChrome>
  );
}
