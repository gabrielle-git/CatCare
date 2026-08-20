import type { SupabaseClient } from "@supabase/supabase-js";
import type { HealthPlanProvider, HealthPlanTemplate } from "@/types/database";
import { PETLOVE_LEVE_REFERENCE } from "@/lib/petlove-health-reference";

export const DEFAULT_PETLOVE_LEVE_COVERAGE = [
  "Consultas em horário normal",
  "Vacinas obrigatórias",
  "Microchipagem gratuita",
  "Clínico geral a domicílio",
  "Exames laboratoriais simples (grupo de 10/ano)",
].join(";\n");

export function formatCoverageForDisplay(raw: string | null | undefined) {
  if (!raw?.trim()) return "";
  return raw
    .split(/[;\n]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(";\n");
}

export async function listHealthPlanTemplates(supabase: SupabaseClient, householdId: string): Promise<HealthPlanTemplate[]> {
  const { data, error } = await supabase
    .from("health_plan_templates")
    .select("*")
    .eq("household_id", householdId)
    .order("plan_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HealthPlanTemplate[];
}

export async function getHealthPlanTemplate(
  supabase: SupabaseClient,
  householdId: string,
  provider: HealthPlanProvider,
  planName: string,
): Promise<HealthPlanTemplate | null> {
  const { data, error } = await supabase
    .from("health_plan_templates")
    .select("*")
    .eq("household_id", householdId)
    .eq("provider", provider)
    .eq("plan_name", planName)
    .maybeSingle();
  if (error) throw error;
  return data as HealthPlanTemplate | null;
}

export async function upsertHealthPlanTemplate(
  supabase: SupabaseClient,
  householdId: string,
  provider: HealthPlanProvider,
  planName: string,
  coverageSummary: string | null,
  guideId?: string | null,
): Promise<HealthPlanTemplate> {
  const existing = await getHealthPlanTemplate(supabase, householdId, provider, planName);
  const defaultCoverage = provider === "petlove" && planName.toLowerCase().includes("leve")
    ? DEFAULT_PETLOVE_LEVE_COVERAGE
    : null;
  const resolvedCoverage = coverageSummary?.trim()
    ? coverageSummary
    : existing?.coverage_summary ?? defaultCoverage;

  const payload = {
    household_id: householdId,
    provider,
    plan_name: planName,
    coverage_summary: resolvedCoverage,
    guide_id: guideId ?? existing?.guide_id ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from("health_plan_templates")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as HealthPlanTemplate;
  }

  const { data, error } = await supabase
    .from("health_plan_templates")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as HealthPlanTemplate;
}

export async function syncTemplateCoverageToPlans(supabase: SupabaseClient, templateId: string, coverageSummary: string | null) {
  await supabase
    .from("health_plans")
    .update({ coverage_summary: coverageSummary, updated_at: new Date().toISOString() })
    .eq("template_id", templateId);
}

export type ExistingHealthPlanRef = {
  pet_id: string;
  pet_name?: string;
  provider: HealthPlanProvider;
  plan_name: string;
  active: boolean;
  template_id?: string | null;
  started_at?: string | null;
  created_at?: string | null;
};

export function normalizePlanName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Agrupa planos iguais mesmo com nomes levemente diferentes (ex.: "Leve" vs "Petlove Leve"). */
export function sameHealthPlan(
  provider: HealthPlanProvider,
  planName: string,
  other: Pick<ExistingHealthPlanRef, "provider" | "plan_name" | "template_id">,
  templateId?: string | null,
) {
  if (other.provider !== provider) return false;
  if (templateId && other.template_id && templateId === other.template_id) return true;
  const a = normalizePlanName(planName);
  const b = normalizePlanName(other.plan_name);
  if (a === b) return true;
  if (provider === "petlove") {
    const strip = (value: string) => value.replace(/^petlove\s+/, "").replace(/\s+saúde\s+/, " ").trim();
    if (strip(a) === strip(b)) return true;
    if (strip(a).includes("leve") && strip(b).includes("leve")) return true;
  }
  return false;
}

export function petloveDiscountPercent(position: number) {
  if (position <= 1) return 0;
  if (position === 2) return 10;
  if (position === 3) return 20;
  return 30;
}

function planSortTime(plan: ExistingHealthPlanRef) {
  return new Date(plan.started_at || plan.created_at || 0).getTime();
}

function activeSamePlanGroup(
  existingPlans: ExistingHealthPlanRef[],
  provider: HealthPlanProvider,
  planName: string,
  templateId?: string | null,
) {
  return existingPlans.filter((plan) => plan.active && sameHealthPlan(provider, planName, plan, templateId));
}

/**
 * Posição do pet no desconto multi-pet Petlove.
 * - create: sempre “quantos já estão no plano + 1” (não esconde o pet selecionado da conta se ele ainda não tem plano).
 * - edit: posição cronológica entre os pets já no mesmo plano.
 */
export function resolvePetlovePlanPosition(
  existingPlans: ExistingHealthPlanRef[],
  provider: HealthPlanProvider,
  planName: string,
  petId: string,
  mode: "create" | "edit",
  templateId?: string | null,
) {
  const group = activeSamePlanGroup(existingPlans, provider, planName, templateId);
  const others = group.filter((plan) => plan.pet_id !== petId);

  if (mode === "create") {
    return {
      position: others.length + 1,
      others: [...others].sort((a, b) => planSortTime(a) - planSortTime(b) || a.pet_id.localeCompare(b.pet_id)),
    };
  }

  const ordered = [...group].sort((a, b) => planSortTime(a) - planSortTime(b) || a.pet_id.localeCompare(b.pet_id));
  const index = ordered.findIndex((plan) => plan.pet_id === petId);
  return {
    position: index >= 0 ? index + 1 : ordered.length + 1,
    others: ordered.filter((plan) => plan.pet_id !== petId),
  };
}

export function petloveFeeForPosition(position: number, baseFeeCents = PETLOVE_LEVE_REFERENCE.baseMonthlyFeeCents) {
  const discount = petloveDiscountPercent(position);
  return Math.round(baseFeeCents * (1 - discount / 100));
}

export function petDiscountHint(
  position: number,
  provider: HealthPlanProvider,
  others: ExistingHealthPlanRef[],
  mode: "create" | "edit",
) {
  if (provider !== "petlove") return null;
  const discount = petloveDiscountPercent(position);
  const names = others.map((plan) => plan.pet_name).filter(Boolean);
  const already = names.length
    ? `Já neste plano: ${names.join(", ")}.`
    : others.length > 0
      ? `${others.length} pet${others.length === 1 ? "" : "s"} já cadastrado${others.length === 1 ? "" : "s"} neste plano.`
      : "Nenhum outro pet neste plano ainda.";
  const ordinal = `${position}º`;
  const verb = mode === "edit" ? "é" : "será";
  if (discount === 0) return `${already} Este ${verb} o ${ordinal} pet — mensalidade cheia.`;
  return `${already} Este ${verb} o ${ordinal} pet — ${discount}% de desconto na mensalidade (Petlove).`;
}

export function petlovePositionBadge(position: number) {
  const discount = petloveDiscountPercent(position);
  if (discount === 0) return `${position}º pet · mensalidade cheia`;
  return `${position}º pet · ${discount}% off`;
}

/** Posição de cada pet ativo no mesmo plano Petlove (por id do pet). */
export function mapPetlovePlanPositions(existingPlans: ExistingHealthPlanRef[]) {
  const result = new Map<string, { position: number; discountPercent: number; suggestedFeeCents: number }>();

  for (const plan of existingPlans) {
    if (!plan.active || plan.provider !== "petlove") continue;
    if (result.has(plan.pet_id)) continue;

    const group = activeSamePlanGroup(existingPlans, plan.provider, plan.plan_name, plan.template_id);
    const ordered = [...group].sort((a, b) => planSortTime(a) - planSortTime(b) || a.pet_id.localeCompare(b.pet_id));
    ordered.forEach((item, index) => {
      const position = index + 1;
      result.set(item.pet_id, {
        position,
        discountPercent: petloveDiscountPercent(position),
        suggestedFeeCents: petloveFeeForPosition(position),
      });
    });
  }

  return result;
}
