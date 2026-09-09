import type { SupabaseClient } from "@supabase/supabase-js";
import type { WeightChartPoint } from "@/components/weight-chart";
import { formatWeight } from "@/lib/format";
import type { RecordSource } from "@/types/database";
import { recordKindFromHealth, recordKindFromNeonatal } from "@/lib/record-form";
import { hygieneDisplayLabel } from "@/lib/hygiene-care";
import {
  feedingItemsFromRows,
  feedingSessionTimelineTitle,
  formatFeedingSessionDetail,
} from "@/lib/feeding-care";
import { getFeedingDisplay } from "@/lib/neonatal-feeding";
import { formatVaccineRecordTitle, isProtocolVaccineKey, vaccineDisplayName } from "@/lib/vaccine-schedule";
import type {
  FeedingItem,
  FeedingSession,
  FeedingSessionWithItems,
  HealthRecord,
  NeonatalRecord,
  Reminder,
  TimelineItem,
  TimelineTone,
  WeightRecord,
} from "@/types/database";

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
  hygiene: "Cuidados de higiene",
};

const neonatalLabels: Record<NeonatalRecord["type"], string> = {
  feeding: "Alimentação",
  weight: "Pesagem neonatal",
  urine: "Fez xixi",
  stool: "Fez cocô",
  temperature: "Temperatura",
  observation: "Nota",
};

function toneForHealth(type: HealthRecord["type"]): TimelineTone {
  if (type === "vaccine" || type === "deworming" || type === "medication" || type === "hygiene") return "mint";
  if (type === "consultation" || type === "exam") return "lavender";
  return "peach";
}

function mapWeight(row: WeightRecord): TimelineItem {
  return { id: row.id, pet_id: row.pet_id, source: "weight", kind: "weight", title: "Pesagem", detail: [formatWeight(row.weight_grams), row.notes].filter(Boolean).join(" • "), occurred_at: row.measured_at, tone: "lavender" };
}

function mapHealth(row: HealthRecord): TimelineItem {
  if (row.type === "hygiene") {
    const title =
      hygieneDisplayLabel(row.hygiene_subtype, row.hygiene_custom_label) ||
      row.title ||
      healthLabels.hygiene;
    return {
      id: row.id,
      pet_id: row.pet_id,
      source: "health",
      kind: "hygiene",
      title,
      detail: row.notes || null,
      occurred_at: row.occurred_at,
      tone: toneForHealth("hygiene"),
    };
  }
  return {
    id: row.id,
    pet_id: row.pet_id,
    source: "health",
    kind: recordKindFromHealth(row.type),
    title: row.title || healthLabels[row.type],
    detail: [row.clinic_or_vet, row.notes].filter(Boolean).join(" • ") || null,
    occurred_at: row.occurred_at,
    tone: toneForHealth(row.type),
  };
}

function mapNeonatal(row: NeonatalRecord): TimelineItem {
  if (row.type === "feeding") {
    const display = getFeedingDisplay(row);
    return {
      id: row.id,
      pet_id: row.pet_id,
      source: "neonatal",
      kind: recordKindFromNeonatal(row.type),
      title: display.title,
      detail: display.detailParts.join(" • ") || null,
      occurred_at: row.occurred_at,
      tone: "rose",
    };
  }
  const metric = row.type === "temperature" && row.temperature_c != null
    ? `${row.temperature_c.toLocaleString("pt-BR")} °C`
    : row.weight_grams != null
      ? formatWeight(row.weight_grams)
      : row.quality;
  return { id: row.id, pet_id: row.pet_id, source: "neonatal", kind: recordKindFromNeonatal(row.type), title: neonatalLabels[row.type], detail: [metric, row.notes].filter(Boolean).join(" • ") || null, occurred_at: row.occurred_at, tone: "peach" };
}

function mapFeedingSession(session: FeedingSession, items: FeedingItem[]): TimelineItem {
  const detailParts = [
    formatFeedingSessionDetail(feedingItemsFromRows(items)),
    session.quality?.trim() || null,
    session.notes?.trim() || null,
  ].filter((part): part is string => Boolean(part));
  return {
    id: session.id,
    pet_id: session.pet_id,
    source: "feeding",
    kind: "feeding",
    title: feedingSessionTimelineTitle(),
    detail: detailParts.join(" • ") || null,
    occurred_at: session.occurred_at,
    tone: "rose",
  };
}

async function loadFeedingSessionsForTimeline(
  supabase: SupabaseClient,
  field: "pet_id" | "household_id",
  value: string,
  limit: number,
): Promise<FeedingSessionWithItems[]> {
  let sessionsQuery = supabase
    .from("feeding_sessions")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (field === "pet_id") {
    sessionsQuery = sessionsQuery.eq("pet_id", value);
  } else {
    const { data: pets, error: petsError } = await supabase
      .from("pets")
      .select("id")
      .eq("household_id", value)
      .is("archived_at", null);
    if (petsError) throw petsError;
    const petIds = (pets ?? []).map((pet) => pet.id as string);
    if (petIds.length === 0) return [];
    sessionsQuery = sessionsQuery.in("pet_id", petIds);
  }

  const { data: sessions, error } = await sessionsQuery;
  if (error) throw error;
  const sessionRows = (sessions ?? []) as FeedingSession[];
  if (sessionRows.length === 0) return [];

  const sessionIds = sessionRows.map((row) => row.id);
  const { data: items, error: itemsError } = await supabase
    .from("feeding_items")
    .select("*")
    .in("session_id", sessionIds);
  if (itemsError) throw itemsError;

  const itemsBySession = new Map<string, FeedingItem[]>();
  for (const item of (items ?? []) as FeedingItem[]) {
    const list = itemsBySession.get(item.session_id) ?? [];
    list.push(item);
    itemsBySession.set(item.session_id, list);
  }

  return sessionRows.map((session) => ({
    ...session,
    feeding_items: itemsBySession.get(session.id) ?? [],
  }));
}

async function loadTimeline(supabase: SupabaseClient, field: "pet_id" | "household_id", value: string, limit: number) {
  const [weights, health, neonatal, feedingSessions] = await Promise.all([
    supabase.from("weight_records").select("*").eq(field, value).order("measured_at", { ascending: false }).limit(limit),
    supabase.from("health_records").select("*").eq(field, value).order("occurred_at", { ascending: false }).limit(limit),
    supabase.from("neonatal_records").select("*").eq(field, value).order("occurred_at", { ascending: false }).limit(limit),
    loadFeedingSessionsForTimeline(supabase, field, value, limit),
  ]);

  if (weights.error) throw weights.error;
  if (health.error) throw health.error;
  if (neonatal.error) throw neonatal.error;

  return [
    ...((weights.data ?? []) as WeightRecord[]).map(mapWeight),
    ...((health.data ?? []) as HealthRecord[]).map(mapHealth),
    ...((neonatal.data ?? []) as NeonatalRecord[]).map(mapNeonatal),
    ...feedingSessions.map((session) => mapFeedingSession(session, session.feeding_items)),
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
  const [structured, legacy] = await Promise.all([
    supabase
      .from("vaccine_doses")
      .select("id, vaccine_name, dose_label, administered_at, health_record_id")
      .eq("pet_id", petId)
      .order("administered_at", { ascending: true }),
    supabase
      .from("health_records")
      .select("id, title, occurred_at")
      .eq("pet_id", petId)
      .eq("type", "vaccine")
      .order("occurred_at", { ascending: true }),
  ]);
  if (structured.error) throw structured.error;
  if (legacy.error) throw legacy.error;

  const fromStructured = (structured.data ?? [])
    .filter((row) => Boolean(row.health_record_id))
    .map((row) => {
    const key = row.vaccine_name as string;
    const doseLabel = (row.dose_label as string | null) ?? null;
    const title = doseLabel
      ? formatVaccineRecordTitle(key, doseLabel)
      : vaccineDisplayName(key);
    return {
      vaccineTitle: title,
      occurredAt: row.administered_at as string,
      vaccineKey: isProtocolVaccineKey(key) ? key : null,
      doseLabel,
    };
  });

  const linkedHealthIds = new Set(
    (structured.data ?? [])
      .map((row) => row.health_record_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );

  const fromLegacy = (legacy.data ?? [])
    .filter((row) => !linkedHealthIds.has(row.id as string))
    .map((row) => ({
      vaccineTitle: row.title as string,
      occurredAt: row.occurred_at as string,
      vaccineKey: null as string | null,
      doseLabel: null as string | null,
    }));

  return [...fromStructured, ...fromLegacy];
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

/** One round-trip for all vaccine + deworming doses in a household (Home alerts). */
export async function listHouseholdPreventiveDoses(supabase: SupabaseClient, householdId: string) {
  const [health, structured] = await Promise.all([
    supabase
      .from("health_records")
      .select("id, pet_id, type, title, occurred_at")
      .eq("household_id", householdId)
      .in("type", ["vaccine", "deworming"])
      .order("occurred_at", { ascending: true }),
    supabase
      .from("vaccine_doses")
      .select("pet_id, vaccine_name, dose_label, administered_at, health_record_id")
      .eq("household_id", householdId)
      .order("administered_at", { ascending: true }),
  ]);
  if (health.error) throw health.error;
  if (structured.error) throw structured.error;

  const vaccinesByPet = new Map<string, { vaccineTitle: string; occurredAt: string; vaccineKey: string | null; doseLabel: string | null }[]>();
  const dewormingByPet = new Map<string, { title: string; occurredAt: string }[]>();
  const linkedHealthIds = new Set(
    (structured.data ?? [])
      .map((row) => row.health_record_id as string | null)
      .filter((id): id is string => Boolean(id)),
  );

  for (const row of structured.data ?? []) {
    if (!row.health_record_id) continue;
    const petId = row.pet_id as string;
    const key = row.vaccine_name as string;
    const doseLabel = (row.dose_label as string | null) ?? null;
    const list = vaccinesByPet.get(petId) ?? [];
    list.push({
      vaccineTitle: doseLabel ? formatVaccineRecordTitle(key, doseLabel) : vaccineDisplayName(key),
      occurredAt: row.administered_at as string,
      vaccineKey: isProtocolVaccineKey(key) ? key : null,
      doseLabel,
    });
    vaccinesByPet.set(petId, list);
  }

  for (const row of health.data ?? []) {
    const petId = row.pet_id as string;
    const occurredAt = row.occurred_at as string;
    const title = row.title as string;
    if (row.type === "vaccine") {
      if (linkedHealthIds.has(row.id as string)) continue;
      const list = vaccinesByPet.get(petId) ?? [];
      list.push({ vaccineTitle: title, occurredAt, vaccineKey: null, doseLabel: null });
      vaccinesByPet.set(petId, list);
    } else if (row.type === "deworming") {
      const list = dewormingByPet.get(petId) ?? [];
      list.push({ title, occurredAt });
      dewormingByPet.set(petId, list);
    }
  }

  // Deworming schedule expects newest-first (matches listPetDewormingDoses).
  for (const [petId, list] of dewormingByPet) {
    dewormingByPet.set(petId, [...list].reverse());
  }

  return { vaccinesByPet, dewormingByPet };
}

export function listHouseholdTimeline(supabase: SupabaseClient, householdId: string, limit = 12) {
  return loadTimeline(supabase, "household_id", householdId, limit);
}

export async function listHouseholdNeonatalRecords(supabase: SupabaseClient, householdId: string, limit = 500) {
  const { data, error } = await supabase
    .from("neonatal_records")
    .select("*")
    .eq("household_id", householdId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NeonatalRecord[];
}

export async function listPetNeonatalRecords(supabase: SupabaseClient, petId: string, limit = 200) {
  const { data, error } = await supabase
    .from("neonatal_records")
    .select("*")
    .eq("pet_id", petId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NeonatalRecord[];
}

export async function listHouseholdFeedingSessions(
  supabase: SupabaseClient,
  householdId: string,
  limit = 500,
): Promise<FeedingSessionWithItems[]> {
  return loadFeedingSessionsForTimeline(supabase, "household_id", householdId, limit);
}

export async function listPetFeedingSessions(
  supabase: SupabaseClient,
  petId: string,
  limit = 200,
): Promise<FeedingSessionWithItems[]> {
  return loadFeedingSessionsForTimeline(supabase, "pet_id", petId, limit);
}

export async function getFeedingSession(
  supabase: SupabaseClient,
  householdId: string,
  id: string,
): Promise<FeedingSessionWithItems | null> {
  const { data: session, error } = await supabase
    .from("feeding_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .select("id, household_id")
    .eq("id", (session as FeedingSession).pet_id)
    .eq("household_id", householdId)
    .maybeSingle();
  if (petError) throw petError;
  if (!pet) return null;

  const { data: items, error: itemsError } = await supabase
    .from("feeding_items")
    .select("*")
    .eq("session_id", id);
  if (itemsError) throw itemsError;

  return {
    ...(session as FeedingSession),
    feeding_items: (items ?? []) as FeedingItem[],
  };
}

/**
 * Legacy neonatal archive only — neonatal_records.
 * Canonical feeding_sessions are general meals (adult or baby) and must NOT appear here.
 */
export async function listPetNeonatalTimeline(supabase: SupabaseClient, petId: string, limit = 200) {
  const records = await listPetNeonatalRecords(supabase, petId, limit);
  return records.map(mapNeonatal);
}

/** True only for legacy neonatal_records timeline rows — not feeding_sessions. */
export function isNeonatalTimelineItem(item: TimelineItem) {
  return item.source === "neonatal";
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
  hygiene_subtype?: string | null;
  hygiene_custom_label?: string | null;
  weight_grams?: number;
  amount_ml?: number | null;
  feeding_subtype?: string | null;
  feeding_amount_value?: number | null;
  feeding_amount_unit?: string | null;
  feeding_items?: FeedingItem[];
  temperature_c?: number | null;
  quality?: string | null;
  vaccine_key?: string | null;
  dose_label?: string | null;
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
    let vaccineKey: string | null = null;
    let doseLabel: string | null = null;
    if (row.type === "vaccine") {
      const { data: linked } = await supabase
        .from("vaccine_doses")
        .select("vaccine_name, dose_label")
        .eq("household_id", householdId)
        .eq("health_record_id", row.id)
        .maybeSingle();
      if (linked) {
        vaccineKey = (linked.vaccine_name as string) ?? null;
        doseLabel = (linked.dose_label as string | null) ?? null;
      }
    }
    return {
      source,
      id: row.id,
      pet_id: row.pet_id,
      kind: recordKindFromHealth(row.type),
      occurred_at: row.occurred_at,
      notes: row.notes,
      title: row.title,
      clinic_or_vet: row.clinic_or_vet,
      hygiene_subtype: row.hygiene_subtype,
      hygiene_custom_label: row.hygiene_custom_label,
      vaccine_key: vaccineKey,
      dose_label: doseLabel,
    };
  }
  if (source === "feeding") {
    const row = await getFeedingSession(supabase, householdId, id);
    if (!row) return null;
    return {
      source,
      id: row.id,
      pet_id: row.pet_id,
      kind: "feeding",
      occurred_at: row.occurred_at,
      notes: row.notes,
      quality: row.quality,
      feeding_items: row.feeding_items,
    };
  }
  const row = await getNeonatalRecord(supabase, householdId, id);
  if (!row) return null;
  return { source, id: row.id, pet_id: row.pet_id, kind: recordKindFromNeonatal(row.type), occurred_at: row.occurred_at, notes: row.notes, amount_ml: row.amount_ml, feeding_subtype: row.feeding_subtype, feeding_amount_value: row.feeding_amount_value, feeding_amount_unit: row.feeding_amount_unit, temperature_c: row.temperature_c, quality: row.quality, weight_grams: row.weight_grams ?? undefined };
}
