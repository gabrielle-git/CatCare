"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { Pet } from "@/types/database";
import { FactualDateInput } from "@/components/factual-datetime-input";
import { MicrochipFields } from "@/components/microchip-fields";

/**
 * Local photo picker — shows existing profile preview on edit.
 * Parent owns crop dialog + File + direct upload on submit.
 * Does not invent unsafe persisted-photo delete.
 */
function PetPhotoField({
  disabled = false,
  existingPhotoUrl = null,
  croppedFile = null,
  onRequestCrop,
  onClearCropped,
}: {
  disabled?: boolean;
  existingPhotoUrl?: string | null;
  /** Confirmed 1:1 crop from parent — preview only after crop, not on raw pick. */
  croppedFile?: File | null;
  onRequestCrop?: (file: File) => void;
  onClearCropped?: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!croppedFile) {
      setFileName(null);
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(croppedFile);
    setFileName(croppedFile.name);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [croppedFile]);

  function clearLocalSelection() {
    if (inputRef.current) inputRef.current.value = "";
    onClearCropped?.();
  }

  function openPicker() {
    inputRef.current?.click();
  }

  const previewUrl = localPreview ?? existingPhotoUrl;
  const hasExisting = Boolean(existingPhotoUrl) && !localPreview;

  return (
    <div>
      <p className="text-sm font-bold">Foto de perfil</p>
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
          event.target.value = "";
          if (file && file.size > 0) onRequestCrop?.(file);
        }}
      />

      {previewUrl ? (
        <div className="mt-2 rounded-[18px] border border-[var(--border)] bg-white p-4">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={hasExisting ? "Foto atual do pet" : "Nova foto selecionada"}
              className="size-24 shrink-0 rounded-full object-cover object-center"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--graphite)]">
                {hasExisting ? "Foto atual" : fileName ?? "Nova foto"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {hasExisting
                  ? "Escolha outra imagem para substituir no perfil."
                  : "Recorte 1:1 confirmado — será enviada ao salvar."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={openPicker}
                  className="focus-ring rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Alterar foto
                </button>
                {localPreview ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={clearLocalSelection}
                    className="focus-ring rounded-2xl border border-red-200 px-3 py-2 text-xs font-bold text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Descartar seleção
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          className="focus-ring mt-2 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-[var(--lavender)] bg-[var(--lavender-soft)] px-4 py-4 text-xs font-bold text-[var(--lavender-strong)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <ImagePlus size={17} aria-hidden />
          Adicionar foto
        </button>
      )}

      <span className="mt-1.5 block text-xs font-normal text-[var(--muted)]">JPG, PNG ou WebP, até 5 MB. Recorte quadrado para o avatar.</span>
    </div>
  );
}

export function PetFields({
  defaultValues,
  existingPhotoUrl = null,
  croppedFile = null,
  includeInitialWeight = false,
  includePhoto = true,
  initialWeightKg = "",
  disabled = false,
  nameInputRef,
  onRequestCrop,
  onClearCropped,
}: {
  defaultValues?: Partial<Pet>;
  existingPhotoUrl?: string | null;
  croppedFile?: File | null;
  includeInitialWeight?: boolean;
  /** When false (Edit Profile), photo management is only via profile camera. */
  includePhoto?: boolean;
  initialWeightKg?: string;
  disabled?: boolean;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  onRequestCrop?: (file: File) => void;
  onClearCropped?: () => void;
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

      {includePhoto ? (
        <PetPhotoField
          disabled={disabled}
          existingPhotoUrl={existingPhotoUrl}
          croppedFile={croppedFile}
          onRequestCrop={onRequestCrop}
          onClearCropped={onClearCropped}
        />
      ) : null}
    </div>
  );
}
