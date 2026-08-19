"use client";

import { Plus } from "lucide-react";
import { buildGroupOptions } from "@/lib/health-plan-guides";
import type { HealthPlanGuideService } from "@/types/database";

export function AddGuideServiceForm({
  guideId,
  services,
  action,
}: {
  guideId: string;
  services: HealthPlanGuideService[];
  action: (formData: FormData) => void;
}) {
  const groupOptions = buildGroupOptions(services);
  const defaultGroup = groupOptions[0]?.key ?? "consultations";

  return (
    <section className="cat-card p-5 md:p-6">
      <div className="flex items-center gap-2">
        <Plus size={18} className="text-[var(--lavender-strong)]" />
        <h3 className="text-lg font-bold">Adicionar serviço</h3>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">Escolha o grupo existente — o procedimento entra na mesma seção, sem duplicar categoria.</p>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="guide_id" value={guideId} />
        <label className="text-xs font-bold sm:col-span-2">
          Grupo / categoria
          <select name="group_key" defaultValue={defaultGroup} className="field mt-1.5">
            {groupOptions.map((group) => (
              <option key={group.key} value={group.key}>{group.title}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold sm:col-span-2">
          Nome do procedimento
          <input name="name" required placeholder="Ex.: Ultrassom abdominal" className="field mt-1.5" />
        </label>
        <label className="text-xs font-bold">
          Coparticipação (R$)
          <input name="copay" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0,00" className="field mt-1.5" />
        </label>
        <label className="text-xs font-bold">
          Limite anual
          <input name="annual_limit" placeholder="Ex.: 2/ano, Ilimitado…" className="field mt-1.5" />
        </label>
        <label className="text-xs font-bold">
          Carência (dias)
          <input name="waiting_days" type="number" min="0" step="1" defaultValue="0" className="field mt-1.5" />
        </label>
        <label className="text-xs font-bold">
          Observação
          <input name="notes" placeholder="Opcional" className="field mt-1.5" />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[var(--graphite)] px-4 py-2.5 text-xs font-bold text-white">
            <Plus size={14} /> Adicionar à tabela
          </button>
        </div>
      </form>
    </section>
  );
}
