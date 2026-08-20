import Link from "next/link";
import { HeartHandshake, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { PetAvatar } from "@/components/pet-avatar";
import { BenefitMembershipsPanel } from "@/components/benefit-memberships-panel";
import { ConfirmButton } from "@/components/confirm-button";
import { HealthPlanPromoBadges } from "@/components/health-plan-promo-fields";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { listBenefitMemberships, splitMemberships } from "@/lib/benefit-memberships";
import { HEALTH_PLAN_PROVIDER_LABELS, listHealthPlans } from "@/lib/health-plan";
import { formatCoverageForDisplay, mapPetlovePlanPositions, petlovePositionBadge, type ExistingHealthPlanRef } from "@/lib/health-plan-templates";
import { ensureHousehold } from "@/lib/households";
import { demoBenefitMemberships, demoHealthPlans, demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { canEdit, getMyRole } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { saveBenefitMembership, deleteBenefitMembership, deleteHealthPlan } from "./actions";

export const dynamic = "force-dynamic";

async function loadPage() {
  if (!hasSupabaseEnv()) {
    return { pets: demoPets, plans: demoHealthPlans, memberships: demoBenefitMemberships, configured: false, editable: false };
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], plans: [], memberships: [], configured: true, editable: false };
  const role = await getMyRole(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  const [pets, plans, memberships] = await Promise.all([
    listPets(supabase, household.id),
    listHealthPlans(supabase, household.id),
    listBenefitMemberships(supabase, household.id),
  ]);
  return { pets, plans, memberships, configured: true, editable: canEdit(role) };
}

export default async function HealthPlanPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string; membership?: string; error?: string }> }) {
  const flags = await searchParams;
  const { pets, plans, memberships, configured, editable } = await loadPage();
  const { petlove: petloveMembership, others: otherMemberships } = splitMemberships(memberships);
  const planByPet = new Map(plans.map((plan) => [plan.pet_id, plan]));
  const activePlans = plans.filter((plan) => plan.active);
  const existingPlanRefs: ExistingHealthPlanRef[] = plans.map((plan) => ({
    provider: plan.provider,
    plan_name: plan.plan_name,
    active: plan.active,
    pet_id: plan.pet_id,
    pet_name: pets.find((pet) => pet.id === plan.pet_id)?.name,
    template_id: plan.template_id,
    started_at: plan.started_at,
    created_at: plan.created_at,
  }));
  const petlovePositions = mapPetlovePlanPositions(existingPlanRefs);

  return (
    <div className="mx-auto w-full max-w-[960px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">
            <Shield size={15} /> Rotina e saúde
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Plano de saúde</h1>
          <p className="mt-2 max-w-[640px] text-sm text-[var(--muted)]">
            Planos veterinários por pet, clubes com desconto e coparticipação — tudo que impacta o custo dos cuidados.
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Link href="/health-plan/new" className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white">
              <Plus size={18} /> Configurar plano
            </Link>
            <Link href="/health-plan/guides/new" className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold">
              <Plus size={18} /> Adicionar tabela
            </Link>
          </div>
        )}
      </header>

      {!configured && (
        <div className="mt-6 rounded-[20px] bg-[var(--lavender-soft)] px-4 py-3 text-sm">
          <strong>Modo de demonstração.</strong> Conecte uma conta para salvar planos reais.
        </div>
      )}
      {flags.saved && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Plano salvo.</div>}
      {flags.membership && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Assinatura salva.</div>}
      {flags.deleted && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Plano removido.</div>}
      {flags.error && <div className="mt-5 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="cat-card p-5">
          <span className="grid size-9 place-items-center rounded-[14px] bg-[var(--lavender-soft)]"><HeartHandshake size={17} /></span>
          <p className="mt-4 text-xs font-semibold text-[var(--muted)]">Pets com plano</p>
          <p className="mt-1 text-2xl font-bold tracking-[-0.04em]">{activePlans.length} de {pets.length}</p>
        </div>
        <div className="cat-card p-5 sm:col-span-2">
          <p className="text-xs font-semibold text-[var(--muted)]">Tabelas de referência</p>
          <p className="mt-1 text-sm leading-relaxed">
            <Link href="/health-plan/guides" className="font-bold text-[var(--lavender-strong)] underline">Serviços e coparticipação</Link>
            {" "}— Petlove Leve e outros planos. Em{" "}
            <Link href="/shopping" className="font-bold text-[var(--lavender-strong)] underline">Compras</Link>, vincule cupons e assinaturas.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--lavender-strong)]">Clubes e assinaturas</p>
        <h2 className="mt-1 text-xl font-bold">Benefícios da família</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Clube Petlove (produtos) e outras assinaturas com desconto — valor, renovação e status.</p>
        <BenefitMembershipsPanel
          petloveMembership={petloveMembership}
          otherMemberships={otherMemberships}
          saveAction={saveBenefitMembership}
          deleteAction={deleteBenefitMembership}
          editable={editable}
        />
      </section>

      <section className="mt-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--lavender-strong)]">Por pet</p>
        <h2 className="mt-1 text-xl font-bold">Planos de saúde</h2>
      </section>

      {pets.length === 0 ? (
        <section className="cat-card mt-4 p-8 text-center">
          <Shield className="mx-auto text-[var(--lavender)]" size={30} />
          <h2 className="mt-3 text-lg font-bold">Cadastre um pet primeiro</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Depois você configura o plano de saúde dele aqui.</p>
        </section>
      ) : (
        <div className="mt-4 space-y-5">
          {pets.map((pet) => {
            const plan = planByPet.get(pet.id);
            const petloveRank = plan?.provider === "petlove" && plan.active ? petlovePositions.get(pet.id) : undefined;
            return (
              <section key={pet.id} className="cat-card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] bg-[linear-gradient(135deg,var(--lavender-soft),#fff)] p-5 md:p-6">
                  <div className="flex items-start gap-4">
                    <PetAvatar name={pet.name} photoUrl={pet.photo_url} />
                    <div>
                      <h2 className="text-xl font-bold">{pet.name}</h2>
                      {plan ? (
                        <>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {HEALTH_PLAN_PROVIDER_LABELS[plan.provider]} • {plan.plan_name}
                            {!plan.active && <span className="ml-2 rounded-full bg-[var(--cream)] px-2 py-0.5 text-[10px] font-bold">Inativo</span>}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                            {plan.monthly_fee_cents != null && (
                              <span className="rounded-full bg-white/80 px-2.5 py-1">{formatCurrency(plan.monthly_fee_cents)}/mês</span>
                            )}
                            {petloveRank && (
                              <span className="rounded-full bg-[var(--lavender-soft)] px-2.5 py-1 text-[var(--lavender-strong)]">
                                {petlovePositionBadge(petloveRank.position)}
                              </span>
                            )}
                            {plan.started_at && (
                              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[var(--muted)]">Desde {formatShortDate(plan.started_at)}</span>
                            )}
                          </div>
                          <div className="mt-3">
                            <HealthPlanPromoBadges plan={plan} />
                          </div>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-[var(--muted)]">Nenhum plano configurado.</p>
                      )}
                    </div>
                  </div>
                  {editable && (
                    <Link
                      href={plan ? `/health-plan/${plan.id}/edit` : `/health-plan/new?pet=${pet.id}`}
                      className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-xs font-bold shadow-sm"
                    >
                      {plan ? <><Pencil size={14} /> Editar plano</> : <><Plus size={14} /> Configurar</>}
                    </Link>
                  )}
                </div>
                {plan ? (
                  <div className="p-5 md:p-6">
                    {plan.coverage_summary && (
                      <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--lavender-strong)]">Cobertura</p>
                        <div className="mt-2 rounded-[14px] bg-[var(--cream)] px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                          {formatCoverageForDisplay(plan.coverage_summary)}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="text-sm text-[var(--muted)]">
                        {plan.provider === "petlove" ? (
                          <>
                            Coparticipação e limites na{" "}
                            <Link href="/health-plan/guides" className="font-bold text-[var(--lavender-strong)] underline">tabela de serviços</Link>.
                          </>
                        ) : (
                          plan.notes || "Plano registrado."
                        )}
                      </div>
                      {editable && (
                        <form action={deleteHealthPlan.bind(null, plan.id)}>
                          <ConfirmButton
                            message={`Remover o plano de ${pet.name}?`}
                            className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3.5 py-2.5 text-xs font-bold text-[var(--danger)]"
                          >
                            <Trash2 size={14} /> Remover
                          </ConfirmButton>
                        </form>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-5 text-sm text-[var(--muted)] md:p-6">
                    Informe operadora, mensalidade e quanto você paga em cada tipo de procedimento.
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
