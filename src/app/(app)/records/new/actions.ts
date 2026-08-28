"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseWeightKg, isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { parsePetIds } from "@/lib/pet-form";
import { assertCanEdit } from "@/lib/roles";
import {
  isNeonatalCareType,
  numberValue,
  parseLocalDateTime,
  parseRecordTypes,
  redirectPathWithParam,
  safeReturnPath,
  value,
} from "@/lib/record-form";
import { createClient } from "@/lib/supabase/server";
import type { HealthRecordType, NeonatalRecordType } from "@/types/database";

function fail(petIds: string[], type: string, message: string, returnTo?: string, neonatalContext?: boolean): never {
  const params = new URLSearchParams();
  const pet = petIds[0] ?? "";
  if (pet) params.set("pet", pet);
  if (type) params.set("type", type);
  params.set("error", message);
  if (returnTo) params.set("return_to", returnTo);
  if (neonatalContext) params.set("context", "neonatal");
  redirect(`/records/new?${params.toString()}`);
}

function redirectAfterSave(returnTo: string | null, petIds: string[], count: number) {
  const saved = String(count);
  if (returnTo) {
    redirect(redirectPathWithParam(returnTo, "saved", saved));
  }
  if (petIds.length === 1) redirect(`/pets/${petIds[0]}?saved=1`);
  redirect(redirectPathWithParam("/", "saved", saved));
}

function revalidateRecordPaths(petIds: string[]) {
  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath("/neonatal");
  for (const petId of petIds) revalidatePath(`/pets/${petId}`);
}

function qualityForType(formData: FormData, type: string, multi: boolean) {
  if (multi) return value(formData, `quality_${type}`) || value(formData, "quality") || null;
  return value(formData, "quality") || null;
}

function titleForType(formData: FormData, type: string, multi: boolean, fallback: string) {
  if (multi) return value(formData, `title_${type}`) || value(formData, "title") || fallback;
  return value(formData, "title") || fallback;
}

export async function createRecord(formData: FormData) {
  const petIds = parsePetIds(formData);
  const types = parseRecordTypes(formData);
  const primaryType = types[0] ?? "";
  const returnToRaw = value(formData, "return_to");
  const returnTo = returnToRaw ? safeReturnPath(returnToRaw, "") : null;
  const neonatalContext = value(formData, "context") === "neonatal";
  const multi = types.length > 1;
  const failHere = (message: string): never => fail(petIds, primaryType, message, returnTo ?? undefined, neonatalContext);

  if (petIds.length === 0 || types.length === 0) failHere("Escolha ao menos um pet e o tipo de cuidado.");
  if (types.length > 2) failHere("Dá para registrar no máximo 2 tipos de uma vez.");

  const occurredAt = parseLocalDateTime(value(formData, "occurred_at"));
  if (!occurredAt) failHere("Informe uma data e hora válidas.");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, auth.user.id);
  const { data: petsData } = await supabase.from("pets").select("id, name, birth_date").eq("household_id", household.id).in("id", petIds).is("archived_at", null);
  if (!petsData || petsData.length !== petIds.length) failHere("Pet não encontrado.");
  const pets = petsData as { id: string; name: string; birth_date: string | null }[];

  if (types.some(isNeonatalCareType)) {
    const invalid = pets.filter((pet) => !isNeonatalPet(pet));
    if (invalid.length > 0) {
      failHere("Mamada, xixi, cocô e temperatura são só para filhotes com até 8 semanas.");
    }
  }

  const notes = value(formData, "notes") || null;
  const reminderRaw = value(formData, "reminder_due_at");
  const reminderAt = reminderRaw ? parseLocalDateTime(reminderRaw) : null;
  const reminderTitles: Record<string, string> = { vaccine: "Próxima vacina de", deworming: "Próximo vermífugo de", medication: "Medicamento de", consultation: "Retorno de" };
  let created = 0;

  for (const type of types) {
    if (type === "weight") {
      const grams = parseWeightKg(value(formData, "weight_kg"));
      if (grams == null) failHere("Informe um peso válido em kg (ex.: 4,2).");
      for (const pet of pets) {
        const { error } = await supabase.from("weight_records").insert({ household_id: household.id, pet_id: pet.id, weight_grams: grams, measured_at: occurredAt, notes });
        if (error) failHere(error.message);
        await supabase.from("pets").update({ current_weight_grams: grams, updated_at: new Date().toISOString() }).eq("id", pet.id).eq("household_id", household.id);
        created += 1;
      }
      continue;
    }

    if (isNeonatalCareType(type)) {
      const neonatalType = type as NeonatalRecordType;
      const amount = numberValue(formData, "amount_ml");
      const temperature = numberValue(formData, "temperature_c");
      if (type === "feeding" && (amount == null || amount <= 0 || amount > 1000)) failHere("Informe a quantidade da mamada.");
      if (type === "temperature" && (temperature == null || temperature < 30 || temperature > 45)) failHere("Informe uma temperatura válida.");
      const quality = qualityForType(formData, type, multi);
      const results = await Promise.all(pets.map((pet) => supabase.from("neonatal_records").insert({
        household_id: household.id,
        pet_id: pet.id,
        type: neonatalType,
        occurred_at: occurredAt,
        amount_ml: type === "feeding" ? amount : null,
        temperature_c: type === "temperature" ? temperature : null,
        quality: type === "feeding" || type === "urine" || type === "stool" ? quality : null,
        notes,
      })));
      const failed = results.find((result) => result.error);
      if (failed?.error) failHere(failed.error.message);
      created += pets.length;
      continue;
    }

    const healthType: HealthRecordType = type === "vaccine" || type === "deworming" || type === "medication" || type === "consultation" ? type : "other";
    const defaults: Record<HealthRecordType, string> = {
      vaccine: "Vacina",
      deworming: "Vermífugo",
      medication: "Medicamento",
      consultation: "Consulta veterinária",
      other: "Observação",
      exam: "Exame",
      disease: "Diagnóstico",
      allergy: "Alergia",
      surgery: "Cirurgia",
    };
    const title = titleForType(formData, type, multi, defaults[healthType]);
    const clinicOrVet = value(formData, "clinic_or_vet") || null;
    for (const pet of pets) {
      const { data, error } = await supabase.from("health_records").insert({
        household_id: household.id,
        pet_id: pet.id,
        type: healthType,
        title,
        occurred_at: occurredAt,
        clinic_or_vet: clinicOrVet,
        notes,
      }).select("id").single();
      if (error) failHere(error.message);
      created += 1;
      if (reminderAt && data && !multi) {
        const prefix = reminderTitles[type] ?? "Cuidado de";
        await supabase.from("reminders").insert({
          household_id: household.id,
          pet_id: pet.id,
          health_record_id: data.id,
          title: `${prefix} ${pet.name}`,
          category: type,
          due_at: reminderAt,
        });
      }
    }
  }

  revalidateRecordPaths(pets.map((pet) => pet.id));
  redirectAfterSave(returnTo ?? (neonatalContext ? "/neonatal" : null), pets.map((pet) => pet.id), created);
}
