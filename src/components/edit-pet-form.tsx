"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { HomonymNameDialog } from "@/components/homonym-name-dialog";
import { PetFields } from "@/components/pet-fields";
import { SubmitButton } from "@/components/submit-button";
import type { UpdatePetResult } from "@/app/(app)/pets/actions";
import type { Pet } from "@/types/database";
import {
  compensatePetPhotoIfNeeded,
  runDirectPetPhotoUpload,
} from "@/lib/pet-photo-direct-upload-client";

/**
 * Edit-pet form with direct photo upload and safe replace (DB before old cleanup).
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
  const [status, setStatus] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ name: string; existingLabel: string } | null>(null);
  const [photoIntentId, setPhotoIntentId] = useState(() => crypto.randomUUID());
  const allowDuplicateRef = useRef(false);
  const photoFileRef = useRef<File | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const originalName = pet.name;
  const [pending, startTransition] = useTransition();

  const closeDuplicateRestoreName = useCallback(() => {
    allowDuplicateRef.current = false;
    setDuplicate(null);
    if (nameInputRef.current) {
      nameInputRef.current.value = originalName;
      nameInputRef.current.focus();
    }
  }, [originalName]);

  function runUpdate(form: HTMLFormElement, allowDuplicate: boolean) {
    startTransition(async () => {
      setError(null);
      setStatus(null);
      if (!allowDuplicate) setDuplicate(null);
      const formData = new FormData(form);
      if (allowDuplicate) formData.set("allow_duplicate_name", "true");
      else formData.delete("allow_duplicate_name");

      const selected = formData.get("photo");
      if (selected instanceof File && selected.size > 0) photoFileRef.current = selected;

      let newlyCreatedPaths: string[] = [];
      try {
        newlyCreatedPaths = (
          await runDirectPetPhotoUpload(formData, pet.id, photoIntentId, photoFileRef.current, (progress) => {
            setStatus(progress.message);
          })
        ).newlyCreatedPaths;
        setStatus("Salvando...");
        const result = await action(formData);
        if (result.ok) {
          window.location.replace(result.redirectTo);
          return;
        }
        if (newlyCreatedPaths.length) await compensatePetPhotoIfNeeded(newlyCreatedPaths);
        if ("duplicateName" in result && result.duplicateName) {
          allowDuplicateRef.current = false;
          setDuplicate({ name: result.name, existingLabel: result.existingLabel });
          setStatus(null);
          return;
        }
        allowDuplicateRef.current = false;
        setError("error" in result ? result.error : "Não foi possível salvar. Tente novamente.");
        setStatus(null);
      } catch (cause) {
        if (newlyCreatedPaths.length) await compensatePetPhotoIfNeeded(newlyCreatedPaths);
        allowDuplicateRef.current = false;
        setError(cause instanceof Error ? cause.message : "Não foi possível salvar. Tente novamente.");
        setStatus(null);
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

        {status || pending ? (
          <p className="mb-4 text-sm font-semibold text-[var(--lavender-strong)]" aria-live="polite">
            {status ?? "Salvando..."}
          </p>
        ) : null}

        <PetFields
          defaultValues={pet}
          disabled={pending}
          nameInputRef={nameInputRef}
          onPhotoFileChange={(file) => {
            photoFileRef.current = file;
            setPhotoIntentId(crypto.randomUUID());
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
