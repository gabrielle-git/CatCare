"use client";

import { useEffect, useMemo, useState } from "react";
import { Bug, ClipboardPlus, Droplets, Milk, Pill, Scale, Stethoscope, Syringe, Thermometer, type LucideIcon } from "lucide-react";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { SubmitButton } from "@/components/submit-button";
import { gramsToKgInput } from "@/lib/format";
import { toLocalDateTimeInput } from "@/lib/record-form";
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
  disabled = false,
  mode = "create",
  defaultValues,
  submitLabel = "Salvar registro",
}: {
  pets: PetOption[];
  initialPetId?: string;
  initialType?: string;
  initialTitle?: string;
  disabled?: boolean;
  mode?: "create" | "edit";
  defaultValues?: RecordFieldDefaults;
  submitLabel?: string;
}) {
  const validInitial = options.some((option) => option.value === (defaultValues?.record_type ?? initialType))
    ? (defaultValues?.record_type ?? initialType) as QuickRecordType
    : "weight";
  const [type, setType] = useState<QuickRecordType>(validInitial);
  const suggestedTitle = initialTitle ?? (validInitial === "deworming" ? "Vermífugo" : "");
  const [title, setTitle] = useState(defaultValues?.title ?? suggestedTitle);
  const lockTypeFromUrl = mode === "create" && Boolean(initialType && options.some((option) => option.value === initialType));
  const lockTitleFromUrl = mode === "create" && Boolean(initialTitle);
  const defaultPetIds = defaultValues?.pet_id
    ? [defaultValues.pet_id]
    : initialPetId && pets.some((pet) => pet.id === initialPetId)
      ? [initialPetId]
      : pets[0]?.id
        ? [pets[0].id]
        : [];
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>(defaultPetIds);
  const selectedPets = useMemo(() => pets.filter((pet) => selectedPetIds.includes(pet.id)), [pets, selectedPetIds]);
  const neonatalBlocked = selectedPets.length > 0 && selectedPets.some((pet) => !pet.neonatal);
  const lockedType = mode === "edit" || lockTypeFromUrl;
  const activeType = lockedType ? validInitial : type;
  const healthType = activeType === "vaccine" || activeType === "deworming" || activeType === "medication" || activeType === "consultation" || activeType === "observation";
  const occurredDefault = defaultValues?.occurred_at ? toLocalDateTimeInput(defaultValues.occurred_at) : currentLocalDateTime();

  useEffect(() => {
    if (initialTitle) {
      setTitle(initialTitle);
      return;
    }
    if (validInitial === "deworming") setTitle("Vermífugo");
  }, [initialTitle, validInitial]);

  return (
    <>
      <section>
        <p className="text-sm font-bold">1. {mode === "edit" ? "Pet" : "Quais pets?"}</p>
        <div className="mt-2">
          <PetMultiSelect
            pets={pets}
            defaultSelectedIds={defaultPetIds}
            disabled={disabled || pets.length === 0}
            multiple={mode === "create"}
            required
            legend=""
            hint={mode === "create" ? "Pode escolher mais de um — o registro será criado para cada pet selecionado." : undefined}
            onSelectionChange={setSelectedPetIds}
          />
        </div>
        {mode === "create" && activeType === "weight" && selectedPetIds.length > 1 && (
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
            {options.map(({ value, shortLabel, icon: Icon, neonatal }) => {
              const unavailable = neonatal && neonatalBlocked;
              const active = type === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled || Boolean(unavailable)}
                  onClick={() => setType(value)}
                  title={unavailable ? "Disponível para filhotes com até 8 semanas" : undefined}
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

      <SubmitButton disabled={disabled || pets.length === 0} className="focus-ring mt-7 w-full rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15">{submitLabel}</SubmitButton>
    </>
  );
}
