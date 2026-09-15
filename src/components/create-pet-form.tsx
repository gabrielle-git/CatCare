"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { HomonymNameDialog } from "@/components/homonym-name-dialog";
import { PetFields } from "@/components/pet-fields";
import { SubmitButton } from "@/components/submit-button";
import type { CreatePetResult } from "@/app/(app)/pets/actions";

/**
 * Ensure photo File stays on FormData even if the native file input was cleared.
 * Holds a single File reference — no base64, no pre-upload.
 */
function attachPreservedPhoto(formData: FormData, preserved: File | null) {
  const current = formData.get("photo");
  if (current instanceof File && current.size > 0) return;
  if (preserved && preserved.size > 0) formData.set("photo", preserved);
}

/**
 * New-pet form: stable pet_id + weight intent, pending UX, accessible homonym dialog.
 * Uses imperative Server Action (preventDefault) so React does not reset the form —
 * including the selected photo File — when a soft duplicate warning returns.
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
  const [petId] = useState(() => crypto.randomUUID());
  const [weightRecordId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [duplicate, setDuplicate] = useState<{ name: string; existingLabel: string } | null>(null);
  const allowDuplicateRef = useRef(false);
  const photoFileRef = useRef<File | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  const closeDuplicateClearName = useCallback(() => {
    allowDuplicateRef.current = false;
    setDuplicate(null);
    // CREATE cancel: clear only Nome; keep same intent IDs and other fields/File.
    if (nameInputRef.current) {
      nameInputRef.current.value = "";
      nameInputRef.current.focus();
    }
  }, []);

  function runCreate(form: HTMLFormElement, allowDuplicate: boolean) {
    startTransition(async () => {
      setError(null);
      if (!allowDuplicate) setDuplicate(null);
      const formData = new FormData(form);
      formData.set("pet_id", petId);
      formData.set("initial_weight_record_id", weightRecordId);
      if (allowDuplicate) formData.set("allow_duplicate_name", "true");
      else formData.delete("allow_duplicate_name");
      const selected = formData.get("photo");
      if (selected instanceof File && selected.size > 0) photoFileRef.current = selected;
      attachPreservedPhoto(formData, photoFileRef.current);

      try {
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
  }

  return (
    <>
      <form
        ref={formRef}
        className="cat-card mt-6 p-5 md:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const allowDuplicate = allowDuplicateRef.current;
          allowDuplicateRef.current = false;
          runCreate(form, allowDuplicate);
        }}
      >
        <input type="hidden" name="pet_id" value={petId} />
        <input type="hidden" name="initial_weight_record_id" value={weightRecordId} />

        {error ? (
          <div className="mb-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        {pending ? (
          <p className="mb-4 text-sm font-semibold text-[var(--lavender-strong)]" aria-live="polite">
            Salvando...
          </p>
        ) : null}

        <PetFields
          includeInitialWeight
          disabled={!configured}
          nameInputRef={nameInputRef}
          onPhotoFileChange={(file) => {
            photoFileRef.current = file;
          }}
        />
        <SubmitButton
          disabled={!configured || pending}
          pendingLabel="Salvando..."
          className="focus-ring mt-7 w-full rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Salvar pet
        </SubmitButton>
      </form>

      <HomonymNameDialog
        open={Boolean(duplicate)}
        pending={pending}
        description={
          duplicate
            ? `Encontramos “${duplicate.existingLabel}” ativo nesta família. Deseja continuar mesmo assim e criar outro “${duplicate.name}”?`
            : ""
        }
        confirmLabel="Criar mesmo assim"
        onCancel={closeDuplicateClearName}
        onConfirm={() => {
          allowDuplicateRef.current = true;
          setDuplicate(null);
          const form = formRef.current;
          if (form) runCreate(form, true);
        }}
      />
    </>
  );
}
