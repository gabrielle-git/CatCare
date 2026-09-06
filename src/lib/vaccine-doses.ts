/**
 * Persist structured preventive vaccine applications into vaccine_doses.
 * Convention without schema change:
 * - vaccine_name = protocol key (v3|v4|v5|rabies)
 * - dose_label = schedule label ("1ª dose", "Dose única", …)
 * - health_record_id = owning health_records row (required for validity)
 *
 * FK ON DELETE is SET NULL — application MUST delete linked doses before/with
 * the health record, and readers MUST ignore orphans (null health_record_id).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatVaccineRecordTitle, isProtocolVaccineKey } from "@/lib/vaccine-schedule";

export async function findVaccineDoseByHealthRecordId(
  supabase: SupabaseClient,
  healthRecordId: string,
  householdId: string,
) {
  const { data, error } = await supabase
    .from("vaccine_doses")
    .select("id, pet_id, vaccine_name, dose_label, health_record_id")
    .eq("household_id", householdId)
    .eq("health_record_id", healthRecordId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Only linked (non-orphan) doses block a new application. */
export async function findExistingVaccineDose(
  supabase: SupabaseClient,
  petId: string,
  vaccineKey: string,
  doseLabel: string,
) {
  if (!isProtocolVaccineKey(vaccineKey) || !doseLabel) return null;
  const { data, error } = await supabase
    .from("vaccine_doses")
    .select("id, health_record_id")
    .eq("pet_id", petId)
    .eq("vaccine_name", vaccineKey)
    .eq("dose_label", doseLabel)
    .not("health_record_id", "is", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertVaccineDose(supabase: SupabaseClient, input: {
  householdId: string;
  petId: string;
  healthRecordId: string;
  vaccineKey: string;
  doseLabel: string;
  administeredAt: string;
  clinicOrVet?: string | null;
  notes?: string | null;
}) {
  if (!isProtocolVaccineKey(input.vaccineKey)) {
    throw new Error("Vacina fora do protocolo não gera baixa preventiva.");
  }
  const { error } = await supabase.from("vaccine_doses").insert({
    household_id: input.householdId,
    pet_id: input.petId,
    health_record_id: input.healthRecordId,
    vaccine_name: input.vaccineKey,
    dose_label: input.doseLabel,
    administered_at: input.administeredAt,
    clinic_or_vet: input.clinicOrVet ?? null,
    notes: input.notes ?? null,
  });
  if (error) throw error;
}

/** Delete only doses owned by this health_record_id (never by title/regex). */
export async function deleteVaccineDosesForHealthRecord(
  supabase: SupabaseClient,
  healthRecordId: string,
  householdId: string,
) {
  const { error } = await supabase
    .from("vaccine_doses")
    .delete()
    .eq("household_id", householdId)
    .eq("health_record_id", healthRecordId);
  if (error) throw error;
}

export async function updateLinkedVaccineDose(
  supabase: SupabaseClient,
  doseId: string,
  householdId: string,
  patch: {
    petId: string;
    vaccineKey: string;
    doseLabel: string;
    administeredAt: string;
    clinicOrVet?: string | null;
    notes?: string | null;
  },
) {
  if (!isProtocolVaccineKey(patch.vaccineKey)) {
    throw new Error("Vacina fora do protocolo não gera baixa preventiva.");
  }
  const { error } = await supabase
    .from("vaccine_doses")
    .update({
      pet_id: patch.petId,
      vaccine_name: patch.vaccineKey,
      dose_label: patch.doseLabel,
      administered_at: patch.administeredAt,
      clinic_or_vet: patch.clinicOrVet ?? null,
      notes: patch.notes ?? null,
    })
    .eq("id", doseId)
    .eq("household_id", householdId);
  if (error) throw error;
}

/**
 * Reconcile structured dose for a health record after UPDATE.
 * - non-protocol / non-vaccine → remove linked dose
 * - same key/dose → update metadata
 * - changed key/dose → remove old linked + insert new (if free)
 */
export async function reconcileVaccineDoseForHealthRecord(
  supabase: SupabaseClient,
  input: {
    householdId: string;
    petId: string;
    healthRecordId: string;
    vaccineKey: string | null;
    doseLabel: string | null;
    administeredAt: string;
    clinicOrVet?: string | null;
    notes?: string | null;
  },
) {
  const linked = await findVaccineDoseByHealthRecordId(supabase, input.healthRecordId, input.householdId);
  const wantsStructured = Boolean(
    input.vaccineKey && isProtocolVaccineKey(input.vaccineKey) && input.doseLabel,
  );

  if (!wantsStructured) {
    if (linked) {
      await deleteVaccineDosesForHealthRecord(supabase, input.healthRecordId, input.householdId);
    }
    return;
  }

  const vaccineKey = input.vaccineKey as string;
  const doseLabel = input.doseLabel as string;

  if (linked) {
    const same =
      linked.vaccine_name === vaccineKey
      && linked.dose_label === doseLabel
      && linked.pet_id === input.petId;
    if (same) {
      await updateLinkedVaccineDose(supabase, linked.id as string, input.householdId, {
        petId: input.petId,
        vaccineKey,
        doseLabel,
        administeredAt: input.administeredAt,
        clinicOrVet: input.clinicOrVet,
        notes: input.notes,
      });
      return;
    }
    await deleteVaccineDosesForHealthRecord(supabase, input.healthRecordId, input.householdId);
  }

  const existing = await findExistingVaccineDose(supabase, input.petId, vaccineKey, doseLabel);
  if (existing && existing.health_record_id !== input.healthRecordId) {
    throw new Error("Esta dose já está registrada como aplicada.");
  }

  await insertVaccineDose(supabase, {
    householdId: input.householdId,
    petId: input.petId,
    healthRecordId: input.healthRecordId,
    vaccineKey,
    doseLabel,
    administeredAt: input.administeredAt,
    clinicOrVet: input.clinicOrVet,
    notes: input.notes,
  });
}

export function structuredVaccineTitle(vaccineKey: string, doseLabel: string) {
  return formatVaccineRecordTitle(vaccineKey, doseLabel);
}
