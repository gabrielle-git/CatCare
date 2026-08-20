import Link from "next/link";
import { ArrowLeft, Shield, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { HealthPlanFormFields } from "@/components/health-plan-form-fields";
import { HealthPlanPromoFields } from "@/components/health-plan-promo-fields";
import { listHealthPlanTemplates } from "@/lib/health-plan-templates";
import { getHealthPlan, listHealthPlans } from "@/lib/health-plan";
import { ensureHousehold } from "@/lib/households";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { deleteHealthPlan, updateHealthPlan } from "../../actions";

export default async function EditHealthPlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const flags = await searchParams;
  if (!hasSupabaseEnv()) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Modo demonstração.</div>;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Entre na conta.</div>;

  const household = await ensureHousehold(supabase, data.user.id);
  const [plan, templates, plans, pets] = await Promise.all([
    getHealthPlan(supabase, household.id, id),
    listHealthPlanTemplates(supabase, household.id),
    listHealthPlans(supabase, household.id),
    listPets(supabase, household.id),
  ]);
  if (!plan) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Plano não encontrado.</div>;

  const save = updateHealthPlan.bind(null, id);
  const remove = deleteHealthPlan.bind(null, id);
  const monthlyFee = plan.monthly_fee_cents != null ? (plan.monthly_fee_cents / 100).toFixed(2) : "";
  const existingPlans = plans.map((item) => ({
    provider: item.provider,
    plan_name: item.plan_name,
    active: item.active,
    pet_id: item.pet_id,
    pet_name: pets.find((pet) => pet.id === item.pet_id)?.name,
    template_id: item.template_id,
    started_at: item.started_at,
    created_at: item.created_at,
  }));

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/health-plan" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Plano de saúde
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <Shield size={22} className="text-[var(--lavender-strong)]" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Editar plano</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">{plan.plan_name}</h1>
        </div>
      </div>

      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

      <form action={save} className="mt-6 space-y-5">
        <section className="cat-card space-y-4 p-5 md:p-7">
          <h2 className="text-lg font-bold">Dados do plano</h2>
          <HealthPlanFormFields
            templates={templates}
            pets={[]}
            defaultPetId={plan.pet_id}
            currentPetId={plan.pet_id}
            existingPlans={existingPlans}
            mode="edit"
            initialProvider={plan.provider}
            initialPlanName={plan.plan_name}
            initialCoverage={plan.coverage_summary ?? ""}
            initialMonthlyFee={monthlyFee}
            initialStartedAt={plan.started_at ?? ""}
            initialActive={plan.active}
            initialNotes={plan.notes ?? ""}
            showPetSelect={false}
          />
        </section>

        <HealthPlanPromoFields plan={plan} />

        {plan.provider === "petlove" && (
          <p className="text-sm text-[var(--muted)]">
            Coparticipação e limites na{" "}
            <Link href="/health-plan/guides" className="font-bold text-[var(--lavender-strong)] underline">tabela de serviços</Link>.
          </p>
        )}

        <button className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-4 text-sm font-bold text-white">
          Salvar alterações
        </button>
      </form>

      <section className="mt-5 rounded-[22px] border border-red-100 bg-white p-5">
        <h2 className="font-bold">Remover plano</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Use se parou de pagar ou trocou de operadora. Apaga o registro deste pet.</p>
        <form action={remove} className="mt-4">
          <ConfirmButton message="Remover este plano de saúde permanentemente?" className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-bold text-[var(--danger)]">
            <Trash2 size={15} /> Remover plano
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}
