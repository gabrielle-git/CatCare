"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import {
  formatCoverageForDisplay,
  petDiscountHint,
  petloveFeeForPosition,
  resolvePetlovePlanPosition,
  type ExistingHealthPlanRef,
} from "@/lib/health-plan-templates";
import { HEALTH_PLAN_PROVIDER_LABELS } from "@/lib/health-plan";
import { formatCurrency } from "@/lib/format";
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
  existingPlans?: ExistingHealthPlanRef[];
  currentPetId?: string;
  showPetSelect?: boolean;
  mode?: "create" | "edit";
};

function centsToFeeInput(cents: number) {
  return (cents / 100).toFixed(2);
}

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
  mode = "create",
}: PlanFormProps) {
  const petsWithPlan = useMemo(() => new Set(existingPlans.map((plan) => plan.pet_id)), [existingPlans]);
  const selectablePets = useMemo(() => {
    if (mode !== "create") return pets;
    const withoutPlan = pets.filter((pet) => !petsWithPlan.has(pet.id));
    return withoutPlan.length > 0 ? withoutPlan : pets;
  }, [mode, pets, petsWithPlan]);

  const initialPetId = (() => {
    const preferred = currentPetId ?? defaultPetId;
    if (mode === "create" && preferred && petsWithPlan.has(preferred)) {
      return selectablePets[0]?.id ?? preferred;
    }
    if (preferred && selectablePets.some((pet) => pet.id === preferred)) return preferred;
    return selectablePets[0]?.id ?? preferred;
  })();

  const [petId, setPetId] = useState(initialPetId);
  const [provider, setProvider] = useState<HealthPlanProvider>(initialProvider);
  const [planName, setPlanName] = useState(initialPlanName);
  const [coverage, setCoverage] = useState(initialCoverage);
  const [editingCoverage, setEditingCoverage] = useState(!initialCoverage.trim());
  const [monthlyFee, setMonthlyFee] = useState(initialMonthlyFee);
  const [monthlyFeeTouched, setMonthlyFeeTouched] = useState(false);

  const knownPlans = useMemo(() => {
    const map = new Map<string, HealthPlanTemplate>();
    for (const item of templates) map.set(`${item.provider}::${item.plan_name}`, item);
    return [...map.values()];
  }, [templates]);

  const matchedTemplate = useMemo(
    () =>
      templates.find(
        (item) =>
          item.provider === provider &&
          (item.plan_name === planName ||
            item.plan_name.trim().toLowerCase() === planName.trim().toLowerCase() ||
            (provider === "petlove" &&
              item.plan_name.toLowerCase().includes("leve") &&
              planName.toLowerCase().includes("leve"))),
      ),
    [templates, provider, planName],
  );

  useEffect(() => {
    if (matchedTemplate?.coverage_summary && !initialCoverage) {
      setCoverage(matchedTemplate.coverage_summary);
      setEditingCoverage(false);
    }
  }, [matchedTemplate, initialCoverage]);

  useEffect(() => {
    if (!selectablePets.some((pet) => pet.id === petId) && selectablePets[0]?.id) {
      setPetId(selectablePets[0].id);
    }
  }, [petId, selectablePets]);

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

  const { position, others } = useMemo(
    () => resolvePetlovePlanPosition(existingPlans, provider, planName, petId, mode, matchedTemplate?.id),
    [existingPlans, provider, planName, petId, mode, matchedTemplate?.id],
  );

  useEffect(() => {
    if (monthlyFeeTouched || provider !== "petlove" || mode === "edit") return;
    setMonthlyFee(centsToFeeInput(petloveFeeForPosition(position)));
  }, [mode, monthlyFeeTouched, position, provider]);

  const displayCoverage = formatCoverageForDisplay(coverage);
  const discountHint = petDiscountHint(position, provider, others, mode);
  const suggestedFeeCents = provider === "petlove" ? petloveFeeForPosition(position) : null;
  const selectedAlreadyHasPlan = mode === "create" && petsWithPlan.has(petId);

  return (
    <>
      {showPetSelect && (
        <label className="block text-sm font-bold">
          Pet
          <select required name="pet_id" value={petId} onChange={(event) => setPetId(event.target.value)} className="field mt-2">
            {selectablePets.map((pet) => (
              <option key={pet.id} value={pet.id}>{pet.name}</option>
            ))}
          </select>
        </label>
      )}

      {selectedAlreadyHasPlan && (
        <p className="rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          Este pet já tem plano cadastrado. Edite o plano existente ou escolha outro pet.
        </p>
      )}

      {knownPlans.length > 0 && (
        <label className="block text-sm font-bold">
          Usar plano já cadastrado
          <select
            className="field mt-2"
            value={matchedTemplate ? `${provider}::${planName}` : ""}
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
          <input
            name="monthly_fee"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={monthlyFee}
            onChange={(event) => {
              setMonthlyFee(event.target.value);
              setMonthlyFeeTouched(true);
            }}
            className="field mt-2"
            placeholder="Opcional"
          />
        </label>
        <label className="text-sm font-bold">
          Início da vigência
          <input name="started_at" type="date" defaultValue={initialStartedAt} className="field mt-2" />
        </label>
      </div>

      {discountHint && (
        <div className="rounded-[14px] bg-[var(--lavender-soft)] px-3 py-2 text-xs font-semibold text-[var(--lavender-strong)]">
          <p>{discountHint}</p>
          {suggestedFeeCents != null && (
            <p className="mt-1 font-medium">
              Mensalidade deste pet: {formatCurrency(suggestedFeeCents)}
              {position > 1 ? ` (a partir de ${formatCurrency(petloveFeeForPosition(1))})` : ""}.
            </p>
          )}
        </div>
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
