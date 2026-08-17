"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureHousehold } from "@/lib/households";
import { createClient } from "@/lib/supabase/server";
import type { HealthRecordType, NeonatalRecordType } from "@/types/database";

const recordTypes = new Set(["weight", "feeding", "urine", "stool", "temperature", "vaccine", "medication", "consultation", "observation"]);

function value(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim(); }
function numberValue(formData: FormData, name: string) { const parsed = Number(value(formData, name).replace(",", ".")); return Number.isFinite(parsed) ? parsed : null; }

function parseLocalDateTime(raw: string, offsetMinutes: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) + offsetMinutes * 60_000).toISOString();
}

function fail(petId: string, type: string, message: string): never {
  redirect(`/records/new?pet=${encodeURIComponent(petId)}&type=${encodeURIComponent(type)}&error=${encodeURIComponent(message)}`);
}

export async function createRecord(formData: FormData) {
  const petId = value(formData, "pet_id");
  const type = value(formData, "record_type");
  if (!petId || !recordTypes.has(type)) fail(petId, type, "Escolha o gatinho e o tipo de cuidado.");

  const offset = numberValue(formData, "timezone_offset_minutes") ?? 0;
  const occurredAt = parseLocalDateTime(value(formData, "occurred_at"), offset);
  if (!occurredAt) fail(petId, type, "Informe uma data e hora válidas.");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const household = await ensureHousehold(supabase, auth.user.id);
  const { data: pet } = await supabase.from("pets").select("id, name").eq("id", petId).eq("household_id", household.id).is("archived_at", null).maybeSingle();
  if (!pet) fail(petId, type, "Gatinho não encontrado.");

  const notes = value(formData, "notes") || null;
  let healthRecordId: string | null = null;

  if (type === "weight") {
    const grams = numberValue(formData, "weight_grams");
    if (grams == null || grams <= 0 || grams > 100000) fail(petId, type, "Informe um peso válido em gramas.");
    const rounded = Math.round(grams);
    const { error } = await supabase.from("weight_records").insert({ household_id: household.id, pet_id: petId, weight_grams: rounded, measured_at: occurredAt, notes });
    if (error) fail(petId, type, error.message);
    await supabase.from("pets").update({ current_weight_grams: rounded, updated_at: new Date().toISOString() }).eq("id", petId).eq("household_id", household.id);
  } else if (["feeding", "urine", "stool", "temperature"].includes(type)) {
    const neonatalType = type as NeonatalRecordType;
    const amount = numberValue(formData, "amount_ml");
    const temperature = numberValue(formData, "temperature_c");
    if (type === "feeding" && (amount == null || amount <= 0 || amount > 1000)) fail(petId, type, "Informe a quantidade da mamada.");
    if (type === "temperature" && (temperature == null || temperature < 30 || temperature > 45)) fail(petId, type, "Informe uma temperatura válida.");
    const { error } = await supabase.from("neonatal_records").insert({ household_id: household.id, pet_id: petId, type: neonatalType, occurred_at: occurredAt, amount_ml: amount, temperature_c: temperature, quality: value(formData, "quality") || null, notes });
    if (error) fail(petId, type, error.message);
  } else {
    const healthType: HealthRecordType = type === "vaccine" || type === "medication" || type === "consultation" ? type : "other";
    const defaults: Record<HealthRecordType, string> = { vaccine: "Vacina", medication: "Medicamento", consultation: "Consulta veterinária", other: "Observação", exam: "Exame", disease: "Diagnóstico", allergy: "Alergia", surgery: "Cirurgia" };
    const title = value(formData, "title") || defaults[healthType];
    const { data, error } = await supabase.from("health_records").insert({ household_id: household.id, pet_id: petId, type: healthType, title, occurred_at: occurredAt, clinic_or_vet: value(formData, "clinic_or_vet") || null, notes }).select("id").single();
    if (error) fail(petId, type, error.message);
    healthRecordId = data.id;
  }

  const reminderRaw = value(formData, "reminder_due_at");
  const reminderAt = reminderRaw ? parseLocalDateTime(reminderRaw, offset) : null;
  if (reminderAt) {
    const titles: Record<string, string> = { vaccine: `Próxima vacina de ${pet.name}`, medication: `Medicamento de ${pet.name}`, consultation: `Retorno de ${pet.name}` };
    await supabase.from("reminders").insert({ household_id: household.id, pet_id: petId, health_record_id: healthRecordId, title: titles[type] ?? `Cuidado de ${pet.name}`, category: type, due_at: reminderAt });
  }

  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath(`/pets/${petId}`);
  redirect(`/pets/${petId}?saved=1`);
}
