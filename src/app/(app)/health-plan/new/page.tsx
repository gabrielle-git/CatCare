import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { HealthPlanFormFields } from "@/components/health-plan-form-fields";
import { HealthPlanPromoFields } from "@/components/health-plan-promo-fields";
import { listHealthPlanTemplates } from "@/lib/health-plan-templates";
import { listHealthPlans } from "@/lib/health-plan";
import { ensureHousehold } from "@/lib/households";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createHealthPlan } from "../actions";

export default async function NewHealthPlanPage({ searchParams }: { searchParams: Promise<{ pet?: string; error?: string }> }) {
  const flags = await searchParams;
  if (!hasSupabaseEnv()) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Modo demonstração.</div>;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Entre na conta.</div>;

  const household = await ensureHousehold(supabase, data.user.id);
  const [pets, templates, plans] = await Promise.all([
    listPets(supabase, household.id),
    listHealthPlanTemplates(supabase, household.id),
    listHealthPlans(supabase, household.id),
  ]);
  const defaultPet = flags.pet && pets.some((pet) => pet.id === flags.pet) ? flags.pet : pets[0]?.id ?? "";
  const existingPlans = plans.map((plan) => ({
    provider: plan.provider,
    plan_name: plan.plan_name,
    active: plan.active,
    pet_id: plan.pet_id,
  }));

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/health-plan" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Plano de saúde
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <Shield size={22} className="text-[var(--lavender-strong)]" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Novo plano</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">Configurar plano</h1>
        </div>
      </div>

      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

      <form action={createHealthPlan} className="mt-6 space-y-5">
        <section className="cat-card space-y-4 p-5 md:p-7">
          <h2 className="text-lg font-bold">Dados do plano</h2>
          <HealthPlanFormFields
            templates={templates}
            pets={pets.map((pet) => ({ id: pet.id, name: pet.name }))}
            defaultPetId={defaultPet}
            currentPetId={defaultPet}
            existingPlans={existingPlans}
          />
        </section>

        <HealthPlanPromoFields />

        <p className="text-sm text-[var(--muted)]">
          Coparticipação e limites do Petlove Leve estão na{" "}
          <Link href="/health-plan/guides" className="font-bold text-[var(--lavender-strong)] underline">tabela de serviços</Link>.
        </p>

        <button className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-4 text-sm font-bold text-white">
          Salvar plano
        </button>
      </form>
    </div>
  );
}
