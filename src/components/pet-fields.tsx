"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Image as ImageIcon } from "lucide-react";
import type { Pet } from "@/types/database";
import { FactualDateInput } from "@/components/factual-datetime-input";
import { MicrochipFields } from "@/components/microchip-fields";

/**
 * Local-only photo picker UI (File via Server Action on submit).
 * Does not upload early and does not remove a photo already persisted on edit —
 * only clears an unsaved selection.
 */
function PetPhotoField({
  disabled = false,
  onPhotoFileChange,
}: {
  disabled?: boolean;
  onPhotoFileChange?: (file: File | null) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function setLocalFile(file: File | null) {
    setFileName(file && file.size > 0 ? file.name : null);
    onPhotoFileChange?.(file && file.size > 0 ? file : null);
  }

  function clearLocalSelection() {
    if (inputRef.current) inputRef.current.value = "";
    setLocalFile(null);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  return (
    <div>
      <p className="text-sm font-bold">Foto</p>
      <input
        ref={inputRef}
        id={inputId}
        disabled={disabled}
        type="file"
        name="photo"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Foto do pet"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setLocalFile(file);
        }}
      />

      {!fileName ? (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className="focus-ring mt-2 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-[var(--lavender)] bg-[var(--lavender-soft)] px-4 py-4 text-xs font-bold text-[var(--lavender-strong)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <ImagePlus size={17} aria-hidden />
          Escolher imagem
        </button>
      ) : (
        <div className="mt-2 rounded-[18px] border border-[var(--border)] bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ImageIcon size={16} className="shrink-0 text-[var(--muted)]" aria-hidden />
            <p className="min-w-0 truncate text-sm font-semibold text-[var(--graphite)]" title={fileName}>
              {fileName}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={openPicker}
              className="focus-ring rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-55"
            >
              Trocar imagem
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={clearLocalSelection}
              className="focus-ring rounded-2xl border border-red-200 px-3 py-2 text-xs font-bold text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              Remover imagem
            </button>
          </div>
        </div>
      )}

      <span className="mt-1.5 block text-xs font-normal text-[var(--muted)]">JPG, PNG ou WebP, até 5 MB.</span>
    </div>
  );
}

export function PetFields({
  defaultValues,
  includeInitialWeight = false,
  initialWeightKg = "",
  disabled = false,
  nameInputRef,
  onPhotoFileChange,
}: {
  defaultValues?: Partial<Pet>;
  includeInitialWeight?: boolean;
  /** Create-only default for peso inicial. */
  initialWeightKg?: string;
  disabled?: boolean;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Keep the selected File in parent state across soft server responses. */
  onPhotoFileChange?: (file: File | null) => void;
}) {
  const [isNeutered, setIsNeutered] = useState(defaultValues?.neutered ?? false);

  return (
    <div className="space-y-5">
      <label className="block text-sm font-bold">
        Nome do pet <span className="text-[var(--danger)]">*</span>
        <input
          ref={nameInputRef}
          disabled={disabled}
          required
          name="name"
          defaultValue={defaultValues?.name ?? ""}
          className="field mt-2"
          placeholder="Ex.: Dobby"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">
          Sexo
          <select disabled={disabled} name="sex" defaultValue={defaultValues?.sex ?? "unknown"} className="field mt-2">
            <option value="unknown">Não informado</option>
            <option value="male">Macho</option>
            <option value="female">Fêmea</option>
          </select>
        </label>
        <div>
          <label className="block text-sm font-bold">
            Nascimento
            <FactualDateInput disabled={disabled} name="birth_date" defaultValue={defaultValues?.birth_date ?? ""} className="field mt-2" />
          </label>
          <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
            <input
              disabled={disabled}
              type="checkbox"
              name="birth_date_estimated"
              defaultChecked={defaultValues?.birth_date_estimated ?? false}
              className="size-4 accent-[var(--lavender)]"
            />
            Data estimada
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">
          Raça
          <input disabled={disabled} name="breed" defaultValue={defaultValues?.breed ?? ""} className="field mt-2" placeholder="Ex.: SRD" />
        </label>
        <label className="block text-sm font-bold">
          Cor
          <input disabled={disabled} name="color" defaultValue={defaultValues?.color ?? ""} className="field mt-2" placeholder="Ex.: tigrado" />
        </label>
      </div>

      {includeInitialWeight && (
        <label className="block text-sm font-bold">
          Peso inicial (kg)
          <input
            disabled={disabled}
            type="text"
            name="initial_weight_kg"
            defaultValue={initialWeightKg}
            className="field mt-2"
            placeholder="Ex.: 4,2"
            inputMode="decimal"
          />
          <span className="mt-1.5 block text-xs font-normal text-[var(--muted)]">A primeira pesagem já aparecerá no histórico.</span>
        </label>
      )}

      <label className="flex items-center gap-3 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold">
        <input
          disabled={disabled}
          type="checkbox"
          name="neutered"
          checked={isNeutered}
          onChange={(event) => setIsNeutered(event.target.checked)}
          className="size-4 accent-[var(--lavender)]"
        />
        Castrado(a)
      </label>
      {isNeutered ? (
        <div className="grid gap-4 rounded-2xl border border-[var(--border)] bg-white p-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            Quando castrou?
            <FactualDateInput disabled={disabled} name="neutered_at" defaultValue={defaultValues?.neutered_at ?? ""} className="field mt-2" />
          </label>
          <label className="block text-sm font-bold">
            Onde castrou?
            <input disabled={disabled} name="neutered_place" defaultValue={defaultValues?.neutered_place ?? ""} className="field mt-2" placeholder="Ex.: Clínica Vet Vida" />
          </label>
        </div>
      ) : null}

      <MicrochipFields defaultValues={defaultValues} disabled={disabled} />

      <label id="description" className="block scroll-mt-6 text-sm font-bold">
        Descrição e observações
        <textarea disabled={disabled} name="notes" defaultValue={defaultValues?.notes ?? ""} rows={4} className="field mt-2 resize-none" placeholder="Como ele é, do que gosta, alergias ou algo importante" />
        <span className="mt-1.5 block text-xs font-normal text-[var(--muted)]">Este texto aparece no cartão “Sobre” do perfil.</span>
      </label>

      <PetPhotoField disabled={disabled} onPhotoFileChange={onPhotoFileChange} />
    </div>
  );
}
