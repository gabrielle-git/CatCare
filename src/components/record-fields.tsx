"use client";

import { useEffect, useMemo, useState } from "react";
import { Bug, ClipboardPlus, Droplets, Milk, Pill, Scale, Stethoscope, Syringe, Thermometer, type LucideIcon } from "lucide-react";
import { FactualDateTimeInput } from "@/components/factual-datetime-input";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { SubmitButton } from "@/components/submit-button";
import { gramsToKgInput } from "@/lib/format";
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
import type { QuickRecordType } from "@/components/record-fields-types";

export type { QuickRecordType } from "@/components/record-fields-types";

type PetOption = { id: string; name: string; neonatal: boolean; species?: string | null };
type RecordOption = { value: QuickRecordType; label: string; shortLabel: string; icon: LucideIcon; neonatal?: boolean };

const options: RecordOption[] = [
  { value: "weight", label: "Pesagem", shortLabel: "Peso", icon: Scale },
  { value: "feeding", label: "Alimentação", shortLabel: "Alim.", icon: Milk, neonatal: true },
  { value: "urine", label: "Xixi", shortLabel: "Xixi", icon: Droplets, neonatal: true },
  { value: "stool", label: "Cocô", shortLabel: "Cocô", icon: Droplets, neonatal: true },
  { value: "temperature", label: "Temperatura", shortLabel: "Temp.", icon: Thermometer, neonatal: true },
  { value: "vaccine", label: "Vacina", shortLabel: "Vacina", icon: Syringe },
  { value: "deworming", label: "Vermífugo", shortLabel: "Vermíf.", icon: Bug },
  { value: "medication", label: "Medicamento", shortLabel: "Remédio", icon: Pill },
  { value: "consultation", label: "Consulta", shortLabel: "Consulta", icon: Stethoscope },
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
}: {
  name: string;
  label: string;
  disabled: boolean;
  defaultValue?: string | null;
}) {
  return (
    <label className="block text-sm font-bold">
      {label}
      <select disabled={disabled} name={name} defaultValue={defaultValue ?? "normal"} className="field mt-2">
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
  weight_grams?: number;
  amount_ml?: number | null;
  feeding_subtype?: string | null;
  feeding_amount_value?: number | null;
  feeding_amount_unit?: string | null;
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
    type === "vaccine" || type === "deworming" || type === "medication" || type === "consultation" || type === "observation",
  );
  const hasReminderType = !multiType && activeTypes.some((type) =>
    type === "vaccine" || type === "deworming" || type === "medication" || type === "consultation",
  );
  const recordCount = activeTypes.length * visibleSelectedIds.length;
  const resolvedSubmitLabel = mode === "edit"
    ? submitLabel
    : recordCount > 1
      ? `Salvar ${recordCount} registros`
      : submitLabel;

  const validationMessage = useMemo(() => {
    const base = validateCreateRecordForm({
      petIds: visibleSelectedIds,
      types: activeTypes,
      weightKg,
      weightKgByPetId,
      feedingSubtype,
      feedingAmountValue,
      feedingUnitPreset,
      feedingUnitOther,
      allowLegacyFeedingWithoutSubtype: mode === "edit" && initialFeeding.legacyWithoutSubtype && !feedingSubtype,
      temperatureC,
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
  }, [activeTypes, doseLabel, feedingAmountValue, feedingSubtype, feedingUnitOther, feedingUnitPreset, initialFeeding.legacyWithoutSubtype, mode, petNames, temperatureC, title, vaccineKey, visibleSelectedIds, weightKg, weightKgByPetId]);

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
            {droppedPetNames.join(" e ")} {droppedPetNames.length === 1 ? "foi desmarcado" : "foram desmarcados"} — alimentação, xixi, cocô e temperatura só valem para filhotes.
          </p>
        )}
        {mode === "create" && recordCount > 1 && visibleSelectedIds.length > 0 && activeTypes.length > 0 && (
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]" role="status">
            {recordCount} registros serão criados ({visibleSelectedIds.length}{" "}
            {visibleSelectedIds.length === 1 ? "pet" : "pets"} × {activeTypes.length}{" "}
            {activeTypes.length === 1 ? "tipo" : "tipos"}).
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
            const healthType = type === "vaccine" || type === "deworming" || type === "medication" || type === "consultation" || type === "observation";

            const fields = (
              <div className="grid gap-4 sm:grid-cols-2">
                {type === "weight" && renderWeightFields()}
                {type === "feeding" && (
                  <>
                    <label className="block text-sm font-bold sm:col-span-2">
                      Tipo de alimentação
                      <select
                        disabled={disabled}
                        name="feeding_subtype"
                        value={feedingSubtype}
                        onChange={(event) => setFeedingSubtype(event.target.value)}
                        className="field mt-2"
                        aria-required={mode === "create" || !initialFeeding.legacyWithoutSubtype}
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
                                  : "O que você percebeu?"
                          }
                        />
                      )}
                    </label>
                  )
                )}
                {(type === "vaccine" || type === "deworming" || type === "consultation") && !multiType && (
                  <label className="block text-sm font-bold sm:col-span-2">
                    Clínica ou veterinário
                    <input disabled={disabled} name="clinic_or_vet" defaultValue={defaultValues?.clinic_or_vet ?? ""} className="field mt-2" placeholder="Opcional" />
                  </label>
                )}
              </div>
            );

            if (!showCard) {
              return <div key={type}>{fields}</div>;
            }

            return (
              <div key={type} className="rounded-[18px] border border-[var(--border)] bg-[var(--cream)]/40 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--lavender-strong)]">{meta?.label ?? type}</p>
                <div className="mt-3">{fields}</div>
              </div>
            );
          })
        )}

        {hasHealthType && multiType && activeTypes.some((type) => type === "vaccine" || type === "deworming" || type === "consultation") && (
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
        {showPerPetNotesToggle(mode, visibleSelectedIds.length) ? "Observação para todos (opcional)" : "Observação (opcional)"}
        <textarea
          disabled={disabled}
          name="notes"
          rows={3}
          defaultValue={defaultValues?.notes ?? ""}
          className="field mt-2 resize-none"
          placeholder={
            showPerPetNotesToggle(mode, visibleSelectedIds.length)
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

      {validationMessage && (
        <p className="mt-5 text-sm font-semibold text-[var(--danger)]" role="alert">
          {validationMessage}
        </p>
      )}

      <SubmitButton
        disabled={submitBlocked}
        className="focus-ring mt-3 w-full rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {resolvedSubmitLabel}
      </SubmitButton>
    </>
  );
}
