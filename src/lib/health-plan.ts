import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/attachments";
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

export async function listHealthPlansForPet(
  supabase: SupabaseClient,
  householdId: string,
  petId: string,
): Promise<HealthPlanWithCopays[]> {
  const plans = await listHealthPlans(supabase, householdId);
  return plans.filter((plan) => plan.pet_id === petId);
}

/** One line for a pet screen. Extra active plans stay reachable in Finanças. */
export function healthPlanContextLabel(plans: HealthPlanWithCopays[]) {
  const active = plans.filter((plan) => plan.active);
  const shown = active[0] ?? plans[0] ?? null;
  if (!shown) return null;
  const provider =
    shown.provider in HEALTH_PLAN_PROVIDER_LABELS
      ? HEALTH_PLAN_PROVIDER_LABELS[shown.provider as keyof typeof HEALTH_PLAN_PROVIDER_LABELS]
      : shown.provider;
  return { provider, name: shown.plan_name, active: shown.active, more: Math.max(0, active.length - 1) };
}

export type HealthPlanCreateOwnershipResult =
  | { ok: true; status: "create" | "reuse" }
  | { ok: false; reason: "invalid_id" | "foreign_household" | "pet_mismatch" };

/** Same plan id may finish an interrupted create. A second plan for the pet uses a different id. */
export function resolveHealthPlanCreateOwnership(
  planId: string,
  expectedHouseholdId: string,
  expectedPetId: string,
  existing: { id: string; household_id: string; pet_id: string } | null,
): HealthPlanCreateOwnershipResult {
  if (!isUuid(planId)) return { ok: false, reason: "invalid_id" };
  if (!existing) return { ok: true, status: "create" };
  if (existing.household_id !== expectedHouseholdId) return { ok: false, reason: "foreign_household" };
  if (existing.pet_id !== expectedPetId) return { ok: false, reason: "pet_mismatch" };
  return { ok: true, status: "reuse" };
}

export type HealthPlanCreateSnapshot = {
  provider: string;
  plan_name: string;
  monthly_fee_cents: number | null;
  started_at: string | null;
  active: boolean;
  ended_at: string | null;
  notes: string | null;
  coverage_summary: string | null;
  promo_coupon_code: string | null;
  zero_waiting_consultation: boolean;
  zero_waiting_vaccine: boolean;
  promo_notes: string | null;
};

function sameOptionalText(left: string | null | undefined, right: string | null | undefined) {
  const normalize = (value: string | null | undefined) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length ? trimmed : null;
  };
  return normalize(left) === normalize(right);
}

/** Fields a create retry is allowed to see. Excludes template id and updated_at. */
export function healthPlanCreateSnapshotsMatch(existing: HealthPlanCreateSnapshot, submitted: HealthPlanCreateSnapshot) {
  return existing.provider === submitted.provider
    && sameOptionalText(existing.plan_name, submitted.plan_name)
    && existing.monthly_fee_cents === submitted.monthly_fee_cents
    && (existing.started_at ?? null) === (submitted.started_at ?? null)
    && existing.active === submitted.active
    && (existing.ended_at ?? null) === (submitted.ended_at ?? null)
    && sameOptionalText(existing.notes, submitted.notes)
    && sameOptionalText(existing.coverage_summary, submitted.coverage_summary)
    && sameOptionalText(existing.promo_coupon_code, submitted.promo_coupon_code)
    && existing.zero_waiting_consultation === submitted.zero_waiting_consultation
    && existing.zero_waiting_vaccine === submitted.zero_waiting_vaccine
    && sameOptionalText(existing.promo_notes, submitted.promo_notes);
}

export type CopayCreateRule = {
  service_type: string;
  copay_cents: number | null;
  notes: string | null;
  coverage_status: string | null;
  coverage_notes: string | null;
  sort_order?: number;
};

export type CopayCreateRetry =
  | { action: "noop" }
  | { action: "conflict" };

function sameCopayCreateRule(existing: CopayCreateRule, submitted: CopayCreateRule) {
  return existing.service_type === submitted.service_type
    && existing.copay_cents === submitted.copay_cents
    && sameOptionalText(existing.notes, submitted.notes)
    && (existing.coverage_status ?? null) === (submitted.coverage_status ?? null)
    && sameOptionalText(existing.coverage_notes, submitted.coverage_notes);
}

export type CopayUpdateDecision<T> =
  | { action: "preserve" }
  | { action: "invalid" }
  | { action: "replace"; rules: T[] };

/**
 * A plan edit that does not include the copay editor must not delete stored rules.
 * `submitted` is true only when the form explicitly posts the copay editor.
 * An explicit empty editor replaces the set, including clearing every rule.
 */
export function resolveCopayUpdate<T extends { service_type: string }>(input: {
  submitted: boolean;
  rules: Array<T | null | { skip: true }>;
}): CopayUpdateDecision<T> {
  if (!input.submitted) return { action: "preserve" };
  if (input.rules.some((rule) => rule == null)) return { action: "invalid" };
  return {
    action: "replace",
    rules: input.rules.filter((rule): rule is T => rule != null && !("skip" in rule)),
  };
}

/**
 * A retry may succeed only when the stored rules are exactly the submitted set.
 * A missing rule is ambiguous: the insert may have failed, or a later edit may
 * have removed it. There is no completion flag and the plan insert is not in the
 * same transaction as the rules, so the retry refuses instead of restoring rows.
 */
export function resolveCopayCreateRetry(existing: CopayCreateRule[], submitted: CopayCreateRule[]): CopayCreateRetry {
  const submittedByType = new Map(submitted.map((rule) => [rule.service_type, rule]));
  if (existing.length !== submittedByType.size) return { action: "conflict" };
  for (const rule of existing) {
    const next = submittedByType.get(rule.service_type);
    if (!next || !sameCopayCreateRule(rule, next)) return { action: "conflict" };
  }
  return { action: "noop" };
}

export function groupHealthPlansByPet<T extends { pet_id: string }>(plans: T[]) {
  const grouped = new Map<string, T[]>();
  for (const plan of plans) {
    const list = grouped.get(plan.pet_id) ?? [];
    list.push(plan);
    grouped.set(plan.pet_id, list);
  }
  return grouped;
}

export function countPetsWithActivePlan(plans: Array<{ pet_id: string; active: boolean }>) {
  return new Set(plans.filter((plan) => plan.active).map((plan) => plan.pet_id)).size;
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
