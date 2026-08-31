"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { SubmitButton } from "@/components/submit-button";
import { DEFAULT_ROUTINE_ICON, sanitizeRoutineIconKey } from "@/lib/routine-icons";
import { ROUTINE_FREQUENCY_OPTIONS, routinePresets, type RoutinePreset } from "@/lib/routine-presets";
import type { CareRoutineWithPets } from "@/types/database";

const RoutineIconPicker = dynamic(
  () => import("@/components/routine-icon-picker").then((mod) => mod.RoutineIconPicker),
  { ssr: false, loading: () => <div className="mt-2 h-12 rounded-2xl bg-[var(--cream)]" aria-hidden /> },
);

function todayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function inferFrequencyMode(recurrenceDays: number | null) {
  if (recurrenceDays == null) return "as_needed";
  const preset = ROUTINE_FREQUENCY_OPTIONS.find(
    (item) => item.value !== "custom" && item.value !== "as_needed" && item.days === recurrenceDays,
  );
  return preset?.value ?? "custom";
}

function defaultValuesToState(defaults?: CareRoutineWithPets) {
  if (!defaults) {
    return {
      title: "",
      iconKey: DEFAULT_ROUTINE_ICON,
      frequencyMode: "1",
      customDays: "3",
      preferredTime: "",
      startsOn: todayIso(),
      instructions: "",
      active: true,
      petIds: [] as string[],
    };
  }
  const mode = inferFrequencyMode(defaults.recurrence_days);
  return {
    title: defaults.title,
    iconKey: sanitizeRoutineIconKey(defaults.icon_key),
    frequencyMode: mode,
    customDays: defaults.recurrence_days && mode === "custom" ? String(defaults.recurrence_days) : "3",
    preferredTime: defaults.preferred_time?.slice(0, 5) ?? "",
    startsOn: defaults.starts_on,
    instructions: defaults.instructions ?? "",
    active: defaults.active,
    petIds: defaults.pet_ids,
  };
}

export function RoutineFormFields({
  pets,
  defaultValues,
  disabled = false,
  submitLabel,
}: {
  pets: { id: string; name: string }[];
  defaultValues?: CareRoutineWithPets;
  disabled?: boolean;
  submitLabel: string;
}) {
  const initial = useMemo(() => defaultValuesToState(defaultValues), [defaultValues]);
  const [title, setTitle] = useState(initial.title);
  const [iconKey, setIconKey] = useState(initial.iconKey);
  const [frequencyMode, setFrequencyMode] = useState(initial.frequencyMode);
  const [customDays, setCustomDays] = useState(initial.customDays);
  const [preferredTime, setPreferredTime] = useState(initial.preferredTime);
  const [startsOn, setStartsOn] = useState(initial.startsOn);
  const [instructions, setInstructions] = useState(initial.instructions);
  const [active, setActive] = useState(initial.active);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>(initial.petIds);
  const [presetOpen, setPresetOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!presetOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (presetRef.current && !presetRef.current.contains(event.target as Node)) {
        setPresetOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [presetOpen]);

  const applyPreset = (preset: RoutinePreset) => {
    setTitle(preset.title);
    setIconKey(preset.icon_key);
    if (preset.recurrence_days == null) setFrequencyMode("as_needed");
    else if (ROUTINE_FREQUENCY_OPTIONS.some((item) => item.days === preset.recurrence_days)) {
      setFrequencyMode(String(preset.recurrence_days));
    } else {
      setFrequencyMode("custom");
      setCustomDays(String(preset.recurrence_days));
    }
    if (preset.instructions) setInstructions(preset.instructions);
    setPresetOpen(false);
  };

  const validationMessage = (() => {
    if (!title.trim()) return "Informe o nome da rotina.";
    if (selectedPetIds.length === 0) return "Selecione ao menos um pet.";
    if (frequencyMode === "custom") {
      const n = Number(customDays);
      if (!Number.isInteger(n) || n <= 0 || n > 365) return "Informe um intervalo entre 1 e 365 dias.";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return "Informe uma data inicial válida.";
    return null;
  })();

  return (
    <>
      <label className="mt-5 block text-sm font-bold">
        Nome da rotina
        <input
          disabled={disabled}
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="field mt-2"
          placeholder="Ex.: Escovar os dentes"
          maxLength={80}
          aria-required="true"
        />
        {!defaultValues && (
          <div ref={presetRef} className="relative mt-1.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setPresetOpen((open) => !open)}
              className="focus-ring text-xs font-medium text-[var(--muted)] hover:text-[var(--lavender-strong)]"
              aria-expanded={presetOpen}
              aria-haspopup="listbox"
            >
              ✦ Sem ideia? Usar uma sugestão
            </button>
            {presetOpen && (
              <div
                className="absolute left-0 top-full z-20 mt-1 min-w-[min(100%,14rem)] overflow-hidden rounded-xl border border-[var(--border)] bg-white py-1 shadow-lg"
              >
                {routinePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => applyPreset(preset)}
                    className="focus-ring block w-full px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--lavender-soft)]"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </label>

      <fieldset className="mt-5" disabled={disabled}>
        <legend className="text-sm font-bold">Ícone</legend>
        <input type="hidden" name="icon_key" value={iconKey} />
        <RoutineIconPicker value={iconKey} onChange={setIconKey} disabled={disabled} />
      </fieldset>

      <div className="mt-5">
        <PetMultiSelect
          pets={pets}
          defaultSelectedIds={selectedPetIds}
          disabled={disabled}
          required
          legend="Pets"
          hint="Escolha um ou mais pets para esta rotina."
          onSelectionChange={setSelectedPetIds}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">
          Frequência
          <select
            disabled={disabled}
            name="frequency_mode"
            value={frequencyMode}
            onChange={(event) => setFrequencyMode(event.target.value)}
            className="field mt-2"
          >
            {ROUTINE_FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {frequencyMode === "custom" && (
          <label className="block text-sm font-bold">
            A cada quantos dias?
            <input
              disabled={disabled}
              name="custom_recurrence_days"
              type="number"
              min={1}
              max={365}
              value={customDays}
              onChange={(event) => setCustomDays(event.target.value)}
              className="field mt-2"
            />
          </label>
        )}
        <label className="block text-sm font-bold">
          Horário preferido
          <input
            disabled={disabled}
            name="preferred_time"
            type="time"
            value={preferredTime}
            onChange={(event) => setPreferredTime(event.target.value)}
            className="field mt-2"
          />
          <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Opcional</span>
        </label>
        <label className="block text-sm font-bold">
          Data inicial
          <input
            disabled={disabled}
            required
            name="starts_on"
            type="date"
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
            className="field mt-2"
          />
        </label>
      </div>

      <label className="mt-5 block text-sm font-bold">
        Instruções
        <textarea
          disabled={disabled}
          name="instructions"
          rows={3}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          className="field mt-2 resize-none"
          placeholder="Opcional — dicas para quem for executar"
        />
      </label>

      <label className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--cream)] px-4 py-3 text-sm font-semibold">
        <input type="hidden" name="active" value={active ? "1" : "0"} />
        <input
          disabled={disabled}
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="size-4 accent-[var(--lavender)]"
        />
        Rotina ativa
      </label>

      {validationMessage && (
        <p className="mt-5 text-sm font-semibold text-[var(--danger)]" role="alert">{validationMessage}</p>
      )}

      <SubmitButton
        disabled={disabled || validationMessage !== null}
        className="focus-ring mt-3 w-full rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
      >
        {submitLabel}
      </SubmitButton>
    </>
  );
}
