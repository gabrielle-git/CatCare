"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseWeightKg } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
import { parsePetIds } from "@/lib/pet-form";
import { numberValue, parseLocalDateTime, quickRecordTypes, redirectPathWithParam, resolveReturnTo, safeReturnPath, value, type RecordSource } from "@/lib/record-form";
import { createClient } from "@/lib/supabase/server";
import type { HealthRecordType, NeonatalRecordType } from "@/types/database";

function fail(recordId: string, source: RecordSource, kind: string, message: string, returnTo?: string | null): never {
  const params = new URLSearchParams({
    source,
    kind,
    error: message,
  });
  if (returnTo) params.set("return_to", returnTo);
  redirect(`/records/${recordId}/edit?${params.toString()}`);
}

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  // Role check and household bootstrap are independent — run in parallel.
  const [, household] = await Promise.all([
    assertCanEdit(supabase),
    ensureHousehold(supabase, data.user.id),
  ]);
  return { supabase, household, userId: data.user.id };
}

function revalidateRecordPaths(petId: string) {
  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath("/neonatal");
  revalidatePath(`/pets/${petId}`);
}

function redirectWithDeleted(returnTo: string, count = 1) {
  redirect(redirectPathWithParam(returnTo, "deleted", String(count)));
}

type RecordRef = { id: string; source: RecordSource; petId: string };

function tableForSource(source: RecordSource) {
  if (source === "weight") return "weight_records";
  if (source === "neonatal") return "neonatal_records";
  return "health_records";
}

export async function updateRecord(recordId: string, source: RecordSource, formData: FormData) {
  const petIds = parsePetIds(formData);
  const petId = petIds[0];
  const type = value(formData, "record_type");
  const returnTo = resolveReturnTo(value(formData, "return_to"));
  const failHere = (message: string): never => fail(recordId, source, type || "observation", message, returnTo);

  if (!petId || !quickRecordTypes.has(type)) failHere("Escolha o pet e confira o registro.");

  const occurredAt = parseLocalDateTime(value(formData, "occurred_at"));
  if (!occurredAt) failHere("Informe uma data e hora válidas.");

  const { supabase, household } = await authContext();
  const { data: pet } = await supabase.from("pets").select("id").eq("id", petId).eq("household_id", household.id).is("archived_at", null).maybeSingle();
  if (!pet) failHere("Pet não encontrado.");

  const notes = value(formData, "notes") || null;

  if (source === "weight") {
    const grams = parseWeightKg(value(formData, "weight_kg"));
    if (grams == null) failHere("Informe um peso válido em kg (ex.: 4,2).");
    const { error } = await supabase.from("weight_records").update({ pet_id: petId, weight_grams: grams, measured_at: occurredAt, notes }).eq("id", recordId).eq("household_id", household.id);
    if (error) failHere(error.message);
  } else if (source === "neonatal") {
    const neonatalType = type as NeonatalRecordType;
    const amount = numberValue(formData, "amount_ml");
    const temperature = numberValue(formData, "temperature_c");
    if (type === "feeding" && (amount == null || amount <= 0 || amount > 1000)) failHere("Informe a quantidade da mamada.");
    if (type === "temperature" && (temperature == null || temperature < 30 || temperature > 45)) failHere("Informe uma temperatura válida.");
    const { error } = await supabase.from("neonatal_records").update({
      pet_id: petId, type: neonatalType, occurred_at: occurredAt, amount_ml: amount, temperature_c: temperature,
      quality: value(formData, "quality") || null, notes,
    }).eq("id", recordId).eq("household_id", household.id);
    if (error) failHere(error.message);
  } else {
    const healthType: HealthRecordType = type === "vaccine" || type === "deworming" || type === "medication" || type === "consultation" ? type : "other";
    const defaults: Record<HealthRecordType, string> = { vaccine: "Vacina", deworming: "Vermífugo", medication: "Medicamento", consultation: "Consulta veterinária", other: "Observação", exam: "Exame", disease: "Diagnóstico", allergy: "Alergia", surgery: "Cirurgia" };
    const title = value(formData, "title") || defaults[healthType];
    const { error } = await supabase.from("health_records").update({
      pet_id: petId, type: healthType, title, occurred_at: occurredAt,
      clinic_or_vet: value(formData, "clinic_or_vet") || null, notes, updated_at: new Date().toISOString(),
    }).eq("id", recordId).eq("household_id", household.id);
    if (error) failHere(error.message);
  }

  revalidateRecordPaths(petId);
  const destination = safeReturnPath(returnTo, `/pets/${petId}`);
  redirect(redirectPathWithParam(destination, "updated", "1"));
}

export async function deleteRecord(recordId: string, source: RecordSource, petId: string, formData: FormData) {
  if (!petId) redirect("/pets");
  const returnTo = safeReturnPath(value(formData, "return_to"), `/pets/${petId}`);
  const { supabase, household } = await authContext();
  const table = tableForSource(source);
  const { data, error } = await supabase.from(table).delete().eq("id", recordId).eq("household_id", household.id).select("id");
  if (error) redirect(redirectPathWithParam(returnTo, "error", error.message));
  if (!data?.length) redirect(redirectPathWithParam(returnTo, "error", "Registro não encontrado ou sem permissão para apagar."));

  revalidateRecordPaths(petId);
  redirectWithDeleted(returnTo, 1);
}

export async function deleteRecords(formData: FormData) {
  const returnTo = safeReturnPath(value(formData, "return_to"), "/pets");
  const raw = value(formData, "records");
  let records: RecordRef[] = [];
  try {
    const parsed = JSON.parse(raw) as RecordRef[];
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
    records = parsed.filter((row) => row?.id && row?.source && row?.petId);
  } catch {
    redirect(redirectPathWithParam(returnTo, "error", "Seleção inválida."));
  }

  const { supabase, household } = await authContext();
  const petIds = new Set<string>();
  let deleted = 0;

  for (const record of records) {
    const table = tableForSource(record.source);
    const { data, error } = await supabase.from(table).delete().eq("id", record.id).eq("household_id", household.id).select("id");
    if (error) redirect(redirectPathWithParam(returnTo, "error", error.message));
    if (data?.length) {
      deleted += data.length;
      petIds.add(record.petId);
    }
  }

  if (deleted === 0) redirect(redirectPathWithParam(returnTo, "error", "Nenhum registro foi apagado."));

  for (const petId of petIds) revalidateRecordPaths(petId);
  redirectWithDeleted(returnTo, deleted);
}
