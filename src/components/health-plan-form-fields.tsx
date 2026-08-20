"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { formatCoverageForDisplay, petDiscountHint } from "@/lib/health-plan-templates";
import { HEALTH_PLAN_PROVIDER_LABELS } from "@/lib/health-plan";
import type { HealthPlanProvider, HealthPlanTemplate } from "@/types/database";

type PlanFormProps = {
  templates: HealthPlanTemplate[];
  pets: { id: string; name: string }[];
  defaultPetId: string;
  initialProvider?: HealthPlanProvider;
  initialPlanName?: string;
  initialCoverage?: string;
  initialMonthlyFee?: string;
  initialStartedAt?: string;
  initialActive?: boolean;
  initialNotes?: string;
  existingPlans?: { provider: HealthPlanProvider; plan_name: string; active: boolean; pet_id: string }[];
  currentPetId?: string;
  showPetSelect?: boolean;
};

export function HealthPlanFormFields({
  templates,
  pets,
  defaultPetId,
  initialProvider = "petlove",
  initialPlanName = "Petlove Leve",
  initialCoverage = "",
  initialMonthlyFee = "17.90",
  initialStartedAt = "",
  initialActive = true,
  initialNotes = "",
  existingPlans = [],
  currentPetId,
  showPetSelect = true,
}: PlanFormProps) {
  const [provider, setProvider] = useState<HealthPlanProvider>(initialProvider);
  const [planName, setPlanName] = useState(initialPlanName);
  const [coverage, setCoverage] = useState(initialCoverage);
  const [editingCoverage, setEditingCoverage] = useState(!initialCoverage.trim());

  const knownPlans = useMemo(() => {
    const map = new Map<string, HealthPlanTemplate>();
    for (const item of templates) map.set(`${item.provider}::${item.plan_name}`, item);
    return [...map.values()];
  }, [templates]);

  const matchedTemplate = useMemo(
    () => templates.find((item) => item.provider === provider && item.plan_name === planName),
    [templates, provider, planName],
  );

  useEffect(() => {
    if (matchedTemplate?.coverage_summary && !initialCoverage) {
      setCoverage(matchedTemplate.coverage_summary);
      setEditingCoverage(false);
    }
  }, [matchedTemplate, initialCoverage]);

  const pickTemplate = (value: string) => {
    if (!value) return;
    const [nextProvider, nextPlanName] = value.split("::") as [HealthPlanProvider, string];
    setProvider(nextProvider);
    setPlanName(nextPlanName);
    const template = templates.find((item) => item.provider === nextProvider && item.plan_name === nextPlanName);
    if (template?.coverage_summary) {
      setCoverage(template.coverage_summary);
      setEditingCoverage(false);
    }
  };

  const activeSamePlanCount = useMemo(
    () =>
      existingPlans.filter(
        (plan) =>
          plan.active &&
          plan.provider === provider &&
          plan.plan_name === planName &&
          plan.pet_id !== (currentPetId ?? defaultPetId),
      ).length,
    [existingPlans, provider, planName, currentPetId, defaultPetId],
  );

  const displayCoverage = formatCoverageForDisplay(coverage);
  const discountHint = petDiscountHint(activeSamePlanCount, provider);

  return (
    <>
      {showPetSelect && (
        <label className="block text-sm font-bold">
          Pet
          <select required name="pet_id" defaultValue={defaultPetId} className="field mt-2">
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>{pet.name}</option>
            ))}
          </select>
        </label>
      )}

      {knownPlans.length > 0 && (
        <label className="block text-sm font-bold">
          Usar plano já cadastrado
          <select
            className="field mt-2"
            defaultValue={matchedTemplate ? `${provider}::${planName}` : ""}
            onChange={(event) => pickTemplate(event.target.value)}
          >
            <option value="">Novo ou personalizado</option>
            {knownPlans.map((item) => (
              <option key={item.id} value={`${item.provider}::${item.plan_name}`}>
                {item.plan_name} ({HEALTH_PLAN_PROVIDER_LABELS[item.provider]})
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Operadora
          <select
            required
            name="provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value as HealthPlanProvider)}
            className="field mt-2"
          >
            {Object.entries(HEALTH_PLAN_PROVIDER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Nome do plano
          <input
            required
            name="plan_name"
            value={planName}
            onChange={(event) => setPlanName(event.target.value)}
            className="field mt-2"
            placeholder="Ex.: Petlove Leve"
          />
        </label>
        <label className="text-sm font-bold">
          Mensalidade (R$)
          <input name="monthly_fee" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={initialMonthlyFee} className="field mt-2" placeholder="Opcional" />
        </label>
        <label className="text-sm font-bold">
          Início da vigência
          <input name="started_at" type="date" defaultValue={initialStartedAt} className="field mt-2" />
        </label>
      </div>

      {discountHint && (
        <p className="rounded-[14px] bg-[var(--lavender-soft)] px-3 py-2 text-xs font-semibold text-[var(--lavender-strong)]">{discountHint}</p>
      )}

      <label className="flex items-center gap-3 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold">
        <input type="checkbox" name="active" defaultChecked={initialActive} className="size-4 accent-[var(--lavender)]" /> Plano ativo
      </label>

      <label className="block text-sm font-bold">
        Observações gerais (deste pet)
        <textarea name="notes" rows={2} defaultValue={initialNotes} className="field mt-2 resize-none" placeholder="Apólice, contato da operadora..." />
      </label>

      <input type="hidden" name="coverage_summary" value={coverage} />
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold">Resumo do que o plano cobre</p>
          {!editingCoverage && displayCoverage && (
            <button
              type="button"
              onClick={() => setEditingCoverage(true)}
              className="focus-ring inline-flex items-center gap-1 rounded-lg bg-[var(--cream)] px-2 py-1 text-[10px] font-bold"
            >
              <Pencil size={11} /> Editar
            </button>
          )}
        </div>
        {matchedTemplate && (
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Modelo compartilhado — vale para todos os pets com {planName}.
          </p>
        )}
        {editingCoverage || !displayCoverage ? (
          <textarea
            rows={5}
            value={coverage}
            onChange={(event) => setCoverage(event.target.value)}
            onBlur={() => {
              if (coverage.trim()) setEditingCoverage(false);
            }}
            placeholder={"Consultas em horário normal;\nVacinas obrigatórias;\nMicrochipagem gratuita;"}
            className="field mt-2 min-h-[7rem] resize-y whitespace-pre-wrap"
          />
        ) : (
          <div className="mt-2 rounded-[14px] bg-[var(--cream)] px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap">
            {displayCoverage}
          </div>
        )}
      </div>
    </>
  );
}
