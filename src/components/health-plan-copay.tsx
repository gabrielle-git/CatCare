"use client";

import { formatCurrency } from "@/lib/format";
import { copayServiceLabel, HEALTH_COVERAGE_STATUS_LABELS, HEALTH_COPAY_SERVICES } from "@/lib/health-plan";
import type { HealthPlanCopayRule, HealthPlanCoverageStatus } from "@/types/database";

const coverageTone: Record<HealthPlanCoverageStatus, string> = {
  covered: "bg-[var(--mint-soft)] text-[var(--success)]",
  not_covered: "bg-red-50 text-[var(--danger)]",
  partial: "bg-[var(--peach)] text-[#96613e]",
};

export function HealthPlanCoverageTable({ rules, summary }: { rules: HealthPlanCopayRule[]; summary?: string | null }) {
  const map = new Map(rules.map((rule) => [rule.service_type, rule]));
  const filled = HEALTH_COPAY_SERVICES.filter((service) => {
    const rule = map.get(service.type);
    return rule?.coverage_status != null;
  });

  if (!summary && filled.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Nenhuma cobertura cadastrada ainda.</p>;
  }

  return (
    <div className="space-y-4">
      {summary && (
        <p className="rounded-[18px] bg-[var(--cream)] px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">{summary}</p>
      )}
      {filled.length > 0 && (
        <div className="overflow-hidden rounded-[18px] border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--cream)]/80 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-2.5">Procedimento</th>
                <th className="px-4 py-2.5">Cobertura</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-white">
              {filled.map((service) => {
                const rule = map.get(service.type)!;
                const status = rule.coverage_status!;
                return (
                  <tr key={service.type}>
                    <td className="px-4 py-3">
                      <p className="font-bold">{copayServiceLabel(service.type)}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">{service.hint}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${coverageTone[status]}`}>
                        {HEALTH_COVERAGE_STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-[var(--muted)] sm:table-cell">{rule.coverage_notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function HealthPlanCopayTable({ rules }: { rules: HealthPlanCopayRule[] }) {
  const map = new Map(rules.map((rule) => [rule.service_type, rule]));
  const filled = HEALTH_COPAY_SERVICES.filter((service) => {
    const rule = map.get(service.type);
    return rule?.copay_cents != null;
  });

  if (filled.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Nenhuma coparticipação cadastrada ainda.</p>;
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--border)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--cream)]/80 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
          <tr>
            <th className="px-4 py-2.5">Procedimento</th>
            <th className="px-4 py-2.5">Coparticipação</th>
            <th className="hidden px-4 py-2.5 sm:table-cell">Observação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] bg-white">
          {filled.map((service) => {
            const rule = map.get(service.type)!;
            return (
              <tr key={service.type}>
                <td className="px-4 py-3">
                  <p className="font-bold">{copayServiceLabel(service.type)}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">{service.hint}</p>
                </td>
                <td className="px-4 py-3 font-bold text-[var(--lavender-strong)]">
                  {rule.copay_cents != null ? formatCurrency(rule.copay_cents) : "—"}
                </td>
                <td className="hidden px-4 py-3 text-xs text-[var(--muted)] sm:table-cell">{rule.notes || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type ServiceRuleForm = {
  service_type: string;
  copay_cents: number | null;
  notes: string | null;
  coverage_status: HealthPlanCoverageStatus | null;
  coverage_notes: string | null;
};

export function HealthPlanServiceFields({
  rules,
  disabled = false,
}: {
  rules: ServiceRuleForm[];
  disabled?: boolean;
}) {
  const map = new Map(rules.map((rule) => [rule.service_type, rule]));

  return (
    <div className="space-y-3">
      {HEALTH_COPAY_SERVICES.map((service) => {
        const rule = map.get(service.type);
        const defaultCopay = rule?.copay_cents != null ? (rule.copay_cents / 100).toFixed(2) : "";
        return (
          <div key={service.type} className="rounded-[18px] border border-[var(--border)] bg-white p-4">
            <div>
              <p className="text-sm font-bold">{service.label}</p>
              {service.hint && <p className="mt-0.5 text-[10px] text-[var(--muted)]">{service.hint}</p>}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                Cobertura do plano
                <select
                  disabled={disabled}
                  name={`coverage_${service.type}`}
                  defaultValue={rule?.coverage_status ?? ""}
                  className="field mt-1.5"
                >
                  <option value="">Não informado</option>
                  <option value="covered">Coberto</option>
                  <option value="partial">Parcial</option>
                  <option value="not_covered">Não coberto</option>
                </select>
              </label>
              <label className="text-xs font-bold">
                Detalhe da cobertura
                <input
                  disabled={disabled}
                  name={`coverage_notes_${service.type}`}
                  defaultValue={rule?.coverage_notes ?? ""}
                  className="field mt-1.5"
                  placeholder="Ex.: 4 consultas/ano, rede credenciada"
                />
              </label>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                Coparticipação (R$)
                <input
                  disabled={disabled}
                  name={`copay_${service.type}`}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={defaultCopay}
                  placeholder="Ex.: 45,00"
                  className="field mt-1.5"
                />
              </label>
              <label className="text-xs font-bold text-[var(--muted)]">
                Obs. coparticipação
                <input
                  disabled={disabled}
                  name={`copay_notes_${service.type}`}
                  defaultValue={rule?.notes ?? ""}
                  className="field mt-1.5"
                  placeholder="Ex.: limite de 2 consultas/mês"
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
