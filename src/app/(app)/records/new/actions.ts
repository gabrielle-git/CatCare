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
  resolvePostCreateDestination,
  resolveReturnTo,
  shouldSaveObservationAsNeonatal,
  value,
} from "@/lib/record-form";
import { validateFactualInstant } from "@/lib/factual-datetime";
import { createClient } from "@/lib/supabase/server";
import type { HealthRecordType, NeonatalRecordType } from "@/types/database";
import {
  findExistingVaccineDose,
  findVaccineDoseByHealthRecordId,
  insertVaccineDose,
} from "@/lib/vaccine-doses";
import { dosesForVaccineKey, formatVaccineRecordTitle, isProtocolVaccineKey } from "@/lib/vaccine-schedule";
import {
  notesFieldNameForPet,
  notesTargetPetFieldName,
  resolvePetNotesForCreate,
} from "@/lib/neonatal-feeding";
import { buildHygieneFieldsList, hygieneRecordTitle } from "@/lib/hygiene-care";
import {
  buildFeedingItems,
  buildFeedingSessionBatchPayload,
  feedingAmountOverridePetFieldName,
  parseFeedingSubtypeList,
  readFeedingDefaultAmountsFromForm,
} from "@/lib/feeding-care";
import {
  attachmentPayloadForRpc,
  prepareAttachmentUploads,
  removeStoragePaths,
  uploadPreparedAttachments,
  validateAttachmentFiles,
} from "@/lib/attachments";
import {
  readAttachmentFiles,
  readAttachmentIds,
  readDisplayNames,
  readStableRecordIdForPet,
} from "@/lib/health-record-attachment-form";
import {
  isAttachableQuickRecordType,
  mapFormTypeToHealthRecordType,
  resolveHealthRecordCreateOwnership,
} from "@/lib/health-record-type";

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

function redirectAfterSave(returnTo: string | null, petIds: string[], count: number, neonatalContext = false) {
  const destination = resolvePostCreateDestination({ returnTo, petIds, neonatalContext });
  redirect(redirectPathWithParam(destination, "saved", String(count)));
}

function revalidateRecordPaths(petIds: string[]) {
  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath("/historico");
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

async function ensureHealthRecordAttachments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  healthRecordId: string,
  formData: FormData,
  failHere: (message: string) => never,
) {
  const files = readAttachmentFiles(formData);
  if (files.length === 0) return;

  let attachmentIds: string[] = [];
  let displayNames: Array<string | null> = [];
  try {
    attachmentIds = readAttachmentIds(formData, files.length);
    displayNames = readDisplayNames(formData, "display_names", files.length);
  } catch (error) {
    failHere(error instanceof Error ? error.message : "Arquivos inválidos.");
  }

  const { data: alreadyLinked } = await supabase
    .from("health_record_attachments")
    .select("attachment_id")
    .eq("health_record_id", healthRecordId)
    .in("attachment_id", attachmentIds);
  const linkedIds = new Set((alreadyLinked ?? []).map((row) => row.attachment_id));
  const pendingIndexes = attachmentIds
    .map((id, index) => ({ id, index }))
    .filter((item) => !linkedIds.has(item.id));
  if (pendingIndexes.length === 0) return;

  const { count } = await supabase
    .from("health_record_attachments")
    .select("attachment_id", { count: "exact", head: true })
    .eq("health_record_id", healthRecordId);

  const pendingFiles = pendingIndexes.map((item) => files[item.index]);
  const pendingIds = pendingIndexes.map((item) => item.id);
  const pendingDisplayNames = pendingIndexes.map((item) => displayNames[item.index]);
  const validated = await validateAttachmentFiles(pendingFiles, {
    required: false,
    existingCount: count ?? 0,
    entityLabel: "registro",
  });
  const validatedFiles = validated.ok ? validated.values : failHere(validated.message);
  const prepared = prepareAttachmentUploads(householdId, validatedFiles, 0, pendingIds, pendingDisplayNames);
  let uploaded: string[] = [];
  try {
    uploaded = await uploadPreparedAttachments(supabase, prepared);
  } catch (error) {
    failHere(error instanceof Error ? error.message : "Não foi possível enviar os arquivos.");
  }

  const { error } = await supabase.rpc("add_health_record_attachments", {
    p_health_record_id: healthRecordId,
    p_attachments: attachmentPayloadForRpc(prepared),
  });
  if (error) {
    const { data: linkedNow } = await supabase
      .from("health_record_attachments")
      .select("attachment_id")
      .eq("health_record_id", healthRecordId)
      .in("attachment_id", pendingIds);
    const linked = new Set((linkedNow ?? []).map((row) => row.attachment_id));
    if (!pendingIds.every((id) => linked.has(id))) {
      await removeStoragePaths(supabase, uploaded);
      failHere(error.message);
    }
  }
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
      failHere("Xixi, cocô e temperatura são só para filhotes com até 8 semanas.");
    }
  }

  if (types.includes("observation") && shouldSaveObservationAsNeonatal("observation", pets, neonatalContext, isNeonatalPet)) {
    const invalid = pets.filter((pet) => !isNeonatalPet(pet));
    if (invalid.length > 0) {
      failHere("Nota neonatal é só para filhotes com até 8 semanas.");
    }
  }

  const notesShared = value(formData, "notes") || null;
  const perPetNotesEnabled = value(formData, "include_per_pet_notes") === "1";
  const notesTargetPets = new Set(
    perPetNotesEnabled
      ? formData.getAll(notesTargetPetFieldName()).map((entry) => String(entry)).filter(Boolean)
      : [],
  );
  const notesForPet = (petId: string) =>
    resolvePetNotesForCreate({
      shared: notesShared,
      individual: value(formData, notesFieldNameForPet(petId)),
      perPetNotesEnabled,
      petSelectedForIndividual: notesTargetPets.has(petId),
    });
  const reminderRaw = value(formData, "reminder_due_at");
  const reminderAt = reminderRaw ? parseLocalDateTime(reminderRaw) : null;
  const reminderTitles: Record<string, string> = { vaccine: "Próxima vacina de", deworming: "Próximo vermífugo de", medication: "Medicamento de", consultation: "Retorno de" };
  let created = 0;

  const wantsAttachments = !multi && types.length === 1 && isAttachableQuickRecordType(types[0] ?? "");
  if (wantsAttachments && pets.length !== 1) {
    failHere("Anexos clínicos ficam disponíveis ao registrar para um pet por vez.");
  }
  if (wantsAttachments && types[0] === "hygiene") {
    const hygienePreview = buildHygieneFieldsList(
      formData.getAll("hygiene_subtype").map((item) => String(item)),
      value(formData, "hygiene_custom_label"),
    );
    if (hygienePreview.ok && hygienePreview.items.length > 1) {
      failHere("Anexos clínicos ficam disponíveis ao registrar um cuidado de higiene por vez.");
    }
  }

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
        const petNotes = notesForPet(pet.id);
        const { error } = await supabase.from("weight_records").insert({ household_id: household.id, pet_id: pet.id, weight_grams: grams, measured_at: occurredAt, notes: petNotes });
        if (error) failHere(error.message);
        await supabase.from("pets").update({ current_weight_grams: grams, updated_at: new Date().toISOString() }).eq("id", pet.id).eq("household_id", household.id);
        created += 1;
      }
      continue;
    }

    if (type === "feeding") {
      const subtypes = parseFeedingSubtypeList(formData.getAll("feeding_item_subtype").map((item) => String(item)));
      const amounts = readFeedingDefaultAmountsFromForm(formData, subtypes);
      const built = buildFeedingItems(subtypes, value(formData, "feeding_custom_label"), amounts);
      if (!built.ok) failHere(built.message);
      const defaultItems = built.ok ? built.items : [];

      const overridesEnabled = value(formData, "include_feeding_amount_overrides") === "1";
      const overridePetIds = new Set(
        overridesEnabled
          ? formData.getAll(feedingAmountOverridePetFieldName()).map((entry) => String(entry)).filter(Boolean)
          : [],
      );

      const batch = buildFeedingSessionBatchPayload({
        petIds: pets.map((pet) => pet.id),
        notesByPetId: (petId) => notesForPet(petId),
        defaultItems,
        formData,
        overridePetIds,
      });
      if (!batch.ok) failHere(batch.message);
      const payload = batch.ok ? batch.payload : [];

      const quality = qualityForType(formData, type, multi) || null;
      const { data: sessionIds, error } = await supabase.rpc("create_feeding_sessions_batch", {
        p_occurred_at: occurredAt,
        p_quality: quality,
        p_payload: payload,
      });
      if (error) failHere(error.message);
      created += Array.isArray(sessionIds) ? sessionIds.length : pets.length;
      continue;
    }

    if (isNeonatalCareType(type)) {
      const neonatalType = type as NeonatalRecordType;
      const temperature = numberValue(formData, "temperature_c");
      if (type === "temperature" && (temperature == null || temperature < 30 || temperature > 45)) failHere("Informe uma temperatura válida.");

      const quality = qualityForType(formData, type, multi);
      const results = await Promise.all(pets.map((pet) => {
        const petNotes = notesForPet(pet.id);
        return supabase.from("neonatal_records").insert({
          household_id: household.id,
          pet_id: pet.id,
          type: neonatalType,
          occurred_at: occurredAt,
          amount_ml: null,
          feeding_subtype: null,
          feeding_amount_value: null,
          feeding_amount_unit: null,
          temperature_c: type === "temperature" ? temperature : null,
          quality: type === "urine" || type === "stool" ? quality : null,
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
        const petNotes = notesForPet(pet.id);
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

    const healthType: HealthRecordType = mapFormTypeToHealthRecordType(type);
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

    if (type === "hygiene") {
      const hygiene = buildHygieneFieldsList(
        formData.getAll("hygiene_subtype").map((item) => String(item)),
        value(formData, "hygiene_custom_label"),
      );
      if (!hygiene.ok) failHere(hygiene.message);
      const hygieneItems = hygiene.ok ? hygiene.items : [];
      for (const pet of pets) {
        const petNotes = notesForPet(pet.id);
        for (const fields of hygieneItems) {
          const stableId = hygieneItems.length === 1 && pets.length === 1
            ? readStableRecordIdForPet(formData, pet.id, pets.map((row) => row.id))
            : null;
          let recordId: string | null = null;
          let reused = false;

          if (stableId) {
            const { data: existing } = await supabase
              .from("health_records")
              .select("id, household_id, pet_id")
              .eq("id", stableId)
              .maybeSingle();
            const ownership = resolveHealthRecordCreateOwnership(stableId, household.id, pet.id, existing);
            if (!ownership.ok) failHere("Não foi possível reutilizar este registro.");
            else if (ownership.status === "reuse") {
              recordId = stableId;
              reused = true;
            }
          }

          if (!reused) {
            const insertPayload: Record<string, unknown> = {
              household_id: household.id,
              pet_id: pet.id,
              type: "hygiene",
              title: hygieneRecordTitle(fields.hygiene_subtype, fields.hygiene_custom_label),
              occurred_at: occurredAt,
              clinic_or_vet: null,
              notes: petNotes,
              hygiene_subtype: fields.hygiene_subtype,
              hygiene_custom_label: fields.hygiene_custom_label,
            };
            if (stableId) insertPayload.id = stableId;
            const { data, error } = await supabase.from("health_records").insert(insertPayload).select("id").single();
            if (error) {
              if (stableId) {
                const { data: again } = await supabase
                  .from("health_records")
                  .select("id, household_id, pet_id")
                  .eq("id", stableId)
                  .maybeSingle();
                const retry = resolveHealthRecordCreateOwnership(stableId, household.id, pet.id, again);
                if (retry.ok && retry.status === "reuse") {
                  recordId = stableId;
                } else {
                  failHere(error.message);
                }
              } else {
                failHere(error.message);
              }
            } else {
              recordId = data.id;
            }
          }

          if (!recordId) failHere("Não foi possível salvar o registro.");
          const hygieneRecordId = recordId as string;
          if (wantsAttachments && pets.length === 1 && hygieneItems.length === 1) {
            await ensureHealthRecordAttachments(supabase, household.id, hygieneRecordId, formData, failHere);
          }
          created += 1;
        }
      }
      continue;
    }

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
      const stableIdRaw = readStableRecordIdForPet(formData, pet.id, pets.map((row) => row.id));
      if (!stableIdRaw) failHere("Intenção de criação inválida. Recarregue a página.");
      const stableId = stableIdRaw as string;

      const { data: existing } = await supabase
        .from("health_records")
        .select("id, household_id, pet_id")
        .eq("id", stableId)
        .maybeSingle();
      const ownership = resolveHealthRecordCreateOwnership(stableId, household.id, pet.id, existing);
      if (!ownership.ok) {
        failHere(
          ownership.reason === "foreign_household" || ownership.reason === "pet_mismatch"
            ? "Não foi possível reutilizar este registro."
            : "Intenção de criação inválida. Recarregue a página.",
        );
      }

      let recordId = stableId;
      let reused = ownership.ok && ownership.status === "reuse";

      if (type === "vaccine" && isProtocolVaccineKey(vaccineKey) && doseLabel && !reused) {
        const existingDose = await findExistingVaccineDose(supabase, pet.id, vaccineKey, doseLabel);
        if (existingDose) failHere("Esta dose já está registrada como aplicada.");
      }

      const petNotes = notesForPet(pet.id);
      if (!reused) {
        const { data, error } = await supabase.from("health_records").insert({
          id: stableId,
          household_id: household.id,
          pet_id: pet.id,
          type: healthType,
          title,
          occurred_at: occurredAt,
          clinic_or_vet: clinicOrVet,
          notes: petNotes,
          hygiene_subtype: null,
          hygiene_custom_label: null,
        }).select("id").single();
        if (error) {
          const { data: again } = await supabase
            .from("health_records")
            .select("id, household_id, pet_id")
            .eq("id", stableId)
            .maybeSingle();
          const retry = resolveHealthRecordCreateOwnership(stableId, household.id, pet.id, again);
          if (retry.ok && retry.status === "reuse") {
            reused = true;
            recordId = stableId;
          } else {
            failHere(error.message);
          }
        } else {
          recordId = data.id;
        }
      }

      created += 1;

      if (type === "vaccine" && isProtocolVaccineKey(vaccineKey) && doseLabel) {
        try {
          const linked = await findVaccineDoseByHealthRecordId(supabase, recordId, household.id);
          if (!linked) {
            const existingDose = await findExistingVaccineDose(supabase, pet.id, vaccineKey, doseLabel);
            if (existingDose && existingDose.health_record_id !== recordId) {
              if (!reused) {
                await supabase.from("health_records").delete().eq("id", recordId).eq("household_id", household.id);
              }
              failHere("Esta dose já está registrada como aplicada.");
            }
            if (!existingDose) {
              await insertVaccineDose(supabase, {
                householdId: household.id,
                petId: pet.id,
                healthRecordId: recordId,
                vaccineKey,
                doseLabel,
                administeredAt: occurredAt as string,
                clinicOrVet,
                notes: petNotes,
              });
            }
          }
        } catch (cause) {
          if (!reused) {
            await supabase.from("health_records").delete().eq("id", recordId).eq("household_id", household.id);
          }
          const message = cause instanceof Error ? cause.message : "Não foi possível atualizar a prevenção.";
          failHere(message);
        }
      }

      if (reminderAt && !multi) {
        const { data: existingReminder } = await supabase
          .from("reminders")
          .select("id")
          .eq("health_record_id", recordId)
          .eq("household_id", household.id)
          .maybeSingle();
        if (!existingReminder) {
          const prefix = reminderTitles[type] ?? "Cuidado de";
          await supabase.from("reminders").insert({
            household_id: household.id,
            pet_id: pet.id,
            health_record_id: recordId,
            title: `${prefix} ${pet.name}`,
            category: type,
            due_at: reminderAt,
          });
        }
      }

      if (wantsAttachments && pets.length === 1) {
        await ensureHealthRecordAttachments(supabase, household.id, recordId, formData, failHere);
      }
    }
  }

  const petIdList = pets.map((pet) => pet.id);
  revalidateRecordPaths(petIdList);
  redirectAfterSave(returnTo, petIdList, created, neonatalContext);
}
