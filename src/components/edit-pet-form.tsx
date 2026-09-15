"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { HomonymNameDialog } from "@/components/homonym-name-dialog";
import { PetFields } from "@/components/pet-fields";
import { SubmitButton } from "@/components/submit-button";
import type { UpdatePetResult } from "@/app/(app)/pets/actions";
import type { Pet } from "@/types/database";

function attachPreservedPhoto(formData: FormData, preserved: File | null) {
  const current = formData.get("photo");
  if (current instanceof File && current.size > 0) return;
  if (preserved && preserved.size > 0) formData.set("photo", preserved);
}

/**
 * Edit-pet form with server-authoritative active-homonym confirmation.
 * Imperative Server Action avoids form/File reset on soft duplicate warnings.
 */
export function EditPetForm({
  pet,
  action,
  initialError,
}: {
  pet: Pet;
  action: (formData: FormData) => Promise<UpdatePetResult>;
  initialError?: string | null;
}) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [duplicate, setDuplicate] = useState<{ name: string; existingLabel: string } | null>(null);
  const allowDuplicateRef = useRef(false);
  const photoFileRef = useRef<File | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const originalName = pet.name;
  const [pending, startTransition] = useTransition();

  const closeDuplicateRestoreName = useCallback(() => {
    allowDuplicateRef.current = false;
    setDuplicate(null);
    // EDIT cancel: restore original name (not empty); keep other unsaved edits + File.
    if (nameInputRef.current) {
      nameInputRef.current.value = originalName;
      nameInputRef.current.focus();
    }
  }, [originalName]);

  function runUpdate(form: HTMLFormElement, allowDuplicate: boolean) {
    startTransition(async () => {
      setError(null);
      if (!allowDuplicate) setDuplicate(null);
      const formData = new FormData(form);
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
          runUpdate(form, allowDuplicate);
        }}
      >
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
          defaultValues={pet}
          nameInputRef={nameInputRef}
          onPhotoFileChange={(file) => {
            photoFileRef.current = file;
          }}
        />
        <SubmitButton
          disabled={pending}
          pendingLabel="Salvando..."
          className="focus-ring mt-7 w-full rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Salvar alterações
        </SubmitButton>
      </form>

      <HomonymNameDialog
        open={Boolean(duplicate)}
        pending={pending}
        description={
          duplicate
            ? `Encontramos “${duplicate.existingLabel}” ativo nesta família. Deseja continuar mesmo assim?`
            : ""
        }
        confirmLabel="Salvar mesmo assim"
        onCancel={closeDuplicateRestoreName}
        onConfirm={() => {
          allowDuplicateRef.current = true;
          setDuplicate(null);
          const form = formRef.current;
          if (form) runUpdate(form, true);
        }}
      />
    </>
  );
}
