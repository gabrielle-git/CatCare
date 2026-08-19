import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeightChartPoint } from "@/components/weight-chart";
import { formatWeight } from "@/lib/format";
import type { RecordSource } from "@/types/database";
import { recordKindFromHealth, recordKindFromNeonatal } from "@/lib/record-form";
import type { HealthRecord, NeonatalRecord, Reminder, TimelineItem, TimelineTone, WeightRecord } from "@/types/database";

const healthLabels: Record<HealthRecord["type"], string> = {
  vaccine: "Vacina",
  deworming: "Vermífugo",
  consultation: "Consulta veterinária",
  exam: "Exame",
  medication: "Medicamento",
  disease: "Diagnóstico",
  allergy: "Alergia",
  surgery: "Cirurgia",
  other: "Observação",
};

const neonatalLabels: Record<NeonatalRecord["type"], string> = {
  feeding: "Mamada",
  weight: "Pesagem neonatal",
  urine: "Fez xixi",
  stool: "Fez cocô",
  temperature: "Temperatura",
  observation: "Observação neonatal",
};

function toneForHealth(type: HealthRecord["type"]): TimelineTone {
  if (type === "vaccine" || type === "deworming" || type === "medication") return "mint";
  if (type === "consultation" || type === "exam") return "lavender";
  return "peach";
}

function mapWeight(row: WeightRecord): TimelineItem {
  return { id: row.id, pet_id: row.pet_id, source: "weight", kind: "weight", title: "Pesagem", detail: [formatWeight(row.weight_grams), row.notes].filter(Boolean).join(" • "), occurred_at: row.measured_at, tone: "lavender" };
}

function mapHealth(row: HealthRecord): TimelineItem {
  return { id: row.id, pet_id: row.pet_id, source: "health", kind: recordKindFromHealth(row.type), title: row.title || healthLabels[row.type], detail: [row.clinic_or_vet, row.notes].filter(Boolean).join(" • ") || null, occurred_at: row.occurred_at, tone: toneForHealth(row.type) };
}

function mapNeonatal(row: NeonatalRecord): TimelineItem {
  const metric = row.type === "feeding" && row.amount_ml != null
    ? `${row.amount_ml} ml`
    : row.type === "temperature" && row.temperature_c != null
      ? `${row.temperature_c.toLocaleString("pt-BR")} °C`
      : row.weight_grams != null
        ? formatWeight(row.weight_grams)
        : row.quality;
  return { id: row.id, pet_id: row.pet_id, source: "neonatal", kind: recordKindFromNeonatal(row.type), title: neonatalLabels[row.type], detail: [metric, row.notes].filter(Boolean).join(" • ") || null, occurred_at: row.occurred_at, tone: row.type === "feeding" ? "rose" : "peach" };
}

async function loadTimeline(supabase: SupabaseClient, field: "pet_id" | "household_id", value: string, limit: number) {
  const [weights, health, neonatal] = await Promise.all([
    supabase.from("weight_records").select("*").eq(field, value).order("measured_at", { ascending: false }).limit(limit),
    supabase.from("health_records").select("*").eq(field, value).order("occurred_at", { ascending: false }).limit(limit),
    supabase.from("neonatal_records").select("*").eq(field, value).order("occurred_at", { ascending: false }).limit(limit),
  ]);

  if (weights.error) throw weights.error;
  if (health.error) throw health.error;
  if (neonatal.error) throw neonatal.error;

  return [
    ...((weights.data ?? []) as WeightRecord[]).map(mapWeight),
    ...((health.data ?? []) as HealthRecord[]).map(mapHealth),
    ...((neonatal.data ?? []) as NeonatalRecord[]).map(mapNeonatal),
  ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()).slice(0, limit);
}

export function listPetTimeline(supabase: SupabaseClient, petId: string, limit = 100) {
  return loadTimeline(supabase, "pet_id", petId, limit);
}

export async function listPetWeights(supabase: SupabaseClient, petId: string, limit = 60): Promise<WeightChartPoint[]> {
  const { data, error } = await supabase
    .from("weight_records")
    .select("weight_grams, measured_at")
    .eq("pet_id", petId)
    .order("measured_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({ date: row.measured_at as string, grams: row.weight_grams as number }));
}

export async function listPetVaccineDoses(supabase: SupabaseClient, petId: string) {
  const { data, error } = await supabase
    .from("health_records")
    .select("title, occurred_at")
    .eq("pet_id", petId)
    .eq("type", "vaccine")
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ vaccineTitle: row.title as string, occurredAt: row.occurred_at as string }));
}

export async function listPetDewormingDoses(supabase: SupabaseClient, petId: string) {
  const { data, error } = await supabase
    .from("health_records")
    .select("title, occurred_at")
    .eq("pet_id", petId)
    .eq("type", "deworming")
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ title: row.title as string, occurredAt: row.occurred_at as string }));
}

export function listHouseholdTimeline(supabase: SupabaseClient, householdId: string, limit = 12) {
  return loadTimeline(supabase, "household_id", householdId, limit);
}

export async function listUpcomingReminders(supabase: SupabaseClient, householdId: string, limit = 8): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("household_id", householdId)
    .eq("status", "pending")
    .order("due_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Reminder[];
}

export async function getWeightRecord(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("weight_records").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  return data as WeightRecord | null;
}

export async function getHealthRecord(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("health_records").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  return data as HealthRecord | null;
}

export async function getNeonatalRecord(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("neonatal_records").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  return data as NeonatalRecord | null;
}

export type EditableRecord = {
  source: RecordSource;
  id: string;
  pet_id: string;
  kind: TimelineItem["kind"];
  occurred_at: string;
  notes: string | null;
  title?: string;
  clinic_or_vet?: string | null;
  weight_grams?: number;
  amount_ml?: number | null;
  temperature_c?: number | null;
  quality?: string | null;
};

export async function getEditableRecord(supabase: SupabaseClient, householdId: string, id: string, source: RecordSource): Promise<EditableRecord | null> {
  if (source === "weight") {
    const row = await getWeightRecord(supabase, householdId, id);
    if (!row) return null;
    return { source, id: row.id, pet_id: row.pet_id, kind: "weight", occurred_at: row.measured_at, notes: row.notes, weight_grams: row.weight_grams };
  }
  if (source === "health") {
    const row = await getHealthRecord(supabase, householdId, id);
    if (!row) return null;
    return { source, id: row.id, pet_id: row.pet_id, kind: recordKindFromHealth(row.type), occurred_at: row.occurred_at, notes: row.notes, title: row.title, clinic_or_vet: row.clinic_or_vet };
  }
  const row = await getNeonatalRecord(supabase, householdId, id);
  if (!row) return null;
  return { source, id: row.id, pet_id: row.pet_id, kind: recordKindFromNeonatal(row.type), occurred_at: row.occurred_at, notes: row.notes, amount_ml: row.amount_ml, temperature_c: row.temperature_c, quality: row.quality, weight_grams: row.weight_grams ?? undefined };
}
