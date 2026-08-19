import Link from "next/link";
import { ArrowLeft, ChevronRight, Plus, Shield } from "lucide-react";
import { ensureAllGuides } from "@/lib/health-plan-guides";
import { ensureHousehold } from "@/lib/households";
import { demoHealthPlanGuides } from "@/lib/mock-data";
import { canEdit, getMyRole } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadGuides() {
  if (!hasSupabaseEnv()) {
    return { guides: demoHealthPlanGuides, editable: false, configured: false };
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { guides: [], editable: false, configured: true };

  const household = await ensureHousehold(supabase, data.user.id);
  const role = await getMyRole(supabase);
  const guides = await ensureAllGuides(supabase, household.id);
  return { guides, editable: canEdit(role), configured: true };
}

export default async function HealthPlanGuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  const [flags, { guides, editable, configured }] = await Promise.all([searchParams, loadGuides()]);

  return (
    <div className="mx-auto w-full max-w-[960px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/health-plan" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Plano de saúde
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">
            <Shield size={15} /> Referências
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Serviços e coparticipação</h1>
          <p className="mt-2 max-w-[640px] text-sm text-[var(--muted)]">
            Tabelas para consultar valores, limites e carências — Petlove e outros planos que você usar.
          </p>
        </div>
        {editable && (
          <Link href="/health-plan/guides/new" className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white">
            <Plus size={18} /> Adicionar tabela
          </Link>
        )}
      </header>

      {!configured && (
        <div className="mt-6 rounded-[20px] bg-[var(--lavender-soft)] px-4 py-3 text-sm">
          <strong>Modo demonstração.</strong> Conecte uma conta para criar e editar tabelas.
        </div>
      )}
      {flags.saved && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Salvo.</div>}
      {flags.deleted && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Removido.</div>}
      {flags.error && <div className="mt-5 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

      <div className="mt-7 space-y-3">
        {guides.map((guide) => (
          <Link
            key={guide.id}
            href={`/health-plan/guides/${guide.id}`}
            className="cat-card focus-ring flex items-center gap-4 p-4 transition hover:-translate-y-0.5"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-[18px] bg-[var(--lavender-soft)]">
              <Shield size={19} className="text-[var(--lavender-strong)]" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate">{guide.title}</strong>
              <span className="mt-1 block text-xs text-[var(--muted)]">
                {guide.provider === "petlove" ? "Petlove Saúde" : "Outro plano"}
                {guide.show_multi_pet_discount ? " • desconto multi-pet" : ""}
              </span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-[var(--muted)]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
