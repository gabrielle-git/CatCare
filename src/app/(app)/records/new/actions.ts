"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { parsePetIds } from "@/lib/pet-form";
import { assertCanEdit } from "@/lib/roles";
import {
  isNeonatalCareType,
  numberValue,
  parseLocalDateTime,
  parseRecordTypes,
  parseWeightGramsForPet,
  redirectPathWithParam,
  resolveReturnTo,
  shouldSaveObservationAsNeonatal,
  value,
} from "@/lib/record-form";
import { validateFactualInstant } from "@/lib/factual-datetime";
import { createClient } from "@/lib/supabase/server";
import type { HealthRecordType, NeonatalRecordType } from "@/types/database";
import { findExistingVaccineDose, insertVaccineDose } from "@/lib/vaccine-doses";
import { dosesForVaccineKey, formatVaccineRecordTitle, isProtocolVaccineKey } from "@/lib/vaccine-schedule";
import {
  isFeedingSubtype,
  notesFieldNameForPet,
  parseFeedingAmountValue,
  resolveFeedingUnitFromForm,
  resolvePetNotes,
} from "@/lib/neonatal-feeding";

function fail(petIds: string[], type: string, message: string, returnTo?: string | null, neonatalContext?: boolean, extras?: { vaccineKey?: string; doseLabel?: string; title?: string }): never {
  const params = new URLSearchParams();
  const pet = petIds[0] ?? "";
  if (pet) params.set("pet", pet);
  if (type) params.set("type", type);
  params.set("error", message);
  if (returnTo) params.set("return_to", returnTo);
  if (neonatalContext) params.set("context", "neonatal");
  if (extras?.vaccineKey) params.set("vaccine_key", extras.vaccineKey);
  if (extras?.doseLabel) params.set("dose_label", extras.doseLabel);
  if (extras?.title) params.set("record_title", extras.title);
  redirect(`/records/new?${params.toString()}`);
}

function redirectAfterSave(returnTo: string | null, petIds: string[], count: number) {
  const saved = String(count);
  if (returnTo) {
    redirect(redirectPathWithParam(returnTo, "saved", saved));
  }
  if (petIds.length === 1) redirect(`/pets/${petIds[0]}?saved=1`);
  // Multi-pet without origin: pets list is better than Home as universal fallback.
  redirect(redirectPathWithParam("/pets", "saved", saved));
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
  const returnTo = resolveReturnTo(value(formData, "return_to"));
  const neonatalContext = value(formData, "context") === "neonatal";
  const multi = types.length > 1;
  const vaccineKeyEarly = value(formData, "vaccine_key");
  const doseLabelEarly = value(formData, "dose_label");
  const failHere = (message: string): never => fail(petIds, primaryType, message, returnTo, neonatalContext, {
    vaccineKey: vaccineKeyEarly || undefined,
    doseLabel: doseLabelEarly || undefined,
    title: value(formData, "title") || undefined,
  });

  if (petIds.length === 0 || types.length === 0) failHere("Escolha ao menos um pet e o tipo de cuidado.");

  const occurredAt = parseLocalDateTime(value(formData, "occurred_at"));
  if (!occurredAt) failHere("Informe uma data e hora válidas.");
  const occurredCheck = validateFactualInstant(occurredAt);
  if (!occurredCheck.ok) failHere(occurredCheck.message);

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
      failHere("Alimentação, xixi, cocô e temperatura são só para filhotes com até 8 semanas.");
    }
  }

  if (types.includes("observation") && shouldSaveObservationAsNeonatal("observation", pets, neonatalContext, isNeonatalPet)) {
    const invalid = pets.filter((pet) => !isNeonatalPet(pet));
    if (invalid.length > 0) {
      failHere("Nota neonatal é só para filhotes com até 8 semanas.");
    }
  }

  const notesShared = value(formData, "notes") || null;
  const reminderRaw = value(formData, "reminder_due_at");
  const reminderAt = reminderRaw ? parseLocalDateTime(reminderRaw) : null;
  const reminderTitles: Record<string, string> = { vaccine: "Próxima vacina de", deworming: "Próximo vermífugo de", medication: "Medicamento de", consultation: "Retorno de" };
  let created = 0;

  for (const type of types) {
    if (type === "weight") {
      const useLegacyField = pets.length === 1;
      for (const pet of pets) {
        const grams = parseWeightGramsForPet(formData, pet.id, useLegacyField);
        if (grams == null) {
          failHere(pets.length === 1
            ? "Informe um peso válido em kg (ex.: 4,2)."
            : `Informe um peso válido para ${pet.name}.`);
        }
        const petNotes = resolvePetNotes(notesShared, value(formData, notesFieldNameForPet(pet.id)));
        const { error } = await supabase.from("weight_records").insert({ household_id: household.id, pet_id: pet.id, weight_grams: grams, measured_at: occurredAt, notes: petNotes });
        if (error) failHere(error.message);
        await supabase.from("pets").update({ current_weight_grams: grams, updated_at: new Date().toISOString() }).eq("id", pet.id).eq("household_id", household.id);
        created += 1;
      }
      continue;
    }

    if (isNeonatalCareType(type)) {
      const neonatalType = type as NeonatalRecordType;
      const temperature = numberValue(formData, "temperature_c");
      if (type === "temperature" && (temperature == null || temperature < 30 || temperature > 45)) failHere("Informe uma temperatura válida.");

      let feedingSubtype: string | null = null;
      let feedingAmountValue: number | null = null;
      let feedingAmountUnit: string | null = null;
      if (type === "feeding") {
        const subtypeRaw = value(formData, "feeding_subtype");
        if (!isFeedingSubtype(subtypeRaw)) failHere("Escolha o tipo de alimentação.");
        feedingSubtype = subtypeRaw;
        feedingAmountValue = parseFeedingAmountValue(value(formData, "feeding_amount_value"));
        feedingAmountUnit = resolveFeedingUnitFromForm(
          value(formData, "feeding_amount_unit_preset"),
          value(formData, "feeding_amount_unit_other"),
        );
        if (feedingAmountValue == null) failHere("Informe a quantidade da alimentação.");
        if (!feedingAmountUnit) failHere("Informe a unidade da quantidade.");
      }

      const quality = qualityForType(formData, type, multi);
      const results = await Promise.all(pets.map((pet) => {
        const petNotes = resolvePetNotes(notesShared, value(formData, notesFieldNameForPet(pet.id)));
        return supabase.from("neonatal_records").insert({
          household_id: household.id,
          pet_id: pet.id,
          type: neonatalType,
          occurred_at: occurredAt,
          amount_ml: null,
          feeding_subtype: type === "feeding" ? feedingSubtype : null,
          feeding_amount_value: type === "feeding" ? feedingAmountValue : null,
          feeding_amount_unit: type === "feeding" ? feedingAmountUnit : null,
          temperature_c: type === "temperature" ? temperature : null,
          quality: type === "feeding" || type === "urine" || type === "stool" ? quality : null,
          notes: petNotes,
        });
      }));
      const failed = results.find((result) => result.error);
      if (failed?.error) failHere(failed.error.message);
      created += pets.length;
      continue;
    }

    if (shouldSaveObservationAsNeonatal(type, pets, neonatalContext, isNeonatalPet)) {
      const results = await Promise.all(pets.map((pet) => {
        const petNotes = resolvePetNotes(notesShared, value(formData, notesFieldNameForPet(pet.id)));
        return supabase.from("neonatal_records").insert({
          household_id: household.id,
          pet_id: pet.id,
          type: "observation",
          occurred_at: occurredAt,
          amount_ml: null,
          feeding_subtype: null,
          feeding_amount_value: null,
          feeding_amount_unit: null,
          temperature_c: null,
          quality: null,
          notes: petNotes,
        });
      }));
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

    const vaccineKey = type === "vaccine" ? value(formData, "vaccine_key") : "";
    const doseLabel = type === "vaccine" ? value(formData, "dose_label") : "";
    if (type === "vaccine") {
      if (!vaccineKey) failHere("Escolha qual vacina foi aplicada.");
      if (vaccineKey === "other") {
        // Free-form vaccine — history only, no protocol reconciliation.
      } else if (!isProtocolVaccineKey(vaccineKey)) {
        failHere("Vacina inválida.");
      } else if (!doseLabel) {
        failHere("Escolha a dose aplicada.");
      } else if (!dosesForVaccineKey(vaccineKey).includes(doseLabel)) {
        failHere("Dose inválida para esta vacina.");
      }
    }

    const title = type === "vaccine" && isProtocolVaccineKey(vaccineKey) && doseLabel
      ? formatVaccineRecordTitle(vaccineKey, doseLabel)
      : titleForType(formData, type, multi, defaults[healthType]);
    if (type === "vaccine" && vaccineKey === "other" && !title.trim()) {
      failHere("Informe o nome da vacina.");
    }

    const clinicOrVet = value(formData, "clinic_or_vet") || null;
    for (const pet of pets) {
      if (type === "vaccine" && isProtocolVaccineKey(vaccineKey) && doseLabel) {
        const existing = await findExistingVaccineDose(supabase, pet.id, vaccineKey, doseLabel);
        if (existing) failHere("Esta dose já está registrada como aplicada.");
      }

      const petNotes = resolvePetNotes(notesShared, value(formData, notesFieldNameForPet(pet.id)));
      const { data, error } = await supabase.from("health_records").insert({
        household_id: household.id,
        pet_id: pet.id,
        type: healthType,
        title,
        occurred_at: occurredAt,
        clinic_or_vet: clinicOrVet,
        notes: petNotes,
      }).select("id").single();
      if (error) failHere(error.message);
      created += 1;

      if (type === "vaccine" && isProtocolVaccineKey(vaccineKey) && doseLabel && data) {
        try {
          await insertVaccineDose(supabase, {
            householdId: household.id,
            petId: pet.id,
            healthRecordId: data.id,
            vaccineKey,
            doseLabel,
            administeredAt: occurredAt as string,
            clinicOrVet,
            notes: petNotes,
          });
        } catch (cause) {
          await supabase.from("health_records").delete().eq("id", data.id).eq("household_id", household.id);
          const message = cause instanceof Error ? cause.message : "Não foi possível atualizar a prevenção.";
          failHere(message);
        }
      }

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
