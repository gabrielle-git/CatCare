"use client";

import { useEffect, useMemo, useState } from "react";
import { Bug, Bath, ClipboardPlus, Droplets, FlaskConical, Milk, Pill, Scale, Stethoscope, Syringe, Thermometer, type LucideIcon } from "lucide-react";
import { FactualDateTimeInput } from "@/components/factual-datetime-input";
import { HealthRecordAttachmentsFields } from "@/components/health-record-attachments-fields";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { SubmitButton } from "@/components/submit-button";
import { attachmentHeadingForCareType } from "@/lib/health-record-attachment-form";
import { isAttachableQuickRecordType } from "@/lib/health-record-type";
import type { AttachmentWithUrl } from "@/types/database";
import { gramsToKgInput } from "@/lib/format";
import { HYGIENE_PRESETS, type HygieneSubtypeKey } from "@/lib/hygiene-care";
import {
  FEEDING_CARE_PRESETS,
  countFeedingAwareCreateRecords,
  feedingAmountOverridePetFieldName,
  feedingAmountUnitOtherFieldName,
  feedingAmountUnitPresetFieldName,
  feedingAmountValueFieldName,
  feedingEditItemAmountUnitOtherFieldName,
  feedingEditItemAmountUnitPresetFieldName,
  feedingEditItemAmountValueFieldName,
  feedingEditItemCustomLabelFieldName,
  feedingEditItemSubtypeFieldName,
  feedingOverrideAmountUnitOtherFieldName,
  feedingOverrideAmountUnitPresetFieldName,
  feedingOverrideAmountValueFieldName,
  unitPresetFromStoredUnit,
  type FeedingCareSubtypeKey,
  type FeedingItemFields,
} from "@/lib/feeding-care";
import { WEIGHT_KG_LEGACY_FIELD, weightKgFieldName } from "@/lib/record-field-names";
import { validateCreateRecordForm } from "@/lib/record-form-validation";
import { isNeonatalCareType, toLocalDateTimeInput } from "@/lib/record-form";
import {
  dosesForVaccineKey,
  formatVaccineRecordTitle,
  isProtocolVaccineKey,
  listSelectableVaccines,
  vaccineDisplayName,
} from "@/lib/vaccine-schedule";
import {
  FEEDING_SUBTYPES,
  FEEDING_SUBTYPE_LABELS,
  FEEDING_UNIT_PRESET_LABELS,
  FEEDING_UNIT_PRESETS,
  isLegacyFeedingAmount,
  notesFieldNameForPet,
  notesTargetPetFieldName,
  resolveFeedingAmount,
  showPerPetNotesToggle,
  syncPerPetNotesTargets,
  type FeedingUnitPreset,
} from "@/lib/neonatal-feeding";
import type { FeedingItem } from "@/types/database";
import type { QuickRecordType } from "@/components/record-fields-types";

export type { QuickRecordType } from "@/components/record-fields-types";

type PetOption = { id: string; name: string; neonatal: boolean; species?: string | null };
type RecordOption = { value: QuickRecordType; label: string; shortLabel: string; icon: LucideIcon; neonatal?: boolean };

const options: RecordOption[] = [
  { value: "weight", label: "Pesagem", shortLabel: "Peso", icon: Scale },
  { value: "feeding", label: "Alimentação", shortLabel: "Alim.", icon: Milk },
  { value: "urine", label: "Xixi", shortLabel: "Xixi", icon: Droplets, neonatal: true },
  { value: "stool", label: "Cocô", shortLabel: "Cocô", icon: Droplets, neonatal: true },
  { value: "temperature", label: "Temperatura", shortLabel: "Temp.", icon: Thermometer, neonatal: true },
  { value: "vaccine", label: "Vacina", shortLabel: "Vacina", icon: Syringe },
  { value: "deworming", label: "Vermífugo", shortLabel: "Vermíf.", icon: Bug },
  { value: "medication", label: "Medicamento", shortLabel: "Remédio", icon: Pill },
  { value: "consultation", label: "Consulta", shortLabel: "Consulta", icon: Stethoscope },
  { value: "exam", label: "Exame", shortLabel: "Exame", icon: FlaskConical },
  { value: "hygiene", label: "Cuidados de higiene", shortLabel: "Higiene", icon: Bath },
  { value: "observation", label: "Observação", shortLabel: "Nota", icon: ClipboardPlus },
];

const optionByType = Object.fromEntries(options.map((option) => [option.value, option])) as Record<QuickRecordType, RecordOption>;

function currentLocalDateTime() {
  return toLocalDateTimeInput(new Date().toISOString());
}

function neonatalPetPool(pets: PetOption[]) {
  return pets.filter((pet) => pet.neonatal);
}

function resolvePetSelection(
  pets: PetOption[],
  candidateIds: string[],
  restrictToNeonatal: boolean,
  preferredId?: string,
  autoPick = true,
) {
  const pool = restrictToNeonatal ? neonatalPetPool(pets) : pets;
  const poolIds = new Set(pool.map((pet) => pet.id));
  const kept = candidateIds.filter((id) => poolIds.has(id));
  if (kept.length > 0) return kept;
  if (preferredId && poolIds.has(preferredId)) return [preferredId];
  if (!autoPick) return [];
  if (pool[0]?.id) return [pool[0].id];
  return [];
}

function QualitySelect({
  name,
  label,
  disabled,
  defaultValue,
  allowEmpty = false,
}: {
  name: string;
  label: string;
  disabled: boolean;
  defaultValue?: string | null;
  allowEmpty?: boolean;
}) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <select disabled={disabled} name={name} defaultValue={defaultValue ?? (allowEmpty ? "" : "normal")} className="field mt-2">
        {allowEmpty ? <option value="">Não informar</option> : null}
        <option value="normal">Normal</option>
        <option value="good">Foi bem</option>
        <option value="little">Pouquinho</option>
        <option value="difficult">Com dificuldade</option>
        <option value="attention">Precisa de atenção</option>
      </select>
    </label>
  );
}

export type RecordFieldDefaults = {
  pet_id: string;
  record_type: QuickRecordType;
  occurred_at: string;
  notes?: string | null;
  title?: string;
  clinic_or_vet?: string | null;
  hygiene_subtype?: string | null;
  hygiene_custom_label?: string | null;
  weight_grams?: number;
  amount_ml?: number | null;
  feeding_subtype?: string | null;
  feeding_amount_value?: number | null;
  feeding_amount_unit?: string | null;
  feeding_items?: FeedingItem[] | FeedingItemFields[] | null;
  temperature_c?: number | null;
  quality?: string | null;
  vaccine_key?: string | null;
  dose_label?: string | null;
};

function initialFeedingFormState(defaults?: RecordFieldDefaults) {
  const resolved = defaults
    ? resolveFeedingAmount({
        type: "feeding",
        amount_ml: defaults.amount_ml ?? null,
        feeding_subtype: defaults.feeding_subtype ?? null,
        feeding_amount_value: defaults.feeding_amount_value ?? null,
        feeding_amount_unit: defaults.feeding_amount_unit ?? null,
      })
    : null;
  const unit = resolved?.unit ?? "";
  const preset: FeedingUnitPreset =
    unit === "ml" || unit === "g" || unit === "spoon" ? unit : unit ? "other" : "ml";
  return {
    subtype: defaults?.feeding_subtype ?? "",
    amount: resolved != null ? String(resolved.value) : "",
    unitPreset: preset,
    unitOther: preset === "other" ? unit : "",
    legacyWithoutSubtype: Boolean(
      defaults
      && isLegacyFeedingAmount({
        type: "feeding",
        amount_ml: defaults.amount_ml ?? null,
        feeding_subtype: defaults.feeding_subtype ?? null,
        feeding_amount_value: defaults.feeding_amount_value ?? null,
        feeding_amount_unit: defaults.feeding_amount_unit ?? null,
      }),
    ),
  };
}

export function RecordFields({
  pets,
  initialPetId,
  initialType,
  initialTypes,
  initialTitle,
  initialLockType,
  initialVaccineKey,
  initialDoseLabel,
  returnTo,
  neonatalContext = false,
  disabled = false,
  mode = "create",
  allowTypeChange = false,
  defaultValues,
  submitLabel = "Salvar registro",
  existingAttachments = [],
}: {
  pets: PetOption[];
  initialPetId?: string;
  initialType?: string;
  initialTypes?: string[];
  initialTitle?: string;
  initialLockType?: string;
  initialVaccineKey?: string;
  initialDoseLabel?: string;
  returnTo?: string;
  neonatalContext?: boolean;
  disabled?: boolean;
  mode?: "create" | "edit";
  /** When true in edit mode, user can change the care type (health records only). */
  allowTypeChange?: boolean;
  defaultValues?: RecordFieldDefaults;
  submitLabel?: string;
  existingAttachments?: AttachmentWithUrl[];
}) {
  const neonatalPets = useMemo(() => neonatalPetPool(pets), [pets]);
  const petNames = useMemo(() => new Map(pets.map((pet) => [pet.id, pet.name])), [pets]);

  const parsedInitialTypes = useMemo(() => {
    const fromList = (initialTypes ?? [])
      .flatMap((item) => item.split(","))
      .map((item) => item.trim())
      .filter((item): item is QuickRecordType => options.some((option) => option.value === item));
    if (fromList.length > 0) return fromList;
    if (initialType && options.some((option) => option.value === initialType)) {
      return [initialType as QuickRecordType];
    }
    if (defaultValues?.record_type) return [defaultValues.record_type];
    return [] as QuickRecordType[];
  }, [defaultValues?.record_type, initialType, initialTypes]);

  const fallbackType: QuickRecordType = neonatalContext ? "feeding" : "weight";
  const validInitial = parsedInitialTypes[0] ?? fallbackType;

  const [selectedTypes, setSelectedTypes] = useState<QuickRecordType[]>(() => {
    if (parsedInitialTypes.length > 0) return parsedInitialTypes;
    if (neonatalContext) return ["feeding"];
    return [];
  });

  const suggestedTitle = initialTitle ?? (validInitial === "deworming" ? "Vermífugo" : "");
  const [title, setTitle] = useState(defaultValues?.title ?? suggestedTitle);
  const [vaccineKey, setVaccineKey] = useState(() => {
    const fromDefaults = defaultValues?.vaccine_key;
    const fromUrl = initialVaccineKey;
    const candidate = fromUrl || fromDefaults || "";
    if (candidate && (isProtocolVaccineKey(candidate) || candidate === "other")) return candidate;
    // Legacy vaccine edit without structured link — treat as free-form, do not invent a protocol dose.
    if (mode === "edit" && (defaultValues?.record_type === "vaccine" || validInitial === "vaccine")) return "other";
    return "";
  });
  const [doseLabel, setDoseLabel] = useState(initialDoseLabel ?? defaultValues?.dose_label ?? "");
  const [weightKg, setWeightKg] = useState(() =>
    defaultValues?.weight_grams != null ? gramsToKgInput(defaultValues.weight_grams) : "",
  );
  const [weightKgByPetId, setWeightKgByPetId] = useState<Record<string, string>>({});
  const initialFeeding = useMemo(() => initialFeedingFormState(defaultValues), [defaultValues]);
  const [feedingSubtype, setFeedingSubtype] = useState(initialFeeding.subtype);
  const [feedingAmountValue, setFeedingAmountValue] = useState(initialFeeding.amount);
  const [feedingUnitPreset, setFeedingUnitPreset] = useState<FeedingUnitPreset>(initialFeeding.unitPreset);
  const [feedingUnitOther, setFeedingUnitOther] = useState(initialFeeding.unitOther);
  const [temperatureC, setTemperatureC] = useState(defaultValues?.temperature_c?.toString() ?? "");
  const [hygieneSubtypes, setHygieneSubtypes] = useState<HygieneSubtypeKey[]>(() => {
    const initial = defaultValues?.hygiene_subtype?.trim();
    return initial && (HYGIENE_PRESETS.some((preset) => preset.key === initial))
      ? [initial as HygieneSubtypeKey]
      : [];
  });
  const [hygieneCustomLabel, setHygieneCustomLabel] = useState(defaultValues?.hygiene_custom_label ?? "");
  const hygieneMultiSelect = mode === "create";
  const hygieneSubtype = hygieneSubtypes[0] ?? "";
  /** Create always uses sessions; edit uses sessions when feeding_items are loaded. */
  const useSessionFeedingUi = mode === "create" || Boolean(defaultValues?.feeding_items?.length);
  const [feedingComponents, setFeedingComponents] = useState<FeedingCareSubtypeKey[]>([]);
  const [feedingCustomLabel, setFeedingCustomLabel] = useState("");
  const [feedingAmounts, setFeedingAmounts] = useState<Record<string, { value: string; unitPreset: FeedingUnitPreset; unitOther: string }>>({});
  const [feedingAmountOverridesEnabled, setFeedingAmountOverridesEnabled] = useState(false);
  const [feedingOverridePets, setFeedingOverridePets] = useState<string[]>([]);
  const [feedingOverrideAmounts, setFeedingOverrideAmounts] = useState<
    Record<string, Record<string, { value: string; unitPreset: FeedingUnitPreset; unitOther: string }>>
  >({});
  /** Stable health_record ids: petId → careType → uuid (create idempotency). */
  const [recordIdsByPetType, setRecordIdsByPetType] = useState<Record<string, Record<string, string>>>({});
  type EditFeedingRow = {
    key: string;
    subtype: FeedingCareSubtypeKey | "";
    customLabel: string;
    value: string;
    unitPreset: FeedingUnitPreset;
    unitOther: string;
  };
  const [editFeedingRows, setEditFeedingRows] = useState<EditFeedingRow[]>(() => {
    const items = defaultValues?.feeding_items;
    if (!items?.length) {
      return [{ key: "0", subtype: "", customLabel: "", value: "", unitPreset: "ml", unitOther: "" }];
    }
    return items.map((item, index) => {
      const unit = unitPresetFromStoredUnit(item.amount_unit);
      return {
        key: String(index),
        subtype: (FEEDING_CARE_PRESETS.some((p) => p.key === item.subtype) ? item.subtype : "") as FeedingCareSubtypeKey | "",
        customLabel: item.custom_label ?? "",
        value: item.amount_value != null ? String(item.amount_value) : "",
        unitPreset: unit.preset,
        unitOther: unit.other,
      };
    });
  });
  const [perPetNotesEnabled, setPerPetNotesEnabled] = useState(false);
  const [perPetNotesTargets, setPerPetNotesTargets] = useState<string[]>([]);
  const [perPetNotesDraft, setPerPetNotesDraft] = useState<Record<string, string>>({});

  const lockTitleFromUrl = mode === "create" && Boolean(initialTitle);
  const lockVaccineFromUrl = mode === "create" && isProtocolVaccineKey(initialVaccineKey ?? "") && Boolean(initialDoseLabel);
  const lockTypeFromUrl = mode === "create" && (initialLockType === "1" || initialLockType === "true" || lockTitleFromUrl || lockVaccineFromUrl);
  const lockedType = lockTypeFromUrl || (mode === "edit" && !allowTypeChange);
  const allowMultiType = mode === "create" && !lockedType;
  const activeTypes = lockedType ? [validInitial] : selectedTypes;
  const primaryType = activeTypes[0] ?? fallbackType;
  const multiType = activeTypes.length > 1;

  const restrictToNeonatal = neonatalContext || activeTypes.some(isNeonatalCareType);
  const hasExplicitPet = Boolean(initialPetId || defaultValues?.pet_id);

  const basePetIds = defaultValues?.pet_id
    ? [defaultValues.pet_id]
    : initialPetId && pets.some((pet) => pet.id === initialPetId)
      ? [initialPetId]
      : [];

  const [selectedPetIds, setSelectedPetIds] = useState<string[]>(() =>
    resolvePetSelection(pets, basePetIds, restrictToNeonatal, initialPetId, hasExplicitPet),
  );

  const visiblePets = useMemo(() => {
    if (mode === "edit" && defaultValues?.pet_id) {
      return pets.filter((pet) => pet.id === defaultValues.pet_id);
    }
    if (neonatalContext || activeTypes.some(isNeonatalCareType)) {
      return neonatalPets;
    }
    return pets;
  }, [activeTypes, defaultValues?.pet_id, mode, neonatalContext, neonatalPets, pets]);

  const visibleSelectedIds = useMemo(
    () => selectedPetIds.filter((id) => visiblePets.some((pet) => pet.id === id)),
    [selectedPetIds, visiblePets],
  );

  const vaccineFormSpecies = useMemo(() => {
    const selected = pets.filter((pet) => visibleSelectedIds.includes(pet.id));
    if (selected.length === 0) return "cat";
    const normalized = selected.map((pet) => (pet.species ?? "cat").trim().toLowerCase() || "cat");
    const first = normalized[0];
    return normalized.every((value) => value === first) ? first : null;
  }, [pets, visibleSelectedIds]);
  const selectableVaccines = useMemo(
    () => listSelectableVaccines({ species: vaccineFormSpecies, coreVaccineKey: "v4" }),
    [vaccineFormSpecies],
  );
  const vaccineDoseOptions = useMemo(
    () => (isProtocolVaccineKey(vaccineKey) ? dosesForVaccineKey(vaccineKey) : []),
    [vaccineKey],
  );

  const droppedPetNames = useMemo(() => {
    if (!restrictToNeonatal) return [] as string[];
    return selectedPetIds
      .filter((id) => !visiblePets.some((pet) => pet.id === id))
      .map((id) => petNames.get(id))
      .filter((name): name is string => Boolean(name));
  }, [petNames, restrictToNeonatal, selectedPetIds, visiblePets]);

  const occurredDefault = defaultValues?.occurred_at ? toLocalDateTimeInput(defaultValues.occurred_at) : currentLocalDateTime();
  const noNeonatalPets = restrictToNeonatal && visiblePets.length === 0;
  const hasHealthType = activeTypes.some((type) =>
    type === "vaccine" || type === "deworming" || type === "medication" || type === "consultation" || type === "exam" || type === "observation" || type === "hygiene",
  );
  const hasReminderType = !multiType && activeTypes.some((type) =>
    type === "vaccine" || type === "deworming" || type === "medication" || type === "consultation",
  );
  const hygieneOnly = activeTypes.length === 1 && activeTypes[0] === "hygiene";
  const recordCount = countFeedingAwareCreateRecords(activeTypes, visibleSelectedIds.length, hygieneSubtypes.length);
  const createAttachmentsAllowed =
    mode === "create"
    && visibleSelectedIds.length === 1
    && activeTypes.some((type) => isAttachableQuickRecordType(type));
  const editAttachmentsAllowed =
    mode === "edit"
    && activeTypes.length === 1
    && isAttachableQuickRecordType(activeTypes[0] ?? "");
  const resolvedSubmitLabel = mode === "edit"
    ? submitLabel
    : recordCount > 1
      ? `Salvar ${recordCount} registros`
      : submitLabel;

  const validationMessage = useMemo(() => {
    const sessionItems = useSessionFeedingUi && mode === "edit"
      ? editFeedingRows.map((row) => {
          const trimmed = row.value.trim();
          const amount_value = trimmed ? Number(trimmed.replace(",", ".")) : null;
          const amount_unit = !trimmed
            ? null
            : row.unitPreset === "other"
              ? (row.unitOther.trim() || null)
              : row.unitPreset;
          return {
            subtype: row.subtype,
            custom_label: row.subtype === "other" ? row.customLabel : null,
            amount_value: amount_value != null && Number.isFinite(amount_value) ? amount_value : (trimmed ? NaN : null),
            amount_unit,
          };
        })
      : null;
    const base = validateCreateRecordForm({
      petIds: visibleSelectedIds,
      types: activeTypes,
      weightKg,
      weightKgByPetId,
      feedingSubtype,
      feedingAmountValue,
      feedingUnitPreset,
      feedingUnitOther,
      allowLegacyFeedingWithoutSubtype: mode === "edit" && !useSessionFeedingUi && initialFeeding.legacyWithoutSubtype && !feedingSubtype,
      feedingSessionMode: useSessionFeedingUi && activeTypes.includes("feeding"),
      feedingSubtypes: useSessionFeedingUi && mode === "create" ? feedingComponents : undefined,
      feedingCustomLabel: useSessionFeedingUi ? feedingCustomLabel : undefined,
      feedingSessionItems: sessionItems,
      temperatureC,
      hygieneSubtype,
      hygieneSubtypes: hygieneMultiSelect ? hygieneSubtypes : undefined,
      hygieneCustomLabel,
      petNames,
    });
    if (base) return base;
    if (mode === "create" && activeTypes.includes("vaccine")) {
      if (!vaccineKey) return "Escolha qual vacina foi aplicada.";
      if (vaccineKey !== "other" && !doseLabel) return "Escolha a dose aplicada.";
      if (vaccineKey === "other" && !title.trim()) return "Informe o nome da vacina.";
    }
    if (mode === "edit" && activeTypes.includes("vaccine")) {
      if (!vaccineKey) return "Escolha qual vacina foi aplicada.";
      if (vaccineKey !== "other" && !doseLabel) return "Escolha a dose aplicada.";
      if (vaccineKey === "other" && !title.trim()) return "Informe o nome da vacina.";
    }
    return null;
  }, [activeTypes, doseLabel, editFeedingRows, feedingAmountValue, feedingComponents, feedingCustomLabel, feedingSubtype, feedingUnitOther, feedingUnitPreset, hygieneCustomLabel, hygieneMultiSelect, hygieneSubtype, hygieneSubtypes, initialFeeding.legacyWithoutSubtype, mode, petNames, temperatureC, title, useSessionFeedingUi, vaccineKey, visibleSelectedIds, weightKg, weightKgByPetId]);

  const submitBlocked = disabled || visiblePets.length === 0 || validationMessage !== null;

  useEffect(() => {
    if (initialTitle) {
      setTitle(initialTitle);
      return;
    }
    if (validInitial === "deworming") setTitle("Vermífugo");
  }, [initialTitle, validInitial]);

  useEffect(() => {
    if (!isProtocolVaccineKey(vaccineKey) || !doseLabel) return;
    setTitle(formatVaccineRecordTitle(vaccineKey, doseLabel));
  }, [doseLabel, vaccineKey]);

  useEffect(() => {
    if (mode !== "create" || lockedType) return;
    setSelectedPetIds((prev) => resolvePetSelection(
      pets,
      prev,
      neonatalContext || activeTypes.some(isNeonatalCareType),
      initialPetId,
      hasExplicitPet,
    ));
  }, [activeTypes, hasExplicitPet, initialPetId, lockedType, mode, neonatalContext, pets]);

  useEffect(() => {
    setWeightKgByPetId((prev) => {
      const next = { ...prev };
      for (const id of visibleSelectedIds) {
        if (!(id in next)) next[id] = "";
      }
      return next;
    });
  }, [visibleSelectedIds]);

  useEffect(() => {
    if (mode !== "create") return;
    setRecordIdsByPetType((prev) => {
      const next: Record<string, Record<string, string>> = {};
      for (const petId of visibleSelectedIds) {
        const prevPet = prev[petId] ?? {};
        const nextPet: Record<string, string> = {};
        for (const type of activeTypes) {
          nextPet[type] = prevPet[type] ?? crypto.randomUUID();
        }
        next[petId] = nextPet;
      }
      return next;
    });
  }, [mode, visibleSelectedIds, activeTypes]);

  useEffect(() => {
    if (!showPerPetNotesToggle(mode, visibleSelectedIds.length)) {
      setPerPetNotesEnabled(false);
      setPerPetNotesTargets([]);
      setPerPetNotesDraft({});
      return;
    }
    setPerPetNotesTargets((prev) => syncPerPetNotesTargets(visibleSelectedIds, prev));
    setPerPetNotesDraft((prev) => {
      const allowed = new Set(visibleSelectedIds);
      const next: Record<string, string> = {};
      for (const [id, text] of Object.entries(prev)) {
        if (allowed.has(id)) next[id] = text;
      }
      return next;
    });
  }, [mode, visibleSelectedIds]);

  const toggleType = (value: QuickRecordType) => {
    if (disabled) return;
    if (mode === "edit" || !allowMultiType) {
      setSelectedTypes([value]);
      if (value !== "vaccine") {
        setVaccineKey("");
        setDoseLabel("");
      }
      return;
    }
    setSelectedTypes((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const clearTypes = () => {
    if (disabled) return;
    setSelectedTypes([]);
  };

  const petHint = mode === "create"
    ? neonatalContext
      ? "Modo neonatal — só filhotes com até 8 semanas aparecem aqui."
      : restrictToNeonatal
        ? "Só filhotes em fase neonatal aparecem para este tipo de cuidado."
        : "Pode escolher mais de um — o registro será criado para cada pet selecionado."
    : undefined;

  const weightUsesPerPetFields = mode === "create" && visibleSelectedIds.length > 1;

  function renderWeightFields() {
    if (weightUsesPerPetFields) {
      return (
        <div className="grid gap-4 sm:col-span-2">
          {visibleSelectedIds.map((petId) => (
            <label key={petId} className="block text-sm font-bold">
              Peso (kg) — {petNames.get(petId) ?? "Pet"}
              <input
                disabled={disabled}
                type="text"
                name={weightKgFieldName(petId)}
                inputMode="decimal"
                value={weightKgByPetId[petId] ?? ""}
                onChange={(event) => setWeightKgByPetId((prev) => ({ ...prev, [petId]: event.target.value }))}
                className="field mt-2"
                placeholder="Ex.: 4,2"
                aria-required="true"
              />
            </label>
          ))}
        </div>
      );
    }

    const singlePetId = visibleSelectedIds[0];
    const label = mode === "edit"
      ? "Peso (kg)"
      : singlePetId
        ? `Peso (kg)${petNames.get(singlePetId) ? ` — ${petNames.get(singlePetId)}` : ""}`
        : "Peso (kg)";

    return (
      <label className="block text-sm font-bold">
        {label}
        <input
          disabled={disabled}
          type="text"
          name={WEIGHT_KG_LEGACY_FIELD}
          inputMode="decimal"
          value={weightKg}
          onChange={(event) => setWeightKg(event.target.value)}
          className="field mt-2"
          placeholder="Ex.: 4,2"
          aria-required="true"
        />
      </label>
    );
  }

  return (
    <>
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      {mode === "create" && Object.keys(recordIdsByPetType).length > 0 ? (
        <input type="hidden" name="record_ids_json" value={JSON.stringify(recordIdsByPetType)} />
      ) : null}
      {neonatalContext ? <input type="hidden" name="context" value="neonatal" /> : null}
      <input type="hidden" name="record_types" value={activeTypes.join(",")} />
      {activeTypes.map((type) => (
        <input key={type} type="hidden" name="record_type" value={type} />
      ))}

      <section>
        <p className="text-sm font-bold">1. {mode === "edit" ? "Pet" : "Quais pets?"}</p>
        <div className="mt-2">
          {noNeonatalPets ? (
            <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">
              Nenhum filhote com até 8 semanas no momento.
            </p>
          ) : (
            <PetMultiSelect
              key={`${visiblePets.map((pet) => pet.id).join(",")}-${visibleSelectedIds.join(",")}`}
              pets={visiblePets}
              defaultSelectedIds={visibleSelectedIds}
              disabled={disabled || visiblePets.length === 0}
              multiple={mode === "create"}
              required
              legend=""
              hint={petHint}
              onSelectionChange={setSelectedPetIds}
            />
          )}
        </div>
        {droppedPetNames.length > 0 && (
          <p className="mt-2 text-xs font-semibold text-[#9a536c]" role="status">
            {droppedPetNames.join(" e ")} {droppedPetNames.length === 1 ? "foi desmarcado" : "foram desmarcados"} — xixi, cocô e temperatura só valem para filhotes.
          </p>
        )}
        {mode === "create" && recordCount > 1 && visibleSelectedIds.length > 0 && activeTypes.length > 0 && (
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]" role="status">
            {recordCount} registros serão criados
            {activeTypes.includes("hygiene") && hygieneSubtypes.length > 0
              ? ` (${visibleSelectedIds.length} ${visibleSelectedIds.length === 1 ? "pet" : "pets"} × ${hygieneSubtypes.length} ${hygieneSubtypes.length === 1 ? "cuidado" : "cuidados"}${activeTypes.length > 1 ? ` + outros tipos` : ""})`
              : activeTypes.includes("feeding") && feedingComponents.length > 0 && activeTypes.length === 1
                ? ` (${visibleSelectedIds.length} ${visibleSelectedIds.length === 1 ? "refeição" : "refeições"})`
                : ` (${visibleSelectedIds.length} ${visibleSelectedIds.length === 1 ? "pet" : "pets"} × ${activeTypes.length} ${activeTypes.length === 1 ? "tipo" : "tipos"})`}
            .
          </p>
        )}
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-sm font-bold">2. O que aconteceu?</p>
          {allowMultiType && (
            <p className="text-[11px] font-semibold text-[var(--muted)]">Você pode registrar vários cuidados de uma vez</p>
          )}
        </div>
        {lockedType ? (
          <p className="mt-2 rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">{optionByType[primaryType]?.label ?? primaryType}</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Tipo de cuidado">
            {options.map(({ value, shortLabel, icon: Icon }) => {
              const active = selectedTypes.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleType(value)}
                  aria-pressed={active}
                  className={`focus-ring flex min-h-20 flex-col items-center justify-center gap-2 rounded-[18px] border px-2 text-xs font-bold transition ${
                    active
                      ? "border-[var(--lavender)] bg-[var(--lavender-soft)] text-[var(--lavender-strong)]"
                      : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--lavender)]/40"
                  }`}
                >
                  <Icon size={19} aria-hidden /> {shortLabel}
                </button>
              );
            })}
          </div>
        )}
        {allowMultiType && activeTypes.length >= 2 && (
          <div className="mt-3 rounded-[14px] bg-[var(--cream)] px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--muted)]">
                {activeTypes.length} cuidados selecionados
              </p>
              <button
                type="button"
                disabled={disabled}
                onClick={clearTypes}
                className="focus-ring text-[11px] font-bold text-[var(--lavender-strong)] underline disabled:opacity-50"
              >
                Limpar seleção
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activeTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-full bg-[var(--lavender-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--lavender-strong)]"
                >
                  {optionByType[type]?.shortLabel ?? type}
                </span>
              ))}
            </div>
          </div>
        )}
        {allowMultiType && activeTypes.length === 0 && (
          <p className="mt-3 rounded-[14px] border border-dashed border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
            Nenhum tipo selecionado — toque em uma ou mais opções acima para abrir o formulário.
          </p>
        )}
      </section>

      <section className="mt-6 space-y-4">
        {activeTypes.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
            Escolha o que aconteceu para preencher os detalhes.
          </div>
        ) : (
          activeTypes.map((type) => {
            const meta = optionByType[type];
            const showCard = multiType;
            const qualityName = multiType ? `quality_${type}` : "quality";
            const titleName = multiType ? `title_${type}` : "title";
            const healthType = type === "vaccine" || type === "deworming" || type === "medication" || type === "consultation" || type === "exam" || type === "observation";

            const fields = (
              <div className="grid gap-4 sm:grid-cols-2">
                {type === "weight" && renderWeightFields()}
                {type === "feeding" && useSessionFeedingUi && mode === "create" && (
                  <div className="sm:col-span-2 space-y-3">
                    <div>
                      <p className="text-sm font-bold">O que eles comeram?</p>
                      <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">Pode escolher mais de um. Quantidade é opcional.</p>
                      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Componentes da refeição" aria-multiselectable>
                        {FEEDING_CARE_PRESETS.map((preset) => {
                          const active = feedingComponents.includes(preset.key);
                          return (
                            <button
                              key={preset.key}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setFeedingComponents((prev) => {
                                  if (prev.includes(preset.key)) {
                                    const next = prev.filter((key) => key !== preset.key);
                                    if (preset.key === "other") setFeedingCustomLabel("");
                                    setFeedingAmounts((amounts) => {
                                      const copy = { ...amounts };
                                      delete copy[preset.key];
                                      return copy;
                                    });
                                    return next;
                                  }
                                  setFeedingAmounts((amounts) => ({
                                    ...amounts,
                                    [preset.key]: amounts[preset.key] ?? { value: "", unitPreset: "ml", unitOther: "" },
                                  }));
                                  return [...prev, preset.key];
                                });
                              }}
                              aria-pressed={active}
                              className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                                active
                                  ? "border-[var(--lavender)] bg-[var(--lavender-soft)] text-[var(--lavender-strong)]"
                                  : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--lavender)]/40"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                      {feedingComponents.map((key) => (
                        <input key={key} type="hidden" name="feeding_item_subtype" value={key} />
                      ))}
                    </div>
                    {feedingComponents.includes("other") && (
                      <label className="block text-sm font-bold">
                        Qual alimento?
                        <input
                          disabled={disabled}
                          name="feeding_custom_label"
                          value={feedingCustomLabel}
                          onChange={(event) => setFeedingCustomLabel(event.target.value)}
                          className="field mt-2"
                          placeholder="Ex.: Frango cozido"
                          aria-required="true"
                        />
                      </label>
                    )}
                    {feedingComponents.length > 0 && (
                      <div className="space-y-3 rounded-[18px] border border-[var(--border)] bg-white/70 p-3">
                        <p className="text-xs font-bold text-[var(--muted)]">Quantidades (opcional)</p>
                        {feedingComponents.map((key) => {
                          const preset = FEEDING_CARE_PRESETS.find((entry) => entry.key === key)!;
                          const amount = feedingAmounts[key] ?? { value: "", unitPreset: "ml" as FeedingUnitPreset, unitOther: "" };
                          return (
                            <div key={key} className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem]">
                              <p className="text-sm font-semibold self-center">{preset.label}</p>
                              <input
                                disabled={disabled}
                                type="number"
                                name={feedingAmountValueFieldName(key)}
                                min="0.1"
                                max="1000"
                                step="0.1"
                                inputMode="decimal"
                                value={amount.value}
                                onChange={(event) => setFeedingAmounts((prev) => ({
                                  ...prev,
                                  [key]: { ...amount, value: event.target.value },
                                }))}
                                className="field"
                                placeholder="Qtd"
                              />
                              <select
                                disabled={disabled}
                                name={feedingAmountUnitPresetFieldName(key)}
                                value={amount.unitPreset}
                                onChange={(event) => setFeedingAmounts((prev) => ({
                                  ...prev,
                                  [key]: { ...amount, unitPreset: event.target.value as FeedingUnitPreset },
                                }))}
                                className="field"
                              >
                                {FEEDING_UNIT_PRESETS.map((unit) => (
                                  <option key={unit} value={unit}>{FEEDING_UNIT_PRESET_LABELS[unit]}</option>
                                ))}
                              </select>
                              {amount.unitPreset === "other" && (
                                <input
                                  disabled={disabled}
                                  name={feedingAmountUnitOtherFieldName(key)}
                                  value={amount.unitOther}
                                  onChange={(event) => setFeedingAmounts((prev) => ({
                                    ...prev,
                                    [key]: { ...amount, unitOther: event.target.value },
                                  }))}
                                  className="field sm:col-span-3"
                                  placeholder="Qual unidade?"
                                  maxLength={32}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {visibleSelectedIds.length > 1 && feedingComponents.length > 0 && (
                      <div className="space-y-3">
                        <label className="flex cursor-pointer items-start gap-3 text-sm font-bold">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-[var(--graphite)]"
                            disabled={disabled}
                            checked={feedingAmountOverridesEnabled}
                            name={feedingAmountOverridesEnabled ? "include_feeding_amount_overrides" : undefined}
                            value="1"
                            onChange={(event) => {
                              const next = event.target.checked;
                              setFeedingAmountOverridesEnabled(next);
                              if (!next) {
                                setFeedingOverridePets([]);
                                setFeedingOverrideAmounts({});
                              }
                            }}
                          />
                          <span>
                            Quer ajustar as quantidades para algum pet?
                            <span className="mt-0.5 block text-xs font-semibold text-[var(--muted)]">
                              Por padrão, as quantidades acima valem para todos.
                            </span>
                          </span>
                        </label>
                        {feedingAmountOverridesEnabled && (
                          <section className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[var(--cream)]/40 p-4">
                            <p className="text-sm font-bold">Para qual pet?</p>
                            <div className="flex flex-wrap gap-2">
                              {visibleSelectedIds.map((petId) => {
                                const checked = feedingOverridePets.includes(petId);
                                return (
                                  <label
                                    key={petId}
                                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                                      checked
                                        ? "border-[var(--graphite)] bg-[var(--graphite)] text-white"
                                        : "border-[var(--border)] bg-white text-[var(--graphite)]"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      name={feedingAmountOverridePetFieldName()}
                                      value={petId}
                                      checked={checked}
                                      onChange={() => {
                                        setFeedingOverridePets((prev) =>
                                          prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId],
                                        );
                                      }}
                                    />
                                    {petNames.get(petId) ?? "Pet"}
                                  </label>
                                );
                              })}
                            </div>
                            {feedingOverridePets.map((petId) => (
                              <div key={petId} className="space-y-2 border-t border-[var(--border)] pt-3">
                                <p className="text-xs font-bold">{petNames.get(petId) ?? "Pet"}</p>
                                {feedingComponents.map((key) => {
                                  const preset = FEEDING_CARE_PRESETS.find((entry) => entry.key === key)!;
                                  const amount = feedingOverrideAmounts[petId]?.[key] ?? { value: "", unitPreset: "ml" as FeedingUnitPreset, unitOther: "" };
                                  return (
                                    <div key={key} className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem]">
                                      <p className="text-sm font-semibold self-center">{preset.label}</p>
                                      <input
                                        disabled={disabled}
                                        type="number"
                                        name={feedingOverrideAmountValueFieldName(petId, key)}
                                        min="0.1"
                                        max="1000"
                                        step="0.1"
                                        inputMode="decimal"
                                        value={amount.value}
                                        onChange={(event) => setFeedingOverrideAmounts((prev) => ({
                                          ...prev,
                                          [petId]: {
                                            ...(prev[petId] ?? {}),
                                            [key]: { ...amount, value: event.target.value },
                                          },
                                        }))}
                                        className="field"
                                        placeholder="Herdar"
                                      />
                                      <select
                                        disabled={disabled}
                                        name={feedingOverrideAmountUnitPresetFieldName(petId, key)}
                                        value={amount.unitPreset}
                                        onChange={(event) => setFeedingOverrideAmounts((prev) => ({
                                          ...prev,
                                          [petId]: {
                                            ...(prev[petId] ?? {}),
                                            [key]: { ...amount, unitPreset: event.target.value as FeedingUnitPreset },
                                          },
                                        }))}
                                        className="field"
                                      >
                                        {FEEDING_UNIT_PRESETS.map((unit) => (
                                          <option key={unit} value={unit}>{FEEDING_UNIT_PRESET_LABELS[unit]}</option>
                                        ))}
                                      </select>
                                      {amount.unitPreset === "other" && (
                                        <input
                                          disabled={disabled}
                                          name={feedingOverrideAmountUnitOtherFieldName(petId, key)}
                                          value={amount.unitOther}
                                          onChange={(event) => setFeedingOverrideAmounts((prev) => ({
                                            ...prev,
                                            [petId]: {
                                              ...(prev[petId] ?? {}),
                                              [key]: { ...amount, unitOther: event.target.value },
                                            },
                                          }))}
                                          className="field sm:col-span-3"
                                          placeholder="Qual unidade?"
                                          maxLength={32}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </section>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {type === "feeding" && useSessionFeedingUi && mode === "edit" && (
                  <div className="sm:col-span-2 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">Componentes da refeição</p>
                      <button
                        type="button"
                        disabled={disabled}
                        className="focus-ring text-[11px] font-bold text-[var(--lavender-strong)] underline disabled:opacity-50"
                        onClick={() => setEditFeedingRows((prev) => [
                          ...prev,
                          { key: `${Date.now()}`, subtype: "", customLabel: "", value: "", unitPreset: "ml", unitOther: "" },
                        ])}
                      >
                        Adicionar
                      </button>
                    </div>
                    {editFeedingRows.map((row, index) => (
                      <div key={row.key} className="space-y-2 rounded-[18px] border border-[var(--border)] bg-white/70 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <label className="block flex-1 text-sm font-bold">
                            Alimento
                            <select
                              disabled={disabled}
                              name={feedingEditItemSubtypeFieldName(index)}
                              value={row.subtype}
                              onChange={(event) => {
                                const next = event.target.value as FeedingCareSubtypeKey | "";
                                setEditFeedingRows((prev) => prev.map((item, i) => (
                                  i === index
                                    ? { ...item, subtype: next, customLabel: next === "other" ? item.customLabel : "" }
                                    : item
                                )));
                              }}
                              className="field mt-2"
                              aria-required="true"
                            >
                              <option value="" disabled>Escolha…</option>
                              {FEEDING_CARE_PRESETS.map((preset) => (
                                <option key={preset.key} value={preset.key}>{preset.label}</option>
                              ))}
                            </select>
                          </label>
                          {editFeedingRows.length > 1 && (
                            <button
                              type="button"
                              disabled={disabled}
                              className="focus-ring mt-7 text-[11px] font-bold text-[var(--danger)] underline disabled:opacity-50"
                              onClick={() => setEditFeedingRows((prev) => prev.filter((_, i) => i !== index))}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                        {row.subtype === "other" && (
                          <label className="block text-sm font-bold">
                            Qual alimento?
                            <input
                              disabled={disabled}
                              name={feedingEditItemCustomLabelFieldName(index)}
                              value={row.customLabel}
                              onChange={(event) => setEditFeedingRows((prev) => prev.map((item, i) => (
                                i === index ? { ...item, customLabel: event.target.value } : item
                              )))}
                              className="field mt-2"
                              placeholder="Ex.: Frango cozido"
                              aria-required="true"
                            />
                          </label>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="block text-sm font-bold">
                            Quantidade (opcional)
                            <input
                              disabled={disabled}
                              type="number"
                              name={feedingEditItemAmountValueFieldName(index)}
                              min="0.1"
                              max="1000"
                              step="0.1"
                              inputMode="decimal"
                              value={row.value}
                              onChange={(event) => setEditFeedingRows((prev) => prev.map((item, i) => (
                                i === index ? { ...item, value: event.target.value } : item
                              )))}
                              className="field mt-2"
                              placeholder="Ex.: 25"
                            />
                          </label>
                          <label className="block text-sm font-bold">
                            Unidade
                            <select
                              disabled={disabled}
                              name={feedingEditItemAmountUnitPresetFieldName(index)}
                              value={row.unitPreset}
                              onChange={(event) => setEditFeedingRows((prev) => prev.map((item, i) => (
                                i === index ? { ...item, unitPreset: event.target.value as FeedingUnitPreset } : item
                              )))}
                              className="field mt-2"
                            >
                              {FEEDING_UNIT_PRESETS.map((unit) => (
                                <option key={unit} value={unit}>{FEEDING_UNIT_PRESET_LABELS[unit]}</option>
                              ))}
                            </select>
                          </label>
                          {row.unitPreset === "other" && (
                            <label className="block text-sm font-bold sm:col-span-2">
                              Qual unidade?
                              <input
                                disabled={disabled}
                                name={feedingEditItemAmountUnitOtherFieldName(index)}
                                value={row.unitOther}
                                onChange={(event) => setEditFeedingRows((prev) => prev.map((item, i) => (
                                  i === index ? { ...item, unitOther: event.target.value } : item
                                )))}
                                className="field mt-2"
                                placeholder="Ex.: sachê"
                                maxLength={32}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {type === "feeding" && !useSessionFeedingUi && (
                  <>
                    <label className="block text-sm font-bold sm:col-span-2">
                      Tipo de alimentação
                      <select
                        disabled={disabled}
                        name="feeding_subtype"
                        value={feedingSubtype}
                        onChange={(event) => setFeedingSubtype(event.target.value)}
                        className="field mt-2"
                        aria-required={!initialFeeding.legacyWithoutSubtype}
                      >
                        {mode === "edit" && initialFeeding.legacyWithoutSubtype ? (
                          <option value="">Alimentação (sem subtipo — legado)</option>
                        ) : (
                          <option value="" disabled>
                            Escolha…
                          </option>
                        )}
                        {FEEDING_SUBTYPES.map((subtype) => (
                          <option key={subtype} value={subtype}>
                            {FEEDING_SUBTYPE_LABELS[subtype]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-bold">
                      Quantidade
                      <input
                        disabled={disabled}
                        type="number"
                        name="feeding_amount_value"
                        min="0.1"
                        max="1000"
                        step="0.1"
                        inputMode="decimal"
                        value={feedingAmountValue}
                        onChange={(event) => setFeedingAmountValue(event.target.value)}
                        className="field mt-2"
                        placeholder="Ex.: 18"
                        aria-required="true"
                      />
                    </label>
                    <label className="block text-sm font-bold">
                      Unidade
                      <select
                        disabled={disabled}
                        name="feeding_amount_unit_preset"
                        value={feedingUnitPreset}
                        onChange={(event) => setFeedingUnitPreset(event.target.value as FeedingUnitPreset)}
                        className="field mt-2"
                        aria-required="true"
                      >
                        {FEEDING_UNIT_PRESETS.map((unit) => (
                          <option key={unit} value={unit}>
                            {FEEDING_UNIT_PRESET_LABELS[unit]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {feedingUnitPreset === "other" && (
                      <label className="block text-sm font-bold sm:col-span-2">
                        Qual unidade?
                        <input
                          disabled={disabled}
                          name="feeding_amount_unit_other"
                          value={feedingUnitOther}
                          onChange={(event) => setFeedingUnitOther(event.target.value)}
                          className="field mt-2"
                          placeholder="Ex.: sachê, gotas…"
                          maxLength={32}
                          aria-required="true"
                        />
                      </label>
                    )}
                  </>
                )}
                {type === "temperature" && (
                  <label className="block text-sm font-bold">
                    Temperatura em °C
                    <input
                      disabled={disabled}
                      type="number"
                      name="temperature_c"
                      min="30"
                      max="45"
                      step="0.1"
                      inputMode="decimal"
                      value={temperatureC}
                      onChange={(event) => setTemperatureC(event.target.value)}
                      className="field mt-2"
                      placeholder="Ex.: 37,8"
                      aria-required="true"
                    />
                  </label>
                )}
                {(type === "feeding" || type === "urine" || type === "stool") && (
                  <QualitySelect
                    name={qualityName}
                    label={multiType ? `Como foi o ${meta?.label.toLowerCase() ?? type}?` : "Como foi?"}
                    disabled={disabled}
                    defaultValue={defaultValues?.quality}
                    allowEmpty={type === "feeding" && useSessionFeedingUi}
                  />
                )}
                {type === "vaccine" && (mode === "create" || mode === "edit") && (
                  lockVaccineFromUrl ? (
                    <div className="block space-y-2 sm:col-span-2">
                      <p className="text-sm font-bold">Vacina e dose</p>
                      <input type="hidden" name="vaccine_key" value={vaccineKey} />
                      <input type="hidden" name="dose_label" value={doseLabel} />
                      <input type="hidden" name="title" value={title} />
                      <p className="rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">
                        {vaccineDisplayName(vaccineKey)} — {doseLabel}
                      </p>
                      <p className="text-[11px] font-semibold text-[var(--muted)]">
                        Identificada a partir da saúde preventiva — ao salvar, esta dose deixa de aparecer como pendente.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                      <label className="block text-sm font-bold">
                        Qual vacina?
                        <select
                          disabled={disabled}
                          name="vaccine_key"
                          value={vaccineKey}
                          onChange={(event) => {
                            const next = event.target.value;
                            setVaccineKey(next);
                            setDoseLabel("");
                            if (next === "other") setTitle("");
                          }}
                          className="field mt-2"
                          aria-required="true"
                        >
                          <option value="">Selecione</option>
                          {selectableVaccines.map((vaccine) => (
                            <option key={vaccine.key} value={vaccine.key}>{vaccine.name}</option>
                          ))}
                          <option value="other">Outra vacina (fora do protocolo)</option>
                        </select>
                      </label>
                      {vaccineKey === "other" ? (
                        <label className="block text-sm font-bold">
                          Nome da vacina
                          <input
                            disabled={disabled}
                            name="title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            className="field mt-2"
                            placeholder="Ex.: Vacina específica da clínica"
                            aria-required="true"
                          />
                        </label>
                      ) : (
                        <label className="block text-sm font-bold">
                          Qual dose?
                          <select
                            disabled={disabled || !isProtocolVaccineKey(vaccineKey)}
                            name="dose_label"
                            value={doseLabel}
                            onChange={(event) => setDoseLabel(event.target.value)}
                            className="field mt-2"
                            aria-required="true"
                          >
                            <option value="">Selecione</option>
                            {vaccineDoseOptions.map((label) => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {isProtocolVaccineKey(vaccineKey) && doseLabel ? (
                        <input type="hidden" name="title" value={formatVaccineRecordTitle(vaccineKey, doseLabel)} />
                      ) : null}
                      {vaccineKey === "other" ? (
                        <p className="sm:col-span-2 text-[11px] font-semibold text-[var(--muted)]">
                          Esta vacina entra no histórico, mas não quita doses do protocolo V4/Antirrábica.
                        </p>
                      ) : null}
                    </div>
                  )
                )}
                {type === "hygiene" && (
                  <div className="sm:col-span-2 space-y-3">
                    <div>
                      <p className="text-sm font-bold">
                        {hygieneMultiSelect ? "Quais cuidados você fez?" : "Qual cuidado você fez?"}
                      </p>
                      {hygieneMultiSelect ? (
                        <p className="mt-1 text-[11px] font-semibold text-[var(--muted)]">Pode escolher mais de um.</p>
                      ) : null}
                      <div
                        className="mt-2 flex flex-wrap gap-2"
                        role="group"
                        aria-label={hygieneMultiSelect ? "Cuidados de higiene" : "Cuidado de higiene"}
                        aria-multiselectable={hygieneMultiSelect || undefined}
                      >
                        {HYGIENE_PRESETS.map((preset) => {
                          const active = hygieneSubtypes.includes(preset.key);
                          return (
                            <button
                              key={preset.key}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                if (hygieneMultiSelect) {
                                  setHygieneSubtypes((prev) => {
                                    if (prev.includes(preset.key)) {
                                      const next = prev.filter((key) => key !== preset.key);
                                      if (preset.key === "other") setHygieneCustomLabel("");
                                      return next;
                                    }
                                    return [...prev, preset.key];
                                  });
                                  return;
                                }
                                setHygieneSubtypes([preset.key]);
                                if (preset.key !== "other") setHygieneCustomLabel("");
                              }}
                              aria-pressed={active}
                              className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                                active
                                  ? "border-[var(--lavender)] bg-[var(--lavender-soft)] text-[var(--lavender-strong)]"
                                  : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--lavender)]/40"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                      {hygieneSubtypes.map((key) => (
                        <input key={key} type="hidden" name="hygiene_subtype" value={key} />
                      ))}
                      <p className="mt-2 text-[11px] font-semibold text-[var(--muted)]">
                        Manutenção cotidiana, não procedimento clínico.
                      </p>
                    </div>
                    {hygieneSubtypes.includes("other") && (
                      <label className="block text-sm font-bold">
                        Qual outro cuidado?
                        <input
                          disabled={disabled}
                          name="hygiene_custom_label"
                          value={hygieneCustomLabel}
                          onChange={(event) => setHygieneCustomLabel(event.target.value)}
                          className="field mt-2"
                          placeholder="Ex.: Limpeza das patas"
                          aria-required="true"
                        />
                      </label>
                    )}
                  </div>
                )}
                {healthType && type !== "vaccine" && (
                  lockTitleFromUrl && !multiType ? (
                    <div className="block sm:col-span-2">
                      <p className="text-sm font-bold">Título</p>
                      <input type="hidden" name="title" value={title} />
                      <p className="mt-2 rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">{title}</p>
                    </div>
                  ) : (
                    <label className="block text-sm font-bold sm:col-span-2">
                      {multiType ? `Título (${meta?.label ?? type})` : "Título"}
                      {multiType ? (
                        <input
                          disabled={disabled}
                          name={titleName}
                          defaultValue={type === "deworming" ? "Vermífugo" : ""}
                          className="field mt-2"
                          placeholder={
                            type === "deworming" ? "Ex.: Vermífugo"
                              : type === "medication" ? "Ex.: Antipulgas"
                                : type === "consultation" ? "Ex.: Retorno com a Dra. Ana"
                                  : type === "exam" ? "Ex.: Hemograma"
                                  : "O que você percebeu?"
                          }
                        />
                      ) : (
                        <input
                          disabled={disabled}
                          name="title"
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          className="field mt-2"
                          placeholder={
                            type === "deworming" ? "Ex.: Vermífugo"
                              : type === "medication" ? "Ex.: Antipulgas"
                                : type === "consultation" ? "Ex.: Retorno com a Dra. Ana"
                                  : type === "exam" ? "Ex.: Hemograma"
                                  : "O que você percebeu?"
                          }
                        />
                      )}
                    </label>
                  )
                )}
                {(type === "vaccine" || type === "deworming" || type === "consultation" || type === "exam") && !multiType && (
                  <label className="block text-sm font-bold sm:col-span-2">
                    Clínica ou veterinário
                    <input disabled={disabled} name="clinic_or_vet" defaultValue={defaultValues?.clinic_or_vet ?? ""} className="field mt-2" placeholder={type === "exam" ? "Opcional — clínica, lab ou veterinário" : "Opcional"} />
                  </label>
                )}
              </div>
            );

            const showCreateAttachmentsForType =
              createAttachmentsAllowed
              && isAttachableQuickRecordType(type)
              && !(type === "hygiene" && hygieneSubtypes.length > 1);

            const attachmentsBlock = showCreateAttachmentsForType ? (
              <HealthRecordAttachmentsFields
                disabled={disabled}
                careType={type}
                heading={attachmentHeadingForCareType(type, meta?.label)}
                pickerId={`health-record-create-attachments-${type}`}
              />
            ) : null;

            if (!showCard) {
              return (
                <div key={type}>
                  {fields}
                  {attachmentsBlock}
                </div>
              );
            }

            return (
              <div key={type} className="rounded-[18px] border border-[var(--border)] bg-[var(--cream)]/40 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--lavender-strong)]">{meta?.label ?? type}</p>
                <div className="mt-3">{fields}</div>
                {attachmentsBlock}
              </div>
            );
          })
        )}

        {hasHealthType && multiType && activeTypes.some((type) => type === "vaccine" || type === "deworming" || type === "consultation" || type === "exam") && (
          <label className="block text-sm font-bold">
            Clínica ou veterinário
            <input disabled={disabled} name="clinic_or_vet" defaultValue={defaultValues?.clinic_or_vet ?? ""} className="field mt-2" placeholder="Opcional — vale para os tipos de saúde" />
          </label>
        )}
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">
          Quando?
          <FactualDateTimeInput disabled={disabled} required name="occurred_at" defaultValue={occurredDefault} className="field mt-2" />
        </label>
        {mode === "create" && hasReminderType && (
          <label className="block text-sm font-bold">
            Lembrar novamente em
            <input disabled={disabled} type="datetime-local" name="reminder_due_at" className="field mt-2" />
          </label>
        )}
      </section>

      <label className="mt-5 block text-sm font-bold">
        {hygieneOnly
          ? "Quer acrescentar algo importante?"
          : showPerPetNotesToggle(mode, visibleSelectedIds.length)
            ? "Observação para todos (opcional)"
            : "Observação (opcional)"}
        <textarea
          disabled={disabled}
          name="notes"
          rows={3}
          defaultValue={defaultValues?.notes ?? ""}
          className="field mt-2 resize-none"
          placeholder={
            hygieneOnly
              ? "Opcional — qualquer detalhe que ajude depois"
              : showPerPetNotesToggle(mode, visibleSelectedIds.length)
                ? "Opcional — vale para todos os pets deste lançamento"
                : "Opcional — qualquer detalhe que ajude depois"
          }
        />
      </label>

      {showPerPetNotesToggle(mode, visibleSelectedIds.length) && (
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 text-sm font-bold">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--graphite)]"
              disabled={disabled}
              checked={perPetNotesEnabled}
              name={perPetNotesEnabled ? "include_per_pet_notes" : undefined}
              value="1"
              onChange={(event) => {
                const next = event.target.checked;
                setPerPetNotesEnabled(next);
                if (!next) {
                  setPerPetNotesTargets([]);
                  setPerPetNotesDraft({});
                }
              }}
            />
            <span>
              Quer adicionar uma observação individual?
              <span className="mt-0.5 block text-xs font-semibold text-[var(--muted)]">
                Por padrão não — só a observação para todos é usada.
              </span>
            </span>
          </label>

          {perPetNotesEnabled && (
            <section className="space-y-3 rounded-[18px] border border-[var(--border)] bg-[var(--cream)]/40 p-4" aria-label="Observações individuais">
              <fieldset disabled={disabled} className="min-w-0">
                <legend className="text-sm font-bold">Para qual pet?</legend>
                <p className="mt-1 text-xs text-[var(--muted)]">Pode escolher um ou mais — só eles ganham campo próprio.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleSelectedIds.map((petId) => {
                    const checked = perPetNotesTargets.includes(petId);
                    return (
                      <label
                        key={petId}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          checked
                            ? "border-[var(--graphite)] bg-[var(--graphite)] text-white"
                            : "border-[var(--border)] bg-white text-[var(--graphite)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          name={notesTargetPetFieldName()}
                          value={petId}
                          checked={checked}
                          onChange={() => {
                            setPerPetNotesTargets((prev) => {
                              if (prev.includes(petId)) {
                                setPerPetNotesDraft((draft) => {
                                  const next = { ...draft };
                                  delete next[petId];
                                  return next;
                                });
                                return prev.filter((id) => id !== petId);
                              }
                              return [...prev, petId];
                            });
                          }}
                        />
                        {petNames.get(petId) ?? "Pet"}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {perPetNotesTargets.length > 0 && (
                <div className="space-y-3 border-t border-[var(--border)] pt-3">
                  <p className="text-xs text-[var(--muted)]">Se preenchida, substitui a observação geral só naquele pet.</p>
                  {perPetNotesTargets.map((petId) => (
                    <label key={petId} className="block text-sm font-bold">
                      {petNames.get(petId) ?? "Pet"}
                      <textarea
                        disabled={disabled}
                        name={notesFieldNameForPet(petId)}
                        rows={2}
                        className="field mt-2 resize-none"
                        placeholder="Opcional — só para este pet"
                        value={perPetNotesDraft[petId] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPerPetNotesDraft((prev) => ({ ...prev, [petId]: value }));
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {editAttachmentsAllowed && (
        <HealthRecordAttachmentsFields
          disabled={disabled}
          existingAttachments={existingAttachments}
          showExisting
          editableExistingNames
          pickerId="health-record-edit-attachments"
          heading={attachmentHeadingForCareType(activeTypes[0] ?? "other", optionByType[activeTypes[0] as QuickRecordType]?.label)}
          careType={activeTypes[0]}
        />
      )}

      {validationMessage && (
        <p className="mt-5 text-sm font-semibold text-[var(--danger)]" role="alert">
          {validationMessage}
        </p>
      )}

      <SubmitButton
        disabled={submitBlocked}
        pendingLabel="Salvando..."
        className="focus-ring mt-3 w-full rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {resolvedSubmitLabel}
      </SubmitButton>
    </>
  );
}
