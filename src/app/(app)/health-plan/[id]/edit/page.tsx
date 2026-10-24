import Link from "next/link";
import { ArrowLeft, Shield, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { HealthPlanFormFields } from "@/components/health-plan-form-fields";
import { HealthPlanPromoFields } from "@/components/health-plan-promo-fields";
import { listHealthPlanTemplates } from "@/lib/health-plan-templates";
import { getHealthPlan, listHealthPlans } from "@/lib/health-plan";
import { ensureHousehold } from "@/lib/households";
import { listPets } from "@/lib/pets";
import { isLiveData } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/safe-return-path";
import { deleteHealthPlan, endHealthPlan, updateHealthPlan } from "../../actions";

export default async function EditHealthPlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; return_to?: string }> }) {
  const { id } = await params;
  const flags = await searchParams;
  if (!(await isLiveData())) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Modo demonstração.</div>;

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
  const end = endHealthPlan.bind(null, id);
  const monthlyFee = plan.monthly_fee_cents != null ? (plan.monthly_fee_cents / 100).toFixed(2) : "";
  const petName = pets.find((pet) => pet.id === plan.pet_id)?.name;
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
  const returnTo = safeReturnPath(flags.return_to, "/health-plan");

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href={returnTo} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Plano de saúde
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <Shield size={22} className="text-[var(--lavender-strong)]" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Editar plano{petName ? ` · ${petName}` : ""}</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">{plan.plan_name}</h1>
        </div>
      </div>

      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

      <form action={save} className="mt-6 space-y-5">
        <input type="hidden" name="return_to" value={returnTo} />
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
            endedAt={plan.ended_at}
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

      {plan.active && (
        <section className="mt-5 rounded-[22px] border border-[var(--border)] bg-white p-5">
          <h2 className="font-bold">Encerrar plano</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Use quando parar de pagar ou trocar de operadora. O histórico e as coparticipações deste plano permanecem. Os outros planos de {petName ?? "este pet"} não mudam.</p>
          <form action={end} className="mt-4">
            <input type="hidden" name="return_to" value={returnTo} />
            <ConfirmButton title="Encerrar plano?" confirmLabel="Encerrar" message="Encerrar este plano e manter o histórico?" className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-3 text-xs font-bold">
              Encerrar plano
            </ConfirmButton>
          </form>
        </section>
      )}

      <section className="mt-5 rounded-[22px] border border-red-100 bg-white p-5">
        <h2 className="font-bold">Excluir cadastro incorreto</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Apaga este plano e as coparticipações dele. Não use para encerrar um plano que existiu de verdade.</p>
        <form action={remove} className="mt-4">
          <input type="hidden" name="return_to" value={returnTo} />
          <input type="hidden" name="confirm_incorrect" value="yes" />
          <ConfirmButton title="Excluir cadastro incorreto?" confirmLabel="Excluir cadastro" message="Excluir permanentemente este cadastro incorreto? O histórico deste plano será apagado." className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-bold text-[var(--danger)]">
            <Trash2 size={15} /> Excluir cadastro
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}
