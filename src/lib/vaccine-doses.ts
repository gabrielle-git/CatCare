/**
 * Persist structured preventive vaccine applications into vaccine_doses.
 * Convention without schema change:
 * - vaccine_name = protocol key (v3|v4|v5|rabies)
 * - dose_label = schedule label ("1ª dose", "Dose única", …)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatVaccineRecordTitle, isProtocolVaccineKey } from "@/lib/vaccine-schedule";

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

export function structuredVaccineTitle(vaccineKey: string, doseLabel: string) {
  return formatVaccineRecordTitle(vaccineKey, doseLabel);
}
