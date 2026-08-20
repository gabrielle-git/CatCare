import type { SupabaseClient } from "@supabase/supabase-js";
import type { HealthCopayServiceType, HealthPlan, HealthPlanCopayRule, HealthPlanWithCopays } from "@/types/database";

export const HEALTH_COPAY_SERVICES: { type: HealthCopayServiceType; label: string; hint?: string }[] = [
  { type: "consultation", label: "Consulta", hint: "Clínico geral ou especialista" },
  { type: "exam", label: "Exame / imagem", hint: "Sangue, raio-x, ultrassom" },
  { type: "surgery", label: "Cirurgia", hint: "Procedimentos eletivos ou programados" },
  { type: "hospitalization", label: "Internação", hint: "Diária ou pacote" },
  { type: "vaccine", label: "Vacina", hint: "Doses do calendário" },
  { type: "deworming", label: "Vermífugo", hint: "Medicação antiparasitária" },
  { type: "emergency", label: "Emergência", hint: "Plantão ou pronto atendimento" },
  { type: "physiotherapy", label: "Fisioterapia", hint: "Sessões de reabilitação" },
  { type: "other", label: "Outros", hint: "Demais procedimentos cobertos" },
];

export const HEALTH_PLAN_PROVIDER_LABELS = {
  petlove: "Petlove Saúde",
  other: "Outro plano",
} as const;

export const HEALTH_COVERAGE_STATUS_LABELS = {
  covered: "Coberto",
  not_covered: "Não coberto",
  partial: "Parcial",
} as const;

export function copayServiceLabel(type: HealthCopayServiceType) {
  return HEALTH_COPAY_SERVICES.find((item) => item.type === type)?.label ?? type;
}

export async function listHealthPlans(supabase: SupabaseClient, householdId: string): Promise<HealthPlanWithCopays[]> {
  const { data: plans, error } = await supabase
    .from("health_plans")
    .select("*")
    .eq("household_id", householdId)
    .order("active", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = (plans ?? []) as HealthPlan[];
  if (rows.length === 0) return [];

  const planIds = rows.map((plan) => plan.id);
  const { data: rules, error: rulesError } = await supabase
    .from("health_plan_copay_rules")
    .select("*")
    .in("health_plan_id", planIds)
    .order("sort_order", { ascending: true });
  if (rulesError) throw rulesError;

  const byPlan = new Map<string, HealthPlanCopayRule[]>();
  for (const rule of (rules ?? []) as HealthPlanCopayRule[]) {
    const list = byPlan.get(rule.health_plan_id) ?? [];
    list.push(rule);
    byPlan.set(rule.health_plan_id, list);
  }

  return rows.map((plan) => ({ ...plan, copay_rules: byPlan.get(plan.id) ?? [] }));
}

export async function getHealthPlan(supabase: SupabaseClient, householdId: string, id: string): Promise<HealthPlanWithCopays | null> {
  const { data, error } = await supabase.from("health_plans").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: rules, error: rulesError } = await supabase
    .from("health_plan_copay_rules")
    .select("*")
    .eq("health_plan_id", id)
    .order("sort_order", { ascending: true });
  if (rulesError) throw rulesError;

  return { ...(data as HealthPlan), copay_rules: (rules ?? []) as HealthPlanCopayRule[] };
}

export async function getHealthPlanForPet(supabase: SupabaseClient, householdId: string, petId: string): Promise<HealthPlanWithCopays | null> {
  const { data, error } = await supabase
    .from("health_plans")
    .select("*")
    .eq("household_id", householdId)
    .eq("pet_id", petId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getHealthPlan(supabase, householdId, data.id);
}

export function defaultCopayRules(): Pick<HealthPlanCopayRule, "service_type" | "copay_cents" | "notes" | "coverage_status" | "coverage_notes" | "sort_order">[] {
  return HEALTH_COPAY_SERVICES.map((service, index) => ({
    service_type: service.type,
    copay_cents: null,
    notes: null,
    coverage_status: null,
    coverage_notes: null,
    sort_order: index,
  }));
}

export function mergeCopayRules(existing: HealthPlanCopayRule[]) {
  const map = new Map(existing.map((rule) => [rule.service_type, rule]));
  return HEALTH_COPAY_SERVICES.map((service, index) => {
    const rule = map.get(service.type);
    return {
      service_type: service.type,
      copay_cents: rule?.copay_cents ?? null,
      notes: rule?.notes ?? null,
      coverage_status: rule?.coverage_status ?? null,
      coverage_notes: rule?.coverage_notes ?? null,
      sort_order: index,
    };
  });
}
