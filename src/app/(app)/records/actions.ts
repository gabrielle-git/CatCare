"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth-user";
import { parseWeightKg } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { getPerfTraceId, perfLog, timed, timedSync } from "@/lib/perf";
import { assertCanEdit } from "@/lib/roles";
import { parsePetIds } from "@/lib/pet-form";
import { numberValue, parseLocalDateTime, quickRecordTypes, redirectPathWithParam, resolveReturnTo, safeReturnPath, value, type RecordSource } from "@/lib/record-form";
import { validateFactualInstant } from "@/lib/factual-datetime";
import { createClient } from "@/lib/supabase/server";
import type { HealthRecordType, NeonatalRecordType } from "@/types/database";
import {
  findExistingVaccineDose,
  reconcileVaccineDoseForHealthRecord,
} from "@/lib/vaccine-doses";
import { dosesForVaccineKey, formatVaccineRecordTitle, isProtocolVaccineKey } from "@/lib/vaccine-schedule";
import {
  isFeedingSubtype,
  parseFeedingAmountValue,
  resolveFeedingUnitFromForm,
  shouldPreserveLegacyFeedingAmount,
} from "@/lib/neonatal-feeding";
import { buildHygieneFields, hygieneRecordTitle } from "@/lib/hygiene-care";
import { parseFeedingEditItemsFromForm } from "@/lib/feeding-care";
import { getNeonatalRecord } from "@/lib/records";

export type UpdateRecordResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

async function authContext() {
  return timed("updateRecord.authContext", async () => {
    const supabase = await timed("createServerSupabaseClient", () => createClient());
    const user = await getAuthUser();
    if (!user) redirect("/login");
    const [, household] = await Promise.all([
      timed("assertCanEdit", () => assertCanEdit(supabase)),
      ensureHousehold(supabase, user.id),
    ]);
    return { supabase, household, userId: user.id };
  });
}

function revalidateRecordPaths(petId: string, source: RecordSource = "health") {
  timedSync("revalidatePath /pets/:id", () => revalidatePath(`/pets/${petId}`));
  timedSync("revalidatePath /", () => revalidatePath("/"));
  timedSync("revalidatePath /historico", () => revalidatePath("/historico"));
  if (source === "neonatal" || source === "feeding") {
    timedSync("revalidatePath /neonatal", () => revalidatePath("/neonatal"));
  }
}

function redirectWithDeleted(returnTo: string, count = 1) {
  redirect(redirectPathWithParam(returnTo, "deleted", String(count)));
}

type RecordRef = { id: string; source: RecordSource; petId: string };

function tableForSource(source: RecordSource) {
  if (source === "weight") return "weight_records";
  if (source === "neonatal") return "neonatal_records";
  if (source === "feeding") return "feeding_sessions";
  return "health_records";
}

export async function updateRecord(recordId: string, source: RecordSource, formData: FormData): Promise<UpdateRecordResult> {
  const actionStart = performance.now();
  const trace = getPerfTraceId();
  perfLog("updateRecord", "start");

  const petIds = parsePetIds(formData);
  const petId = petIds[0];
  const type = value(formData, "record_type");
  const returnTo = resolveReturnTo(value(formData, "return_to"));
  const failHere = (message: string): UpdateRecordResult => ({ ok: false, error: message });

  if (!petId || !quickRecordTypes.has(type)) return failHere("Escolha o pet e confira o registro.");

  const occurredAt = parseLocalDateTime(value(formData, "occurred_at"));
  if (!occurredAt) return failHere("Informe uma data e hora válidas.");
  const occurredCheck = validateFactualInstant(occurredAt);
  if (!occurredCheck.ok) return failHere(occurredCheck.message);
  perfLog("updateRecord.parseFormData", `ok source=${source}`);

  const { supabase, household } = await authContext();
  const { data: pet } = await timed("updateRecord.selectPet", () =>
    supabase.from("pets").select("id").eq("id", petId).eq("household_id", household.id).is("archived_at", null).maybeSingle(),
  );
  if (!pet) return failHere("Pet não encontrado.");

  const notes = value(formData, "notes") || null;

  if (source === "weight") {
    const grams = parseWeightKg(value(formData, "weight_kg"));
    if (grams == null) return failHere("Informe um peso válido em kg (ex.: 4,2).");
    const { error } = await timed("updateRecord.UPDATE weight_records", () =>
      supabase.from("weight_records").update({ pet_id: petId, weight_grams: grams, measured_at: occurredAt, notes }).eq("id", recordId).eq("household_id", household.id),
    );
    if (error) return failHere(error.message);
  } else if (source === "feeding") {
    if (type !== "feeding") return failHere("Registro de alimentação inválido.");
    const items = parseFeedingEditItemsFromForm(formData);
    if (!items.ok) return failHere(items.message);
    const quality = value(formData, "quality") || null;
    const { error } = await timed("updateRecord.replace_feeding_session", () =>
      supabase.rpc("replace_feeding_session", {
        p_session_id: recordId,
        p_occurred_at: occurredAt,
        p_notes: notes,
        p_quality: quality,
        p_items: items.ok ? items.items : [],
      }),
    );
    if (error) return failHere(error.message);
  } else if (source === "neonatal") {
    const neonatalType = type as NeonatalRecordType;
    const temperature = numberValue(formData, "temperature_c");
    if (type === "temperature" && (temperature == null || temperature < 30 || temperature > 45)) {
      return failHere("Informe uma temperatura válida.");
    }

    const existing = type === "feeding"
      ? await timed("updateRecord.selectNeonatal", () => getNeonatalRecord(supabase, household.id, recordId))
      : null;
    if (type === "feeding" && !existing) return failHere("Registro não encontrado.");

    let amountMl: number | null = null;
    let feedingSubtype: string | null = null;
    let feedingAmountValue: number | null = null;
    let feedingAmountUnit: string | null = null;

    if (type === "feeding" && existing) {
      const subtypeRaw = value(formData, "feeding_subtype");
      const nextSubtype = subtypeRaw && isFeedingSubtype(subtypeRaw) ? subtypeRaw : null;
      const nextValue = parseFeedingAmountValue(value(formData, "feeding_amount_value"));
      const nextUnit = resolveFeedingUnitFromForm(
        value(formData, "feeding_amount_unit_preset"),
        value(formData, "feeding_amount_unit_other"),
      );
      if (nextValue == null) return failHere("Informe a quantidade da alimentação.");
      if (!nextUnit) return failHere("Informe a unidade da quantidade.");

      if (
        shouldPreserveLegacyFeedingAmount({
          existing,
          nextSubtype,
          nextValue,
          nextUnit,
        })
      ) {
        // Notes/quality/time-only edit on legacy: keep amount_ml, leave feeding_* null.
        amountMl = Number(existing.amount_ml);
        feedingSubtype = null;
        feedingAmountValue = null;
        feedingAmountUnit = null;
      } else {
        // New structured amount, or explicit conversion from legacy.
        if (!nextSubtype) return failHere("Escolha o tipo de alimentação.");
        amountMl = null;
        feedingSubtype = nextSubtype;
        feedingAmountValue = nextValue;
        feedingAmountUnit = nextUnit;
      }
    }

    const { error } = await timed("updateRecord.UPDATE neonatal_records", () =>
      supabase.from("neonatal_records").update({
        pet_id: petId,
        type: neonatalType,
        occurred_at: occurredAt,
        amount_ml: type === "feeding" ? amountMl : null,
        feeding_subtype: type === "feeding" ? feedingSubtype : null,
        feeding_amount_value: type === "feeding" ? feedingAmountValue : null,
        feeding_amount_unit: type === "feeding" ? feedingAmountUnit : null,
        temperature_c: type === "temperature" ? temperature : null,
        quality: value(formData, "quality") || null,
        notes,
      }).eq("id", recordId).eq("household_id", household.id),
    );
    if (error) return failHere(error.message);
  } else {
    const healthType: HealthRecordType =
      type === "vaccine" || type === "deworming" || type === "medication" || type === "consultation" || type === "hygiene"
        ? type
        : "other";
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
      hygiene: "Cuidados de higiene",
    };

    let hygieneSubtype: string | null = null;
    let hygieneCustomLabel: string | null = null;
    if (type === "hygiene") {
      const hygiene = buildHygieneFields(value(formData, "hygiene_subtype"), value(formData, "hygiene_custom_label"));
      if (!hygiene.ok) return failHere(hygiene.message);
      hygieneSubtype = hygiene.fields.hygiene_subtype;
      hygieneCustomLabel = hygiene.fields.hygiene_custom_label;
    }

    const vaccineKey = type === "vaccine" ? value(formData, "vaccine_key") : "";
    const doseLabel = type === "vaccine" ? value(formData, "dose_label") : "";
    if (type === "vaccine") {
      if (!vaccineKey) return failHere("Escolha qual vacina foi aplicada.");
      if (vaccineKey === "other") {
        // history only
      } else if (!isProtocolVaccineKey(vaccineKey)) {
        return failHere("Vacina inválida.");
      } else if (!doseLabel) {
        return failHere("Escolha a dose aplicada.");
      } else if (!dosesForVaccineKey(vaccineKey).includes(doseLabel)) {
        return failHere("Dose inválida para esta vacina.");
      }
    }

    const title = type === "hygiene" && hygieneSubtype
      ? hygieneRecordTitle(hygieneSubtype, hygieneCustomLabel)
      : type === "vaccine" && isProtocolVaccineKey(vaccineKey) && doseLabel
        ? formatVaccineRecordTitle(vaccineKey, doseLabel)
        : value(formData, "title") || defaults[healthType];
    if (type === "vaccine" && vaccineKey === "other" && !title.trim()) {
      return failHere("Informe o nome da vacina.");
    }

    const clinicOrVet = type === "hygiene" ? null : value(formData, "clinic_or_vet") || null;

    if (type === "vaccine" && isProtocolVaccineKey(vaccineKey) && doseLabel) {
      const existing = await findExistingVaccineDose(supabase, petId, vaccineKey, doseLabel);
      if (existing && existing.health_record_id !== recordId) {
        return failHere("Esta dose já está registrada como aplicada.");
      }
    }

    const { error } = await timed("updateRecord.UPDATE health_records", () =>
      supabase.from("health_records").update({
        pet_id: petId,
        type: healthType,
        title,
        occurred_at: occurredAt,
        clinic_or_vet: clinicOrVet,
        notes,
        hygiene_subtype: type === "hygiene" ? hygieneSubtype : null,
        hygiene_custom_label: type === "hygiene" ? hygieneCustomLabel : null,
        updated_at: new Date().toISOString(),
      }).eq("id", recordId).eq("household_id", household.id),
    );
    if (error) return failHere(error.message);

    try {
      await reconcileVaccineDoseForHealthRecord(supabase, {
        householdId: household.id,
        petId,
        healthRecordId: recordId,
        vaccineKey: type === "vaccine" && isProtocolVaccineKey(vaccineKey) ? vaccineKey : null,
        doseLabel: type === "vaccine" && isProtocolVaccineKey(vaccineKey) ? doseLabel : null,
        administeredAt: occurredAt as string,
        clinicOrVet,
        notes,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível atualizar a prevenção.";
      return failHere(message);
    }
  }

  const beforeRevalidate = Math.round(performance.now() - actionStart);
  perfLog("updateRecord.beforeRevalidate", `total=${beforeRevalidate}ms (UPDATE done)`);

  revalidateRecordPaths(petId, source);
  const destination = safeReturnPath(returnTo, `/pets/${petId}`);
  const destPath = redirectPathWithParam(destination, "updated", "1");
  const beforeReturn = Math.round(performance.now() - actionStart);
  console.log(`[CATCARE_PERF][trace ${trace}][updateRecord.before return] total=${beforeReturn}ms dest=${destPath.split("?")[0]}`);
  // Edit success: lean serializable result — client does window.location.replace (full navigation).
  return { ok: true, redirectTo: destPath };
}

export async function deleteRecord(recordId: string, source: RecordSource, petId: string, formData: FormData) {
  if (!petId) redirect("/pets");
  const returnTo = safeReturnPath(value(formData, "return_to"), `/pets/${petId}`);
  const { supabase, household } = await authContext();
  const table = tableForSource(source);

  // Linked vaccine_doses are removed by FK ON DELETE CASCADE on health_record_id.
  // feeding_sessions has no household_id — RLS via pets; cascade deletes items.
  let data: { id: string }[] | null = null;
  let error: { message: string } | null = null;
  if (source === "feeding") {
    const result = await supabase.from(table).delete().eq("id", recordId).eq("pet_id", petId).select("id");
    data = result.data;
    error = result.error;
  } else {
    const result = await supabase.from(table).delete().eq("id", recordId).eq("household_id", household.id).select("id");
    data = result.data;
    error = result.error;
  }
  if (error) redirect(redirectPathWithParam(returnTo, "error", error.message));
  if (!data?.length) redirect(redirectPathWithParam(returnTo, "error", "Registro não encontrado ou sem permissão para apagar."));

  revalidateRecordPaths(petId, source);
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
  const sourcesByPet = new Map<string, Set<RecordSource>>();
  let deleted = 0;

  for (const record of records) {
    // Linked vaccine_doses cascade-delete with health_records (FK ON DELETE CASCADE).
    const table = tableForSource(record.source);
    const result = record.source === "feeding"
      ? await supabase.from(table).delete().eq("id", record.id).eq("pet_id", record.petId).select("id")
      : await supabase.from(table).delete().eq("id", record.id).eq("household_id", household.id).select("id");
    if (result.error) redirect(redirectPathWithParam(returnTo, "error", result.error.message));
    if (result.data?.length) {
      deleted += result.data.length;
      petIds.add(record.petId);
      const sources = sourcesByPet.get(record.petId) ?? new Set<RecordSource>();
      sources.add(record.source);
      sourcesByPet.set(record.petId, sources);
    }
  }

  if (deleted === 0) redirect(redirectPathWithParam(returnTo, "error", "Nenhum registro foi apagado."));

  for (const petId of petIds) {
    const sources = sourcesByPet.get(petId);
    const source: RecordSource = sources?.has("neonatal")
      ? "neonatal"
      : sources?.has("feeding")
        ? "feeding"
        : sources?.has("weight")
          ? "weight"
          : "health";
    revalidateRecordPaths(petId, source);
  }
  redirectWithDeleted(returnTo, deleted);
}
