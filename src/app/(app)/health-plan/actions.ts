"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { HEALTH_COPAY_SERVICES, resolveHealthPlanCreateOwnership } from "@/lib/health-plan";
import { upsertHealthPlanTemplate } from "@/lib/health-plan-templates";
import { APP_TIMEZONE } from "@/lib/format";
import { isUuid } from "@/lib/attachments";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
import { redirectPathWithParam, resolveReturnTo, safeReturnPath } from "@/lib/safe-return-path";
import { createClient } from "@/lib/supabase/server";
import type { BenefitMembershipKind, HealthCopayServiceType, HealthPlanCoverageStatus, HealthPlanProvider } from "@/types/database";

const providers = new Set<HealthPlanProvider>(["petlove", "other"]);
const membershipKinds = new Set<BenefitMembershipKind>(["petlove_club", "petz_club", "other"]);
const coverageStatuses = new Set<HealthPlanCoverageStatus>(["covered", "not_covered", "partial"]);
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function moneyToCents(raw: string) {
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
}

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { supabase, household };
}

function formReturnTo(formData: FormData, fallback: string) {
  return safeReturnPath(value(formData, "return_to"), fallback);
}

function redirectFail(path: string, message: string, returnTo: string | null): never {
  const params = new URLSearchParams({ error: message });
  if (returnTo) params.set("return_to", returnTo);
  redirect(`${path}?${params.toString()}`);
  throw new Error(message);
}

function parseServiceRules(formData: FormData) {
  return HEALTH_COPAY_SERVICES.map((service, index) => {
    const raw = value(formData, `copay_${service.type}`);
    const cents = raw ? moneyToCents(raw) : null;
    if (raw && !Number.isFinite(cents)) return null;

    const coverageRaw = value(formData, `coverage_${service.type}`);
    const coverageStatus = coverageStatuses.has(coverageRaw as HealthPlanCoverageStatus)
      ? (coverageRaw as HealthPlanCoverageStatus)
      : null;
    const coverageNotes = value(formData, `coverage_notes_${service.type}`) || null;
    const copayNotes = value(formData, `copay_notes_${service.type}`) || null;

    const hasData = cents != null || coverageStatus != null || coverageNotes || copayNotes;
    if (!hasData) return { skip: true as const };

    return {
      service_type: service.type as HealthCopayServiceType,
      copay_cents: cents,
      notes: copayNotes,
      coverage_status: coverageStatus,
      coverage_notes: coverageNotes,
      sort_order: index,
    };
  });
}

function todayInAppTimezone() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type CopayRow = {
  health_plan_id: string;
  service_type: HealthCopayServiceType;
  copay_cents: number | null;
  notes: string | null;
  coverage_status: HealthPlanCoverageStatus | null;
  coverage_notes: string | null;
  sort_order: number;
};

/** Upsert the submitted rules first. Remove leftovers only after that succeeds. */
async function replaceCopayRules(
  supabase: Awaited<ReturnType<typeof authContext>>["supabase"],
  planId: string,
  rows: CopayRow[],
) {
  if (rows.length) {
    const { error } = await supabase.from("health_plan_copay_rules").upsert(rows, { onConflict: "health_plan_id,service_type" });
    if (error) return error;
  }
  const keep = rows.map((row) => row.service_type);
  let removal = supabase.from("health_plan_copay_rules").delete().eq("health_plan_id", planId);
  if (keep.length) removal = removal.not("service_type", "in", `(${keep.join(",")})`);
  const { error } = await removal;
  return error;
}

function parsePromoFields(formData: FormData) {
  return {
    promo_coupon_code: value(formData, "promo_coupon_code") || null,
    zero_waiting_consultation: formData.get("zero_waiting_consultation") === "on",
    zero_waiting_vaccine: formData.get("zero_waiting_vaccine") === "on",
    promo_notes: value(formData, "promo_notes") || null,
  };
}

export async function createHealthPlan(formData: FormData) {
  const planId = value(formData, "plan_id");
  const petId = value(formData, "pet_id");
  const provider = value(formData, "provider") as HealthPlanProvider;
  const planName = value(formData, "plan_name");
  const startedAt = value(formData, "started_at") || null;
  const returnTo = resolveReturnTo(value(formData, "return_to"));
  const fail = (message: string): never => {
    const params = new URLSearchParams({ error: message });
    if (returnTo) params.set("return_to", returnTo);
    if (isUuid(planId)) params.set("plan_id", planId);
    if (petId) params.set("pet", petId);
    redirect(`/health-plan/new?${params.toString()}`);
    throw new Error(message);
  };

  if (!petId || !providers.has(provider) || !planName) fail("Preencha pet, operadora e nome do plano.");

  const monthlyRaw = value(formData, "monthly_fee");
  const monthlyFeeCents = monthlyRaw ? moneyToCents(monthlyRaw) : null;
  if (monthlyRaw && !Number.isFinite(monthlyFeeCents)) fail("Mensalidade inválida.");

  const serviceRules = parseServiceRules(formData);
  if (serviceRules.some((rule) => rule === null)) fail("Confira os valores de coparticipação.");

  const { supabase, household } = await authContext();
  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("id")
    .eq("id", petId)
    .eq("household_id", household.id)
    .maybeSingle();
  if (petError || !pet) fail("Esse pet não está nesta família.");

  const { data: existingRow } = await supabase
    .from("health_plans")
    .select("id, household_id, pet_id")
    .eq("id", planId)
    .maybeSingle();
  const ownership = resolveHealthPlanCreateOwnership(planId, household.id, petId, existingRow);
  if (!ownership.ok) {
    fail(ownership.reason === "invalid_id" ? "Não foi possível identificar este cadastro. Recarregue a página." : "Este cadastro não pertence a esta família.");
  }
  if (!ownership.ok) throw new Error("unreachable");

  const coverageSummary = value(formData, "coverage_summary") || null;
  const template = await upsertHealthPlanTemplate(supabase, household.id, provider, planName, coverageSummary);
  const resolvedCoverage = coverageSummary ?? template.coverage_summary;
  const active = formData.get("active") === "on";
  const payload = {
    household_id: household.id,
    pet_id: petId,
    provider,
    plan_name: planName,
    template_id: template.id,
    monthly_fee_cents: monthlyFeeCents,
    started_at: startedAt,
    ended_at: active ? null : todayInAppTimezone(),
    active,
    notes: value(formData, "notes") || null,
    coverage_summary: resolvedCoverage,
    ...parsePromoFields(formData),
    updated_at: new Date().toISOString(),
  };

  if (ownership.status === "create") {
    const { error } = await supabase.from("health_plans").insert({ id: planId, ...payload });
    if (error) fail(error.message);
  } else {
    const { error } = await supabase.from("health_plans").update(payload).eq("id", planId).eq("household_id", household.id);
    if (error) fail(error.message);
  }

  const rows = serviceRules
    .filter((rule): rule is Exclude<typeof rule, null | { skip: true }> => rule != null && !("skip" in rule))
    .map((rule) => ({ ...rule, health_plan_id: planId }));
  const copayError = await replaceCopayRules(supabase, planId, rows);
  if (copayError) fail(copayError.message);

  revalidatePath("/health-plan");
  revalidatePath("/health-plan/guides");
  redirect(redirectPathWithParam(safeReturnPath(returnTo, "/health-plan"), "saved", "1"));
}

export async function updateHealthPlan(planId: string, formData: FormData) {
  const provider = value(formData, "provider") as HealthPlanProvider;
  const planName = value(formData, "plan_name");
  const startedAt = value(formData, "started_at") || null;
  const returnTo = resolveReturnTo(value(formData, "return_to"));
  const fail = (message: string): never => redirectFail(`/health-plan/${planId}/edit`, message, returnTo);

  if (!providers.has(provider) || !planName) fail("Preencha operadora e nome do plano.");

  const monthlyRaw = value(formData, "monthly_fee");
  const monthlyFeeCents = monthlyRaw ? moneyToCents(monthlyRaw) : null;
  if (monthlyRaw && !Number.isFinite(monthlyFeeCents)) fail("Mensalidade inválida.");

  const serviceRules = parseServiceRules(formData);
  if (serviceRules.some((rule) => rule === null)) fail("Confira os valores de coparticipação.");

  const { supabase, household } = await authContext();
  const { data: current, error: currentError } = await supabase
    .from("health_plans")
    .select("id, ended_at, pet_id")
    .eq("id", planId)
    .eq("household_id", household.id)
    .maybeSingle();
  if (currentError || !current) fail("Plano não encontrado nesta família.");
  if (!current) throw new Error("Plano não encontrado nesta família.");
  const { data: pet } = await supabase.from("pets").select("id").eq("id", current.pet_id).eq("household_id", household.id).maybeSingle();
  if (!pet) fail("Esse pet não está nesta família.");

  const coverageSummary = value(formData, "coverage_summary") || null;
  const template = await upsertHealthPlanTemplate(supabase, household.id, provider, planName, coverageSummary);
  const resolvedCoverage = coverageSummary ?? template.coverage_summary;
  const active = formData.get("active") === "on";

  const { error } = await supabase.from("health_plans").update({
    provider,
    plan_name: planName,
    template_id: template.id,
    monthly_fee_cents: monthlyFeeCents,
    started_at: startedAt,
    ended_at: active ? null : current.ended_at ?? todayInAppTimezone(),
    active,
    notes: value(formData, "notes") || null,
    coverage_summary: resolvedCoverage,
    ...parsePromoFields(formData),
    updated_at: new Date().toISOString(),
  }).eq("id", planId).eq("household_id", household.id);
  if (error) fail(error.message);

  const rows = serviceRules.filter((rule): rule is Exclude<typeof rule, null | { skip: true }> => rule != null && !("skip" in rule)).map((rule) => ({ ...rule, health_plan_id: planId }));
  const copayError = await replaceCopayRules(supabase, planId, rows);
  if (copayError) fail(copayError.message);

  revalidatePath("/health-plan");
  revalidatePath("/health-plan/guides");
  redirect(redirectPathWithParam(safeReturnPath(returnTo, "/health-plan"), "saved", "1"));
}

export async function endHealthPlan(planId: string, formData?: FormData) {
  const returnTo = formReturnTo(formData ?? new FormData(), "/health-plan");
  const { supabase, household } = await authContext();
  const { data: current, error: currentError } = await supabase
    .from("health_plans")
    .select("id, ended_at")
    .eq("id", planId)
    .eq("household_id", household.id)
    .maybeSingle();
  if (currentError || !current) redirect(redirectPathWithParam(returnTo, "error", "Plano não encontrado nesta família."));
  const { error } = await supabase
    .from("health_plans")
    .update({
      active: false,
      ended_at: current.ended_at ?? todayInAppTimezone(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("household_id", household.id);
  if (error) redirect(redirectPathWithParam(returnTo, "error", error.message));
  revalidatePath("/health-plan");
  revalidatePath("/health-plan/guides");
  redirect(redirectPathWithParam(returnTo, "ended", "1"));
}

export async function deleteHealthPlan(planId: string, formData?: FormData) {
  const form = formData ?? new FormData();
  const returnTo = formReturnTo(form, "/health-plan");
  if (value(form, "confirm_incorrect") !== "yes") {
    redirect(redirectPathWithParam(returnTo, "error", "A exclusão permanente precisa de confirmação de cadastro incorreto."));
  }
  const { supabase, household } = await authContext();
  const { error } = await supabase.from("health_plans").delete().eq("id", planId).eq("household_id", household.id);
  if (error) redirect(redirectPathWithParam(returnTo, "error", error.message));
  revalidatePath("/health-plan");
  revalidatePath("/health-plan/guides");
  redirect(redirectPathWithParam(returnTo, "deleted", "1"));
}

export async function savePetloveLeveBaseFee(formData: FormData) {
  return saveGuideBaseFee(formData);
}

export async function saveGuideBaseFee(formData: FormData) {
  const guideId = value(formData, "guide_id");
  const monthlyRaw = value(formData, "base_monthly_fee");
  const monthlyFeeCents = monthlyRaw ? moneyToCents(monthlyRaw) : null;
  if (!guideId) redirect("/health-plan/guides?error=Guia%20inv%C3%A1lido.");
  const guideFallback = `/health-plan/guides/${guideId}`;
  const returnTo = formReturnTo(formData, guideFallback);
  if (monthlyRaw && !Number.isFinite(monthlyFeeCents)) {
    redirect(redirectPathWithParam(returnTo, "error", "Mensalidade base inválida."));
  }

  const { supabase, household } = await authContext();
  const { error } = await supabase
    .from("health_plan_guides")
    .update({ base_monthly_fee_cents: monthlyFeeCents, updated_at: new Date().toISOString() })
    .eq("id", guideId)
    .eq("household_id", household.id);
  if (error) redirect(redirectPathWithParam(returnTo, "error", error.message));

  revalidatePath("/health-plan/guides");
  revalidatePath(`/health-plan/guides/${guideId}`);
  redirect(redirectPathWithParam(returnTo, "saved", "1"));
}

export async function createHealthPlanGuide(formData: FormData) {
  const title = value(formData, "title");
  const provider = value(formData, "provider") as HealthPlanProvider;
  if (!title || !providers.has(provider)) redirect("/health-plan/guides/new?error=Preencha%20o%20nome%20da%20tabela.");

  const monthlyRaw = value(formData, "base_monthly_fee");
  const monthlyFeeCents = monthlyRaw ? moneyToCents(monthlyRaw) : null;
  if (monthlyRaw && !Number.isFinite(monthlyFeeCents)) redirect("/health-plan/guides/new?error=Mensalidade%20inv%C3%A1lida.");

  const { supabase, household } = await authContext();
  const existing = await supabase.from("health_plan_guides").select("slug").eq("household_id", household.id);
  if (existing.error) redirect(`/health-plan/guides/new?error=${encodeURIComponent(existing.error.message)}`);

  const taken = new Set((existing.data ?? []).map((row) => row.slug as string));
  const { buildUniqueSlug, seedDefaultGuideServices } = await import("@/lib/health-plan-guides");
  const slug = buildUniqueSlug(title, taken);

  const { data, error } = await supabase
    .from("health_plan_guides")
    .insert({
      household_id: household.id,
      slug,
      title,
      provider,
      base_monthly_fee_cents: monthlyFeeCents,
      official_url: value(formData, "official_url") || null,
      notes: value(formData, "notes") || null,
      payment_notes: value(formData, "payment_notes") || null,
      waiting_notes: value(formData, "waiting_notes") || null,
      show_multi_pet_discount: formData.get("show_multi_pet_discount") === "on",
    })
    .select("id")
    .single();
  if (error) redirect(`/health-plan/guides/new?error=${encodeURIComponent(error.message)}`);

  await seedDefaultGuideServices(supabase, data.id);

  revalidatePath("/health-plan/guides");
  redirect(`/health-plan/guides/${data.id}?saved=1`);
}

export async function saveGuideNotes(formData: FormData) {
  const guideId = value(formData, "guide_id");
  if (!guideId) redirect("/health-plan/guides?error=Guia%20inv%C3%A1lido.");
  const returnTo = formReturnTo(formData, `/health-plan/guides/${guideId}`);

  const { supabase, household } = await authContext();
  const { error } = await supabase
    .from("health_plan_guides")
    .update({
      payment_notes: value(formData, "payment_notes") || null,
      waiting_notes: value(formData, "waiting_notes") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", guideId)
    .eq("household_id", household.id);
  if (error) redirect(redirectPathWithParam(returnTo, "error", error.message));

  revalidatePath(`/health-plan/guides/${guideId}`);
  redirect(redirectPathWithParam(returnTo, "saved", "1"));
}

export async function addGuideService(formData: FormData) {
  const guideId = value(formData, "guide_id");
  const name = value(formData, "name");
  const groupKey = value(formData, "group_key");
  if (!guideId || !name || !groupKey) redirect("/health-plan/guides?error=Preencha%20grupo%20e%20procedimento.");
  const returnTo = formReturnTo(formData, `/health-plan/guides/${guideId}`);

  const copayRaw = value(formData, "copay");
  const copayCents = copayRaw ? moneyToCents(copayRaw) : 0;
  if (copayRaw && !Number.isFinite(copayCents)) redirect(redirectPathWithParam(returnTo, "error", "Coparticipação inválida."));

  const waitingRaw = value(formData, "waiting_days") || "0";
  const waitingDays = Number(waitingRaw);
  if (!Number.isFinite(waitingDays) || waitingDays < 0) redirect(redirectPathWithParam(returnTo, "error", "Carência inválida."));

  const { supabase, household } = await authContext();
  const guide = await supabase.from("health_plan_guides").select("id").eq("id", guideId).eq("household_id", household.id).maybeSingle();
  if (!guide.data) redirect("/health-plan/guides?error=Guia%20n%C3%A3o%20encontrado.");

  const { data: existingServices } = await supabase
    .from("health_plan_guide_services")
    .select("group_key, group_title")
    .eq("guide_id", guideId);

  const { resolveServiceGroup } = await import("@/lib/health-plan-guides");
  const group = resolveServiceGroup(groupKey, (existingServices ?? []) as { group_key: string; group_title: string }[]);

  const { count } = await supabase
    .from("health_plan_guide_services")
    .select("id", { count: "exact", head: true })
    .eq("guide_id", guideId);

  const { error } = await supabase.from("health_plan_guide_services").insert({
    guide_id: guideId,
    group_key: group.key,
    group_title: group.title,
    name,
    copay_cents: copayCents ?? 0,
    annual_limit: value(formData, "annual_limit") || null,
    waiting_days: waitingDays,
    notes: value(formData, "notes") || null,
    sort_order: count ?? 999,
  });
  if (error) redirect(redirectPathWithParam(returnTo, "error", error.message));

  revalidatePath(`/health-plan/guides/${guideId}`);
  redirect(redirectPathWithParam(returnTo, "saved", "1"));
}

export async function deleteGuideService(serviceId: string, formData: FormData) {
  const guideId = value(formData, "guide_id");
  if (!guideId) redirect("/health-plan/guides?error=Guia%20inv%C3%A1lido.");
  const returnTo = formReturnTo(formData, `/health-plan/guides/${guideId}`);

  const { supabase, household } = await authContext();
  const guide = await supabase.from("health_plan_guides").select("id").eq("id", guideId).eq("household_id", household.id).maybeSingle();
  if (!guide.data) redirect("/health-plan/guides?error=Guia%20n%C3%A3o%20encontrado.");

  const { error } = await supabase.from("health_plan_guide_services").delete().eq("id", serviceId).eq("guide_id", guideId);
  if (error) redirect(redirectPathWithParam(returnTo, "error", error.message));

  revalidatePath(`/health-plan/guides/${guideId}`);
  redirect(redirectPathWithParam(returnTo, "deleted", "1"));
}

export async function deleteHealthPlanGuide(guideId: string) {
  const { supabase, household } = await authContext();
  const { error } = await supabase.from("health_plan_guides").delete().eq("id", guideId).eq("household_id", household.id);
  if (error) redirect(`/health-plan/guides?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/health-plan/guides");
  redirect("/health-plan/guides?deleted=1");
}

export async function saveBenefitMembership(formData: FormData) {
  const kind = value(formData, "kind") as BenefitMembershipKind;
  if (!membershipKinds.has(kind)) redirect("/health-plan?error=Assinatura%20inv%C3%A1lida.");

  const membershipId = value(formData, "membership_id");
  const monthlyRaw = value(formData, "monthly_fee");
  const monthlyFeeCents = monthlyRaw ? moneyToCents(monthlyRaw) : null;
  if (monthlyRaw && !Number.isFinite(monthlyFeeCents)) redirect("/health-plan?error=Mensalidade%20inv%C3%A1lida.");

  const renewsAt = value(formData, "renews_at") || null;
  const active = formData.get("active") === "on";
  const notes = value(formData, "notes") || null;
  const customName = kind === "other" ? value(formData, "custom_name") : null;
  if (kind === "other" && !customName) redirect("/health-plan?error=Informe%20o%20nome%20do%20clube.");

  const { supabase, household } = await authContext();

  const payload = {
    household_id: household.id,
    kind,
    custom_name: kind === "other" ? customName : null,
    active,
    monthly_fee_cents: monthlyFeeCents,
    renews_at: renewsAt,
    notes,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (membershipId) {
    ({ error } = await supabase.from("benefit_memberships").update(payload).eq("id", membershipId).eq("household_id", household.id));
  } else if (kind === "petlove_club") {
    const existing = await supabase
      .from("benefit_memberships")
      .select("id")
      .eq("household_id", household.id)
      .eq("kind", "petlove_club")
      .maybeSingle();
    error = existing.data
      ? (await supabase.from("benefit_memberships").update(payload).eq("id", existing.data.id)).error
      : (await supabase.from("benefit_memberships").insert(payload)).error;
  } else {
    ({ error } = await supabase.from("benefit_memberships").insert(payload));
  }

  if (error) redirect(`/health-plan?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/health-plan");
  revalidatePath("/shopping");
  redirect("/health-plan?membership=1");
}

export async function deleteBenefitMembership(membershipId: string) {
  const { supabase, household } = await authContext();
  const { error } = await supabase
    .from("benefit_memberships")
    .delete()
    .eq("id", membershipId)
    .eq("household_id", household.id)
    .eq("kind", "other");
  if (error) redirect(`/health-plan?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/health-plan");
  revalidatePath("/shopping");
  redirect("/health-plan?membership=1");
}
