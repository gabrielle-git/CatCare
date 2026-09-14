"use client";

import { useId, useRef, useState, useTransition } from "react";
import { PetFields } from "@/components/pet-fields";
import { SubmitButton } from "@/components/submit-button";
import type { CreatePetResult } from "@/app/(app)/pets/actions";

/**
 * New-pet form: stable pet_id + weight intent across retries,
 * pending UX, and server-driven active-homonym confirmation.
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
  const allowDuplicateRef = useRef(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="cat-card mt-6 p-5 md:p-7"
      action={(formData) => {
        startTransition(async () => {
          setError(null);
          const allowDuplicate = allowDuplicateRef.current;
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
              setDuplicate({ name: result.name, existingLabel: result.existingLabel });
              return;
            }
            allowDuplicateRef.current = false;
            setError("error" in result ? result.error : "Não foi possível salvar. Tente novamente.");
          } catch (cause) {
            allowDuplicateRef.current = false;
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

      <PetFields includeInitialWeight disabled={!configured || pending} />
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
