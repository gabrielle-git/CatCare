import type { SupabaseClient } from "@supabase/supabase-js";
import type { HealthPlanProvider, HealthPlanTemplate } from "@/types/database";

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

export function petDiscountHint(activeSamePlanCount: number, provider: HealthPlanProvider) {
  if (provider !== "petlove" || activeSamePlanCount <= 0) return null;
  const position = activeSamePlanCount + 1;
  const discount = position === 1 ? 0 : position === 2 ? 10 : position === 3 ? 20 : 30;
  if (discount === 0) return "Este será o 1º pet no plano — mensalidade cheia.";
  return `Este será o ${position}º pet no plano — desconto de ${discount}% na mensalidade (Petlove).`;
}
