"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseWeightKg } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { parsePetIds } from "@/lib/pet-form";
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

function fail(petIds: string[], type: string, message: string): never {
  const pet = petIds[0] ?? "";
  redirect(`/records/new?pet=${encodeURIComponent(pet)}&type=${encodeURIComponent(type)}&error=${encodeURIComponent(message)}`);
}

function revalidateRecordPaths(petIds: string[]) {
  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath("/neonatal");
  for (const petId of petIds) revalidatePath(`/pets/${petId}`);
}

export async function createRecord(formData: FormData) {
  const petIds = parsePetIds(formData);
  const type = value(formData, "record_type");
  if (petIds.length === 0 || !recordTypes.has(type)) fail(petIds, type, "Escolha ao menos um gatinho e o tipo de cuidado.");

  const offset = numberValue(formData, "timezone_offset_minutes") ?? 0;
  const occurredAt = parseLocalDateTime(value(formData, "occurred_at"), offset);
  if (!occurredAt) fail(petIds, type, "Informe uma data e hora válidas.");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const household = await ensureHousehold(supabase, auth.user.id);
  const { data: pets } = await supabase.from("pets").select("id, name").eq("household_id", household.id).in("id", petIds).is("archived_at", null);
  if (!pets?.length || pets.length !== petIds.length) fail(petIds, type, "Gatinho não encontrado.");

  const notes = value(formData, "notes") || null;
  const reminderRaw = value(formData, "reminder_due_at");
  const reminderAt = reminderRaw ? parseLocalDateTime(reminderRaw, offset) : null;
  const reminderTitles: Record<string, string> = { vaccine: "Próxima vacina de", medication: "Medicamento de", consultation: "Retorno de" };

  if (type === "weight") {
    const grams = parseWeightKg(value(formData, "weight_kg"));
    if (grams == null) fail(petIds, type, "Informe um peso válido em kg (ex.: 4,2).");
    for (const pet of pets) {
      const { error } = await supabase.from("weight_records").insert({ household_id: household.id, pet_id: pet.id, weight_grams: grams, measured_at: occurredAt, notes });
      if (error) fail(petIds, type, error.message);
      await supabase.from("pets").update({ current_weight_grams: grams, updated_at: new Date().toISOString() }).eq("id", pet.id).eq("household_id", household.id);
    }
  } else if (["feeding", "urine", "stool", "temperature"].includes(type)) {
    const neonatalType = type as NeonatalRecordType;
    const amount = numberValue(formData, "amount_ml");
    const temperature = numberValue(formData, "temperature_c");
    if (type === "feeding" && (amount == null || amount <= 0 || amount > 1000)) fail(petIds, type, "Informe a quantidade da mamada.");
    if (type === "temperature" && (temperature == null || temperature < 30 || temperature > 45)) fail(petIds, type, "Informe uma temperatura válida.");
    for (const pet of pets) {
      const { error } = await supabase.from("neonatal_records").insert({
        household_id: household.id, pet_id: pet.id, type: neonatalType, occurred_at: occurredAt,
        amount_ml: amount, temperature_c: temperature, quality: value(formData, "quality") || null, notes,
      });
      if (error) fail(petIds, type, error.message);
    }
  } else {
    const healthType: HealthRecordType = type === "vaccine" || type === "medication" || type === "consultation" ? type : "other";
    const defaults: Record<HealthRecordType, string> = { vaccine: "Vacina", medication: "Medicamento", consultation: "Consulta veterinária", other: "Observação", exam: "Exame", disease: "Diagnóstico", allergy: "Alergia", surgery: "Cirurgia" };
    const title = value(formData, "title") || defaults[healthType];
    const clinicOrVet = value(formData, "clinic_or_vet") || null;
    for (const pet of pets) {
      const { data, error } = await supabase.from("health_records").insert({
        household_id: household.id, pet_id: pet.id, type: healthType, title, occurred_at: occurredAt, clinic_or_vet: clinicOrVet, notes,
      }).select("id").single();
      if (error) fail(petIds, type, error.message);
      if (reminderAt) {
        const prefix = reminderTitles[type] ?? "Cuidado de";
        await supabase.from("reminders").insert({
          household_id: household.id, pet_id: pet.id, health_record_id: data.id,
          title: `${prefix} ${pet.name}`, category: type, due_at: reminderAt,
        });
      }
    }
  }

  revalidateRecordPaths(pets.map((pet) => pet.id));
  if (pets.length === 1) redirect(`/pets/${pets[0].id}?saved=1`);
  redirect(`/?saved=${pets.length}`);
}
