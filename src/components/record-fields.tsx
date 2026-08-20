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

function currentLocalDateTime() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
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

  const [type, setType] = useState<QuickRecordType>(validInitial);
  const suggestedTitle = initialTitle ?? (validInitial === "deworming" ? "Vermífugo" : "");
  const [title, setTitle] = useState(defaultValues?.title ?? suggestedTitle);
  const lockTitleFromUrl = mode === "create" && Boolean(initialTitle);
  const lockTypeFromUrl = mode === "create" && (initialLockType === "1" || initialLockType === "true" || lockTitleFromUrl);
  const lockedType = mode === "edit" || lockTypeFromUrl;
  const activeType = lockedType ? validInitial : type;

  const restrictToNeonatal = neonatalContext || isNeonatalCareType(activeType);
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
    if (neonatalContext || isNeonatalCareType(activeType)) {
      return neonatalPets;
    }
    return pets;
  }, [activeType, defaultValues?.pet_id, mode, neonatalContext, neonatalPets, pets]);

  const visibleSelectedIds = useMemo(
    () => selectedPetIds.filter((id) => visiblePets.some((pet) => pet.id === id)),
    [selectedPetIds, visiblePets],
  );

  const healthType = activeType === "vaccine" || activeType === "deworming" || activeType === "medication" || activeType === "consultation" || activeType === "observation";
  const occurredDefault = defaultValues?.occurred_at ? toLocalDateTimeInput(defaultValues.occurred_at) : currentLocalDateTime();
  const noNeonatalPets = restrictToNeonatal && visiblePets.length === 0;

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
      neonatalContext || isNeonatalCareType(activeType),
      initialPetId,
      Boolean(initialPetId),
    ));
  }, [activeType, initialPetId, lockedType, mode, neonatalContext, pets]);

  const petHint = mode === "create"
    ? neonatalContext
      ? "Modo neonatal — só filhotes com até 8 semanas aparecem aqui."
      : restrictToNeonatal
        ? "Só filhotes em fase neonatal aparecem para este tipo de cuidado."
        : "Pode escolher mais de um — o registro será criado para cada pet selecionado."
    : undefined;

  return (
    <>
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      {neonatalContext ? <input type="hidden" name="context" value="neonatal" /> : null}

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
        {mode === "create" && activeType === "weight" && visibleSelectedIds.length > 1 && (
          <p className="mt-2 text-xs text-[var(--muted)]">Cada pet receberá o mesmo peso informado. Para pesos diferentes, registre um de cada vez.</p>
        )}
      </section>

      <section className="mt-6">
        <p className="text-sm font-bold">2. O que aconteceu?</p>
        <input type="hidden" name="record_type" value={activeType} />
        {lockedType ? (
          <p className="mt-2 rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">{options.find((option) => option.value === activeType)?.label ?? activeType}</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {options.map(({ value, shortLabel, icon: Icon }) => {
              const active = type === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setType(value)}
                  className={`focus-ring flex min-h-20 flex-col items-center justify-center gap-2 rounded-[18px] border px-2 text-xs font-bold transition ${active ? "border-[var(--lavender)] bg-[var(--lavender-soft)] text-[var(--lavender-strong)]" : "border-[var(--border)] bg-white text-[var(--muted)]"}`}
                >
                  <Icon size={19} /> {shortLabel}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {activeType === "weight" && <label className="block text-sm font-bold">Peso (kg)<input disabled={disabled} required type="text" name="weight_kg" inputMode="decimal" defaultValue={defaultValues?.weight_grams != null ? gramsToKgInput(defaultValues.weight_grams) : ""} className="field mt-2" placeholder="Ex.: 4,2" /></label>}
        {activeType === "feeding" && <label className="block text-sm font-bold">Quantidade em ml<input disabled={disabled} required type="number" name="amount_ml" min="0.1" max="1000" step="0.1" inputMode="decimal" defaultValue={defaultValues?.amount_ml ?? ""} className="field mt-2" placeholder="Ex.: 8" /></label>}
        {activeType === "temperature" && <label className="block text-sm font-bold">Temperatura em °C<input disabled={disabled} required type="number" name="temperature_c" min="30" max="45" step="0.1" inputMode="decimal" defaultValue={defaultValues?.temperature_c ?? ""} className="field mt-2" placeholder="Ex.: 37,8" /></label>}
        {(activeType === "feeding" || activeType === "urine" || activeType === "stool") && (
          <label className="block text-sm font-bold">Como foi?<select disabled={disabled} name="quality" defaultValue={defaultValues?.quality ?? "normal"} className="field mt-2"><option value="normal">Normal</option><option value="good">Foi bem</option><option value="little">Pouquinho</option><option value="difficult">Com dificuldade</option><option value="attention">Precisa de atenção</option></select></label>
        )}
        {healthType && (
          lockTitleFromUrl ? (
            <div className="block sm:col-span-2">
              <p className="text-sm font-bold">Título</p>
              <input type="hidden" name="title" value={title} />
              <p className="mt-2 rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">{title}</p>
            </div>
          ) : (
            <label className="block text-sm font-bold sm:col-span-2">Título<input disabled={disabled} name="title" value={title} onChange={(event) => setTitle(event.target.value)} className="field mt-2" placeholder={activeType === "vaccine" ? "Ex.: V4 — primeira dose" : activeType === "deworming" ? "Ex.: Vermífugo" : activeType === "medication" ? "Ex.: Antipulgas" : activeType === "consultation" ? "Ex.: Retorno com a Dra. Ana" : "O que você percebeu?"} /></label>
          )
        )}
        {(activeType === "vaccine" || activeType === "deworming" || activeType === "consultation") && <label className="block text-sm font-bold sm:col-span-2">Clínica ou veterinário<input disabled={disabled} name="clinic_or_vet" defaultValue={defaultValues?.clinic_or_vet ?? ""} className="field mt-2" placeholder="Opcional" /></label>}
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">Quando?<input disabled={disabled} required type="datetime-local" name="occurred_at" defaultValue={occurredDefault} className="field mt-2" /></label>
        {mode === "create" && (activeType === "vaccine" || activeType === "deworming" || activeType === "medication" || activeType === "consultation") && <label className="block text-sm font-bold">Lembrar novamente em<input disabled={disabled} type="datetime-local" name="reminder_due_at" className="field mt-2" /></label>}
      </section>

      <label className="mt-5 block text-sm font-bold">Observações<textarea disabled={disabled} name="notes" rows={3} defaultValue={defaultValues?.notes ?? ""} className="field mt-2 resize-none" placeholder="Opcional — qualquer detalhe que ajude depois" /></label>

      <SubmitButton disabled={disabled || visiblePets.length === 0 || visibleSelectedIds.length === 0} className="focus-ring mt-7 w-full rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15">{submitLabel}</SubmitButton>
    </>
  );
}
