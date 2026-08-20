import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PETLOVE_LEVE_PROCEDURE_GROUPS,
  PETLOVE_LEVE_REFERENCE,
  resolvePetloveLeveBaseFeeCents,
} from "@/lib/petlove-health-reference";
import type { HealthPlanGuide, HealthPlanGuideService, HealthPlanGuideWithServices } from "@/types/database";

export const PETLOVE_LEVE_SLUG = "petlove-leve";

/** Grupos canônicos — novos serviços entram no grupo existente, sem duplicar seção. */
export const DEFAULT_SERVICE_GROUPS = [
  { key: "consultations", title: "Consultas" },
  { key: "vaccines", title: "Vacinas" },
  { key: "lab-simple", title: "Exames laboratoriais" },
  { key: "clinical", title: "Procedimentos clínicos" },
  { key: "services", title: "Serviços" },
  { key: "other", title: "Outros" },
] as const;

export const DEFAULT_GUIDE_STARTER_SERVICES = [
  { group_key: "consultations", group_title: "Consultas", name: "Consulta clínico geral", copay_cents: 0, annual_limit: "Ilimitado", waiting_days: 0 },
  { group_key: "consultations", group_title: "Consultas", name: "Retorno clínico", copay_cents: 0, annual_limit: "Ilimitado", waiting_days: 0 },
  { group_key: "vaccines", group_title: "Vacinas", name: "Vacina", copay_cents: 0, annual_limit: null, waiting_days: 0 },
  { group_key: "lab-simple", group_title: "Exames laboratoriais", name: "Exame laboratorial simples", copay_cents: 0, annual_limit: null, waiting_days: 45 },
  { group_key: "clinical", group_title: "Procedimentos clínicos", name: "Procedimento clínico", copay_cents: 0, annual_limit: null, waiting_days: 45 },
  { group_key: "services", group_title: "Serviços", name: "Outro serviço coberto", copay_cents: 0, annual_limit: null, waiting_days: 0 },
] as const;

export function buildGroupOptions(services: HealthPlanGuideService[]) {
  const map = new Map<string, string>();
  for (const group of DEFAULT_SERVICE_GROUPS) map.set(group.key, group.title);
  for (const service of services) map.set(service.group_key, service.group_title);
  return [...map.entries()]
    .map(([key, title]) => ({ key, title }))
    .sort((a, b) => {
      const ai = DEFAULT_SERVICE_GROUPS.findIndex((g) => g.key === a.key);
      const bi = DEFAULT_SERVICE_GROUPS.findIndex((g) => g.key === b.key);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.title.localeCompare(b.title, "pt-BR");
    });
}

export function resolveServiceGroup(
  groupKey: string,
  services: Pick<HealthPlanGuideService, "group_key" | "group_title">[],
) {
  const catalog = DEFAULT_SERVICE_GROUPS.find((g) => g.key === groupKey);
  if (catalog) return { key: catalog.key, title: catalog.title };
  const existing = services.find((s) => s.group_key === groupKey);
  if (existing) return { key: existing.group_key, title: existing.group_title };
  return { key: groupKey, title: groupKey };
}

export function parseGuideNoteLines(raw: string | null | undefined) {
  if (!raw?.trim()) return [];
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function slugify(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "plano";
}

export function groupServices(services: HealthPlanGuideService[]) {
  const groups = new Map<string, { key: string; title: string; items: HealthPlanGuideService[] }>();
  for (const service of services) {
    const bucket = groups.get(service.group_key) ?? { key: service.group_key, title: service.group_title, items: [] };
    bucket.items.push(service);
    groups.set(service.group_key, bucket);
  }
  return [...groups.values()];
}

export async function listHealthPlanGuides(supabase: SupabaseClient, householdId: string): Promise<HealthPlanGuide[]> {
  const { data, error } = await supabase
    .from("health_plan_guides")
    .select("*")
    .eq("household_id", householdId)
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HealthPlanGuide[];
}

export async function getHealthPlanGuide(
  supabase: SupabaseClient,
  householdId: string,
  guideId: string,
): Promise<HealthPlanGuideWithServices | null> {
  const { data: guide, error } = await supabase
    .from("health_plan_guides")
    .select("*")
    .eq("id", guideId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error) throw error;
  if (!guide) return null;

  const { data: services, error: servicesError } = await supabase
    .from("health_plan_guide_services")
    .select("*")
    .eq("guide_id", guideId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (servicesError) throw servicesError;

  return { ...(guide as HealthPlanGuide), services: (services ?? []) as HealthPlanGuideService[] };
}

export async function seedDefaultGuideServices(supabase: SupabaseClient, guideId: string) {
  const rows = DEFAULT_GUIDE_STARTER_SERVICES.map((service, index) => ({
    guide_id: guideId,
    group_key: service.group_key,
    group_title: service.group_title,
    name: service.name,
    copay_cents: service.copay_cents,
    annual_limit: service.annual_limit,
    waiting_days: service.waiting_days,
    notes: null,
    sort_order: index,
  }));
  const { error } = await supabase.from("health_plan_guide_services").insert(rows);
  if (error) throw error;
}

async function seedPetloveLeveServices(supabase: SupabaseClient, guideId: string) {
  let sortOrder = 0;
  const rows = PETLOVE_LEVE_PROCEDURE_GROUPS.flatMap((group) =>
    group.procedures.map((proc) => {
      const row = {
        guide_id: guideId,
        group_key: group.id,
        group_title: group.title,
        name: proc.name,
        copay_cents: proc.copayCents,
        annual_limit: proc.annualLimit,
        waiting_days: proc.waitingDays,
        notes: proc.notes ?? null,
        sort_order: sortOrder,
      };
      sortOrder += 1;
      return row;
    }),
  );
  const { error } = await supabase.from("health_plan_guide_services").insert(rows);
  if (error) throw error;
}

export async function ensurePetloveLeveGuide(supabase: SupabaseClient, householdId: string): Promise<HealthPlanGuideWithServices> {
  const { data: existing, error: existingError } = await supabase
    .from("health_plan_guides")
    .select("*")
    .eq("household_id", householdId)
    .eq("slug", PETLOVE_LEVE_SLUG)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const guide = await getHealthPlanGuide(supabase, householdId, existing.id);
    if (!guide) throw new Error("Guia Petlove não encontrado.");
    if (guide.services.length === 0) {
      await seedPetloveLeveServices(supabase, guide.id);
      return (await getHealthPlanGuide(supabase, householdId, guide.id))!;
    }
    return guide;
  }

  const { data: householdRow } = await supabase
    .from("households")
    .select("petlove_leve_base_fee_cents")
    .eq("id", householdId)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("health_plan_guides")
    .insert({
      household_id: householdId,
      slug: PETLOVE_LEVE_SLUG,
      title: "Serviços e coparticipação Petlove Leve",
      provider: "petlove",
      base_monthly_fee_cents: resolvePetloveLeveBaseFeeCents(householdRow?.petlove_leve_base_fee_cents),
      official_url: PETLOVE_LEVE_REFERENCE.officialUrl,
      notes: PETLOVE_LEVE_REFERENCE.regionNote,
      show_multi_pet_discount: true,
    })
    .select("*")
    .single();
  if (error) throw error;

  await seedPetloveLeveServices(supabase, created.id);
  return (await getHealthPlanGuide(supabase, householdId, created.id))!;
}

export async function ensureAllGuides(supabase: SupabaseClient, householdId: string) {
  await ensurePetloveLeveGuide(supabase, householdId);
  return listHealthPlanGuides(supabase, householdId);
}

export function buildUniqueSlug(title: string, taken: Set<string>) {
  const base = slugify(title);
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
