import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { HealthPlanGuidePanel } from "@/components/health-plan-guide-panel";
import { ConfirmButton } from "@/components/confirm-button";
import { Trash2 } from "lucide-react";
import { ensurePetloveLeveGuide, getHealthPlanGuide } from "@/lib/health-plan-guides";
import { listHealthPlans } from "@/lib/health-plan";
import { ensureHousehold } from "@/lib/households";
import { demoHealthPlanGuides, demoHealthPlans, demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { canEdit, getMyRole } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { addGuideService, deleteGuideService, deleteHealthPlanGuide, saveGuideBaseFee, saveGuideNotes } from "../../actions";

export const dynamic = "force-dynamic";

async function loadGuide(id: string) {
  if (!hasSupabaseEnv()) {
    const guide = demoHealthPlanGuides.find((item) => item.id === id) ?? demoHealthPlanGuides[0];
    const petNames = new Map(demoPets.map((pet) => [pet.id, pet.name]));
    const plans = demoHealthPlans
      .filter((plan) => plan.provider === "petlove")
      .map((plan) => ({ ...plan, pet_name: petNames.get(plan.pet_id) ?? "Pet" }));
    return { guide, plans, editable: false };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const household = await ensureHousehold(supabase, data.user.id);
  const role = await getMyRole(supabase);
  let guide = await getHealthPlanGuide(supabase, household.id, id);
  if (!guide) redirect("/health-plan/guides");

  if (guide.services.length === 0 && guide.slug === "petlove-leve") {
    guide = await ensurePetloveLeveGuide(supabase, household.id);
  }

  const [pets, plans] = await Promise.all([
    listPets(supabase, household.id),
    listHealthPlans(supabase, household.id),
  ]);
  const petNames = new Map(pets.map((pet) => [pet.id, pet.name]));
  const linkedPlans = plans.map((plan) => ({ ...plan, pet_name: petNames.get(plan.pet_id) ?? "Pet" }));

  return { guide, plans: linkedPlans, editable: canEdit(role) };
}

export default async function HealthPlanGuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  const { id } = await params;
  const [flags, { guide, plans, editable }] = await Promise.all([searchParams, loadGuide(id)]);

  return (
    <div className="mx-auto w-full max-w-[960px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/health-plan/guides" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Serviços e coparticipação
      </Link>

      <header className="mt-4">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">
          <Shield size={15} /> {guide.provider === "petlove" ? "Petlove Saúde" : "Plano de saúde"}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">{guide.title}</h1>
      </header>

      {flags.saved && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Salvo.</div>}
      {flags.deleted && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Serviço removido.</div>}
      {flags.error && <div className="mt-5 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

      <div className="mt-8">
        <HealthPlanGuidePanel
          guide={guide}
          editable={editable}
          saveBaseFeeAction={editable ? saveGuideBaseFee : undefined}
          addServiceAction={editable ? addGuideService : undefined}
          deleteServiceAction={editable ? deleteGuideService : undefined}
          saveNotesAction={editable ? saveGuideNotes : undefined}
          householdPlans={plans}
        />
      </div>

      {editable && guide.slug !== "petlove-leve" && (
        <section className="mt-8 rounded-[22px] border border-red-100 bg-white p-5">
          <h2 className="font-bold">Apagar tabela</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Remove esta referência e todos os serviços cadastrados nela.</p>
          <form action={deleteHealthPlanGuide.bind(null, guide.id)} className="mt-4">
            <ConfirmButton message="Apagar esta tabela permanentemente?" className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-bold text-[var(--danger)]">
              <Trash2 size={15} /> Apagar tabela
            </ConfirmButton>
          </form>
        </section>
      )}
    </div>
  );
}
