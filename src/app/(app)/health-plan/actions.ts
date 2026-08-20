"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { HEALTH_COPAY_SERVICES } from "@/lib/health-plan";
import { syncTemplateCoverageToPlans, upsertHealthPlanTemplate } from "@/lib/health-plan-templates";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
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

function parsePromoFields(formData: FormData) {
  return {
    promo_coupon_code: value(formData, "promo_coupon_code") || null,
    zero_waiting_consultation: formData.get("zero_waiting_consultation") === "on",
    zero_waiting_vaccine: formData.get("zero_waiting_vaccine") === "on",
    promo_notes: value(formData, "promo_notes") || null,
  };
}

export async function createHealthPlan(formData: FormData) {
  const petId = value(formData, "pet_id");
  const provider = value(formData, "provider") as HealthPlanProvider;
  const planName = value(formData, "plan_name");
  const startedAt = value(formData, "started_at") || null;
  if (!petId || !providers.has(provider) || !planName) redirect("/health-plan/new?error=Preencha%20pet%2C%20operadora%20e%20nome%20do%20plano.");

  const monthlyRaw = value(formData, "monthly_fee");
  const monthlyFeeCents = monthlyRaw ? moneyToCents(monthlyRaw) : null;
  if (monthlyRaw && !Number.isFinite(monthlyFeeCents)) redirect("/health-plan/new?error=Mensalidade%20inv%C3%A1lida.");

  const serviceRules = parseServiceRules(formData);
  if (serviceRules.some((rule) => rule === null)) redirect("/health-plan/new?error=Confira%20os%20valores%20de%20coparticipa%C3%A7%C3%A3o.");

  const { supabase, household } = await authContext();

  const existing = await supabase.from("health_plans").select("id").eq("pet_id", petId).eq("household_id", household.id).maybeSingle();
  if (existing.data) redirect(`/health-plan/${existing.data.id}/edit?error=Este%20pet%20j%C3%A1%20tem%20plano.%20Edite%20o%20existente.`);

  const coverageSummary = value(formData, "coverage_summary") || null;
  const template = await upsertHealthPlanTemplate(supabase, household.id, provider, planName, coverageSummary);
  const resolvedCoverage = coverageSummary ?? template.coverage_summary;
  await syncTemplateCoverageToPlans(supabase, template.id, resolvedCoverage);

  const { data: plan, error } = await supabase.from("health_plans").insert({
    household_id: household.id,
    pet_id: petId,
    provider,
    plan_name: planName,
    template_id: template.id,
    monthly_fee_cents: monthlyFeeCents,
    started_at: startedAt,
    active: formData.get("active") === "on",
    notes: value(formData, "notes") || null,
    coverage_summary: resolvedCoverage,
    ...parsePromoFields(formData),
  }).select("id").single();
  if (error) redirect(`/health-plan/new?error=${encodeURIComponent(error.message)}`);

  const rows = serviceRules.filter((rule): rule is Exclude<typeof rule, null | { skip: true }> => rule != null && !("skip" in rule)).map((rule) => ({ ...rule, health_plan_id: plan.id }));
  if (rows.length) {
    const { error: copayError } = await supabase.from("health_plan_copay_rules").insert(rows);
    if (copayError) {
      await supabase.from("health_plans").delete().eq("id", plan.id);
      redirect(`/health-plan/new?error=${encodeURIComponent(copayError.message)}`);
    }
  }

  revalidatePath("/health-plan");
  revalidatePath("/health-plan/guides");
  redirect("/health-plan?saved=1");
}

export async function updateHealthPlan(planId: string, formData: FormData) {
  const provider = value(formData, "provider") as HealthPlanProvider;
  const planName = value(formData, "plan_name");
  const startedAt = value(formData, "started_at") || null;
  if (!providers.has(provider) || !planName) redirect(`/health-plan/${planId}/edit?error=Preencha%20operadora%20e%20nome%20do%20plano.`);

  const monthlyRaw = value(formData, "monthly_fee");
  const monthlyFeeCents = monthlyRaw ? moneyToCents(monthlyRaw) : null;
  if (monthlyRaw && !Number.isFinite(monthlyFeeCents)) redirect(`/health-plan/${planId}/edit?error=Mensalidade%20inv%C3%A1lida.`);

  const serviceRules = parseServiceRules(formData);
  if (serviceRules.some((rule) => rule === null)) redirect(`/health-plan/${planId}/edit?error=Confira%20os%20valores%20de%20coparticipa%C3%A7%C3%A3o.`);

  const { supabase, household } = await authContext();

  const coverageSummary = value(formData, "coverage_summary") || null;
  const template = await upsertHealthPlanTemplate(supabase, household.id, provider, planName, coverageSummary);
  const resolvedCoverage = coverageSummary ?? template.coverage_summary;
  await syncTemplateCoverageToPlans(supabase, template.id, resolvedCoverage);

  const { error } = await supabase.from("health_plans").update({
    provider,
    plan_name: planName,
    template_id: template.id,
    monthly_fee_cents: monthlyFeeCents,
    started_at: startedAt,
    active: formData.get("active") === "on",
    notes: value(formData, "notes") || null,
    coverage_summary: resolvedCoverage,
    ...parsePromoFields(formData),
    updated_at: new Date().toISOString(),
  }).eq("id", planId).eq("household_id", household.id);
  if (error) redirect(`/health-plan/${planId}/edit?error=${encodeURIComponent(error.message)}`);

  await supabase.from("health_plan_copay_rules").delete().eq("health_plan_id", planId);
  const rows = serviceRules.filter((rule): rule is Exclude<typeof rule, null | { skip: true }> => rule != null && !("skip" in rule)).map((rule) => ({ ...rule, health_plan_id: planId }));
  if (rows.length) {
    const { error: copayError } = await supabase.from("health_plan_copay_rules").insert(rows);
    if (copayError) redirect(`/health-plan/${planId}/edit?error=${encodeURIComponent(copayError.message)}`);
  }

  revalidatePath("/health-plan");
  revalidatePath("/health-plan/guides");
  redirect("/health-plan?saved=1");
}

export async function deleteHealthPlan(planId: string) {
  const { supabase, household } = await authContext();
  const { error } = await supabase.from("health_plans").delete().eq("id", planId).eq("household_id", household.id);
  if (error) redirect(`/health-plan?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/health-plan");
  revalidatePath("/health-plan/guides");
  revalidatePath("/health-plan/guides");
  redirect("/health-plan?deleted=1");
}

export async function savePetloveLeveBaseFee(formData: FormData) {
  return saveGuideBaseFee(formData);
}

export async function saveGuideBaseFee(formData: FormData) {
  const guideId = value(formData, "guide_id");
  const monthlyRaw = value(formData, "base_monthly_fee");
  const monthlyFeeCents = monthlyRaw ? moneyToCents(monthlyRaw) : null;
  if (!guideId) redirect("/health-plan/guides?error=Guia%20inv%C3%A1lido.");
  if (monthlyRaw && !Number.isFinite(monthlyFeeCents)) {
    redirect(`/health-plan/guides/${guideId}?error=Mensalidade%20base%20inv%C3%A1lida.`);
  }

  const { supabase, household } = await authContext();
  const { error } = await supabase
    .from("health_plan_guides")
    .update({ base_monthly_fee_cents: monthlyFeeCents, updated_at: new Date().toISOString() })
    .eq("id", guideId)
    .eq("household_id", household.id);
  if (error) redirect(`/health-plan/guides/${guideId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/health-plan/guides");
  revalidatePath(`/health-plan/guides/${guideId}`);
  redirect(`/health-plan/guides/${guideId}?saved=1`);
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
  if (error) redirect(`/health-plan/guides/${guideId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/health-plan/guides/${guideId}`);
  redirect(`/health-plan/guides/${guideId}?saved=1`);
}

export async function addGuideService(formData: FormData) {
  const guideId = value(formData, "guide_id");
  const name = value(formData, "name");
  const groupKey = value(formData, "group_key");
  if (!guideId || !name || !groupKey) redirect("/health-plan/guides?error=Preencha%20grupo%20e%20procedimento.");

  const copayRaw = value(formData, "copay");
  const copayCents = copayRaw ? moneyToCents(copayRaw) : 0;
  if (copayRaw && !Number.isFinite(copayCents)) redirect(`/health-plan/guides/${guideId}?error=Coparticipa%C3%A7%C3%A3o%20inv%C3%A1lida.`);

  const waitingRaw = value(formData, "waiting_days") || "0";
  const waitingDays = Number(waitingRaw);
  if (!Number.isFinite(waitingDays) || waitingDays < 0) redirect(`/health-plan/guides/${guideId}?error=Car%C3%AAncia%20inv%C3%A1lida.`);

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
  if (error) redirect(`/health-plan/guides/${guideId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/health-plan/guides/${guideId}`);
  redirect(`/health-plan/guides/${guideId}?saved=1`);
}

export async function deleteGuideService(serviceId: string, formData: FormData) {
  const guideId = value(formData, "guide_id");
  if (!guideId) redirect("/health-plan/guides?error=Guia%20inv%C3%A1lido.");

  const { supabase, household } = await authContext();
  const guide = await supabase.from("health_plan_guides").select("id").eq("id", guideId).eq("household_id", household.id).maybeSingle();
  if (!guide.data) redirect("/health-plan/guides?error=Guia%20n%C3%A3o%20encontrado.");

  const { error } = await supabase.from("health_plan_guide_services").delete().eq("id", serviceId).eq("guide_id", guideId);
  if (error) redirect(`/health-plan/guides/${guideId}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/health-plan/guides/${guideId}`);
  redirect(`/health-plan/guides/${guideId}?deleted=1`);
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
