"use client";

import { useId, useRef, useState, useTransition } from "react";
import { PetFields } from "@/components/pet-fields";
import { SubmitButton } from "@/components/submit-button";
import type { CreatePetResult } from "@/app/(app)/pets/actions";
import { readPetCreateFormDraft, type PetCreateFormDraft } from "@/lib/pet-create";

/**
 * New-pet form: stable pet_id + weight intent across retries,
 * pending UX, and server-driven active-homonym confirmation.
 * Draft snapshot restores uncontrolled fields after soft server responses
 * (React may reset the form when the action Promise resolves).
 */
export function CreatePetForm({
  action,
  configured,
  initialError,
}: {
  action: (formData: FormData) => Promise<CreatePetResult>;
  configured: boolean;
  initialError?: string | null;
}) {
  const reactId = useId();
  const [petId] = useState(() => crypto.randomUUID());
  const [weightRecordId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [duplicate, setDuplicate] = useState<{ name: string; existingLabel: string } | null>(null);
  const [draft, setDraft] = useState<PetCreateFormDraft | null>(null);
  const [fieldsKey, setFieldsKey] = useState(0);
  const allowDuplicateRef = useRef(false);
  const [pending, startTransition] = useTransition();

  function restoreDraft(next: PetCreateFormDraft) {
    setDraft(next);
    setFieldsKey((value) => value + 1);
  }

  return (
    <form
      className="cat-card mt-6 p-5 md:p-7"
      action={(formData) => {
        startTransition(async () => {
          setError(null);
          const allowDuplicate = allowDuplicateRef.current;
          // Snapshot BEFORE awaiting — form may reset when the action settles.
          const snapshot = readPetCreateFormDraft(formData);
          snapshot.pet_id = petId;
          snapshot.initial_weight_record_id = weightRecordId;
          if (!allowDuplicate) setDuplicate(null);
          try {
            formData.set("pet_id", petId);
            formData.set("initial_weight_record_id", weightRecordId);
            if (allowDuplicate) formData.set("allow_duplicate_name", "true");
            else formData.delete("allow_duplicate_name");

            const result = await action(formData);
            if (result.ok) {
              window.location.replace(result.redirectTo);
              return;
            }
            if ("duplicateName" in result && result.duplicateName) {
              allowDuplicateRef.current = false;
              restoreDraft(snapshot);
              setDuplicate({ name: result.name, existingLabel: result.existingLabel });
              return;
            }
            allowDuplicateRef.current = false;
            restoreDraft(snapshot);
            setError("error" in result ? result.error : "Não foi possível salvar. Tente novamente.");
          } catch (cause) {
            allowDuplicateRef.current = false;
            restoreDraft(snapshot);
            setError(cause instanceof Error ? cause.message : "Não foi possível salvar. Tente novamente.");
          }
        });
      }}
    >
      <input type="hidden" name="pet_id" value={petId} />
      <input type="hidden" name="initial_weight_record_id" value={weightRecordId} />

      {error ? (
        <div className="mb-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      ) : null}

      {duplicate ? (
        <div
          className="mb-4 rounded-[20px] border border-[var(--border)] bg-[var(--cream)] px-4 py-4 text-sm"
          role="status"
          aria-labelledby={`${reactId}-homonym-title`}
        >
          <p id={`${reactId}-homonym-title`} className="font-bold text-[var(--graphite)]">
            Já existe um pet com esse nome
          </p>
          <p className="mt-1 text-[var(--muted)]">
            Encontramos “{duplicate.existingLabel}” ativo nesta família. Homônimos são permitidos — deseja continuar
            mesmo assim e criar “{duplicate.name}”?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="focus-ring rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-xs font-bold"
              onClick={() => {
                allowDuplicateRef.current = false;
                setDuplicate(null);
                // Keep draft — cancel must not wipe filled fields.
                if (draft) restoreDraft(draft);
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="focus-ring rounded-2xl bg-[var(--graphite)] px-4 py-2.5 text-xs font-bold text-white"
              onClick={() => {
                allowDuplicateRef.current = true;
              }}
            >
              Criar mesmo assim
            </button>
          </div>
        </div>
      ) : null}

      {pending ? (
        <p className="mb-4 text-sm font-semibold text-[var(--lavender-strong)]" aria-live="polite">
          Salvando...
        </p>
      ) : null}

      <PetFields
        key={fieldsKey}
        includeInitialWeight
        disabled={!configured}
        initialWeightKg={draft?.initial_weight_kg ?? ""}
        defaultValues={
          draft
            ? {
                name: draft.name,
                sex: (draft.sex as "male" | "female" | "unknown") || "unknown",
                birth_date: draft.birth_date || null,
                birth_date_estimated: draft.birth_date_estimated,
                breed: draft.breed || null,
                color: draft.color || null,
                neutered: draft.neutered,
                neutered_at: draft.neutered_at || null,
                neutered_place: draft.neutered_place || null,
                has_microchip: draft.has_microchip,
                microchip_number: draft.microchip_number || null,
                microchip_implanted_at: draft.microchip_implanted_at || null,
                microchip_location: draft.microchip_location || null,
                notes: draft.notes || null,
              }
            : undefined
        }
      />
      <SubmitButton
        disabled={!configured || pending}
        pendingLabel="Salvando..."
        className="focus-ring mt-7 w-full rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Salvar pet
      </SubmitButton>
    </form>
  );
}
