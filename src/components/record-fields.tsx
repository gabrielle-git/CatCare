"use client";

import { useEffect, useMemo, useState } from "react";
import { Bug, ClipboardPlus, Droplets, Milk, Pill, Scale, Stethoscope, Syringe, Thermometer, type LucideIcon } from "lucide-react";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { SubmitButton } from "@/components/submit-button";
import { gramsToKgInput } from "@/lib/format";
import { isNeonatalCareType, toLocalDateTimeInput } from "@/lib/record-form";
import type { QuickRecordType } from "@/components/record-fields-types";

export type { QuickRecordType } from "@/components/record-fields-types";

type PetOption = { id: string; name: string; neonatal: boolean };
type RecordOption = { value: QuickRecordType; label: string; shortLabel: string; icon: LucideIcon; neonatal?: boolean };

const MAX_TYPES = 2;

const options: RecordOption[] = [
  { value: "weight", label: "Pesagem", shortLabel: "Peso", icon: Scale },
  { value: "feeding", label: "Mamada", shortLabel: "Mamada", icon: Milk, neonatal: true },
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
  temperature_c?: number | null;
  quality?: string | null;
};

export function RecordFields({
  pets,
  initialPetId,
  initialType,
  initialTitle,
  initialLockType,
  returnTo,
  neonatalContext = false,
  disabled = false,
  mode = "create",
  defaultValues,
  submitLabel = "Salvar registro",
}: {
  pets: PetOption[];
  initialPetId?: string;
  initialType?: string;
  initialTitle?: string;
  initialLockType?: string;
  returnTo?: string;
  neonatalContext?: boolean;
  disabled?: boolean;
  mode?: "create" | "edit";
  defaultValues?: RecordFieldDefaults;
  submitLabel?: string;
}) {
  const neonatalPets = useMemo(() => neonatalPetPool(pets), [pets]);
  const defaultPet = initialPetId && pets.some((pet) => pet.id === initialPetId)
    ? pets.find((pet) => pet.id === initialPetId)
    : neonatalContext
      ? neonatalPets[0]
      : pets[0];

  const fallbackType: QuickRecordType = neonatalContext && !initialType && !defaultValues?.record_type
    ? "feeding"
    : defaultPet?.neonatal
      ? "feeding"
      : "weight";

  const validInitial = options.some((option) => option.value === (defaultValues?.record_type ?? initialType))
    ? (defaultValues?.record_type ?? initialType) as QuickRecordType
    : fallbackType;

  const [selectedTypes, setSelectedTypes] = useState<QuickRecordType[]>([validInitial]);
  const suggestedTitle = initialTitle ?? (validInitial === "deworming" ? "Vermífugo" : "");
  const [title, setTitle] = useState(defaultValues?.title ?? suggestedTitle);
  const lockTitleFromUrl = mode === "create" && Boolean(initialTitle);
  const lockTypeFromUrl = mode === "create" && (initialLockType === "1" || initialLockType === "true" || lockTitleFromUrl);
  const lockedType = mode === "edit" || lockTypeFromUrl;
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

  useEffect(() => {
    if (initialTitle) {
      setTitle(initialTitle);
      return;
    }
    if (validInitial === "deworming") setTitle("Vermífugo");
  }, [initialTitle, validInitial]);

  useEffect(() => {
    if (mode !== "create" || lockedType) return;
    setSelectedPetIds((prev) => resolvePetSelection(
      pets,
      prev,
      neonatalContext || activeTypes.some(isNeonatalCareType),
      initialPetId,
      Boolean(initialPetId),
    ));
  }, [activeTypes, initialPetId, lockedType, mode, neonatalContext, pets]);

  const toggleType = (value: QuickRecordType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(value)) return prev.filter((item) => item !== value);
      if (prev.length >= MAX_TYPES) return [prev[1] ?? prev[0], value];
      return [...prev, value];
    });
  };

  const petHint = mode === "create"
    ? neonatalContext
      ? "Modo neonatal — só filhotes com até 8 semanas aparecem aqui."
      : restrictToNeonatal
        ? "Só filhotes em fase neonatal aparecem para este tipo de cuidado."
        : "Pode escolher mais de um — o registro será criado para cada pet selecionado."
    : undefined;

  const typeLabels = activeTypes.map((type) => optionByType[type]?.label ?? type).join(" + ");

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
        {mode === "create" && activeTypes.includes("weight") && visibleSelectedIds.length > 1 && (
          <p className="mt-2 text-xs text-[var(--muted)]">Cada pet receberá o mesmo peso informado. Para pesos diferentes, registre um de cada vez.</p>
        )}
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="text-sm font-bold">2. O que aconteceu?</p>
          {allowMultiType && (
            <p className="text-[11px] font-semibold text-[var(--muted)]">Até {MAX_TYPES} tipos — ex.: xixi + cocô</p>
          )}
        </div>
        {lockedType ? (
          <p className="mt-2 rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">{optionByType[primaryType]?.label ?? primaryType}</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {options.map(({ value, shortLabel, icon: Icon }) => {
              const active = selectedTypes.includes(value);
              const atLimit = selectedTypes.length >= MAX_TYPES && !active;
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
                      : atLimit
                        ? "border-[var(--border)] bg-white text-[var(--muted)] opacity-55"
                        : "border-[var(--border)] bg-white text-[var(--muted)]"
                  }`}
                >
                  <Icon size={19} /> {shortLabel}
                </button>
              );
            })}
          </div>
        )}
        {multiType && (
          <p className="mt-3 rounded-[14px] bg-[var(--cream)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
            Registrando juntos: <span className="text-[var(--foreground)]">{typeLabels}</span>
          </p>
        )}
        {allowMultiType && activeTypes.length === 0 && (
          <p className="mt-3 rounded-[14px] border border-dashed border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
            Nenhum tipo selecionado — toque em 1 ou 2 opções acima para abrir o formulário.
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
              {type === "weight" && (
                <label className="block text-sm font-bold">
                  Peso (kg)
                  <input disabled={disabled} required type="text" name="weight_kg" inputMode="decimal" defaultValue={defaultValues?.weight_grams != null ? gramsToKgInput(defaultValues.weight_grams) : ""} className="field mt-2" placeholder="Ex.: 4,2" />
                </label>
              )}
              {type === "feeding" && (
                <label className="block text-sm font-bold">
                  Quantidade em ml
                  <input disabled={disabled} required type="number" name="amount_ml" min="0.1" max="1000" step="0.1" inputMode="decimal" defaultValue={defaultValues?.amount_ml ?? ""} className="field mt-2" placeholder="Ex.: 8" />
                </label>
              )}
              {type === "temperature" && (
                <label className="block text-sm font-bold">
                  Temperatura em °C
                  <input disabled={disabled} required type="number" name="temperature_c" min="30" max="45" step="0.1" inputMode="decimal" defaultValue={defaultValues?.temperature_c ?? ""} className="field mt-2" placeholder="Ex.: 37,8" />
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
              {healthType && (
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
                          type === "vaccine" ? "Ex.: V4 — primeira dose"
                            : type === "deworming" ? "Ex.: Vermífugo"
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
                          type === "vaccine" ? "Ex.: V4 — primeira dose"
                            : type === "deworming" ? "Ex.: Vermífugo"
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
          <input disabled={disabled} required type="datetime-local" name="occurred_at" defaultValue={occurredDefault} className="field mt-2" />
        </label>
        {mode === "create" && hasReminderType && (
          <label className="block text-sm font-bold">
            Lembrar novamente em
            <input disabled={disabled} type="datetime-local" name="reminder_due_at" className="field mt-2" />
          </label>
        )}
      </section>

      <label className="mt-5 block text-sm font-bold">
        Observações
        <textarea disabled={disabled} name="notes" rows={3} defaultValue={defaultValues?.notes ?? ""} className="field mt-2 resize-none" placeholder={multiType ? "Opcional — vale para os dois registros" : "Opcional — qualquer detalhe que ajude depois"} />
      </label>

      <SubmitButton
        disabled={disabled || visiblePets.length === 0 || visibleSelectedIds.length === 0 || activeTypes.length === 0}
        className="focus-ring mt-7 w-full rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15"
      >
        {resolvedSubmitLabel}
      </SubmitButton>
    </>
  );
}
