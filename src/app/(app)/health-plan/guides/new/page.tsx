import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { HEALTH_PLAN_PROVIDER_LABELS } from "@/lib/health-plan";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createHealthPlanGuide } from "../../actions";

export default async function NewHealthPlanGuidePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const flags = await searchParams;
  if (!hasSupabaseEnv()) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Modo demonstração.</div>;

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/health-plan/guides" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Serviços e coparticipação
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <Shield size={22} className="text-[var(--lavender-strong)]" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Adicionar tabela</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">Criar referência de plano</h1>
        </div>
      </div>

      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

      <form action={createHealthPlanGuide} className="cat-card mt-6 space-y-4 p-5 md:p-7">
        <label className="block text-sm font-bold">
          Nome da tabela
          <input required name="title" className="field mt-2" placeholder="Ex.: Serviços e coparticipação Petz" />
        </label>
        <label className="block text-sm font-bold">
          Operadora
          <select required name="provider" defaultValue="other" className="field mt-2">
            {Object.entries(HEALTH_PLAN_PROVIDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Mensalidade base (R$/pet)
          <input name="base_monthly_fee" type="number" min="0" step="0.01" inputMode="decimal" className="field mt-2" placeholder="Opcional" />
        </label>
        <label className="block text-sm font-bold">
          Link oficial
          <input name="official_url" type="url" className="field mt-2" placeholder="https://..." />
        </label>
        <label className="block text-sm font-bold text-[var(--muted)]">
          Notas gerais
          <textarea name="notes" rows={2} className="field mt-2 resize-none" placeholder="Região, vigência da tabela, observações..." />
        </label>
        <label className="block text-sm font-bold">
          Como paga a coparticipação
          <textarea name="payment_notes" rows={3} className="field mt-2 resize-none" placeholder="Uma linha por item. Ex.: Pago na clínica no atendimento." />
        </label>
        <label className="block text-sm font-bold">
          Carências e prazos
          <textarea name="waiting_notes" rows={3} className="field mt-2 resize-none" placeholder="Uma linha por item. Ex.: Exames — 45 dias de carência." />
        </label>
        <p className="text-xs text-[var(--muted)]">A tabela já vem com serviços padrão (consultas, vacinas, exames…). Edite valores ou remova o que não usar.</p>
        <label className="flex items-center gap-3 rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">
          <input type="checkbox" name="show_multi_pet_discount" className="size-4 accent-[var(--lavender)]" />
          Mostrar simulador de desconto multi-pet (estilo Petlove)
        </label>
        <button className="focus-ring inline-flex w-full items-center justify-center rounded-2xl bg-[var(--graphite)] px-5 py-4 text-sm font-bold text-white">
          Criar tabela
        </button>
      </form>
    </div>
  );
}
