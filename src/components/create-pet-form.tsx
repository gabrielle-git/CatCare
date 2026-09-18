"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { HomonymNameDialog } from "@/components/homonym-name-dialog";
import { PetFields } from "@/components/pet-fields";
import { ProfilePhotoCropDialog } from "@/components/profile-photo-crop-dialog";
import { SubmitButton } from "@/components/submit-button";
import type { CreatePetResult } from "@/app/(app)/pets/actions";
import {
  compensatePetPhotoIfNeeded,
  runDirectPetPhotoUpload,
} from "@/lib/pet-photo-direct-upload-client";

/**
 * New-pet form: stable pet_id + weight intent, pending UX, 1:1 crop, direct photo upload.
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
  const [photoIntentId, setPhotoIntentId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [status, setStatus] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ name: string; existingLabel: string } | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const allowDuplicateRef = useRef(false);
  const photoFileRef = useRef<File | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  const closeDuplicateClearName = useCallback(() => {
    allowDuplicateRef.current = false;
    setDuplicate(null);
    if (nameInputRef.current) {
      nameInputRef.current.value = "";
      nameInputRef.current.focus();
    }
  }, []);

  function runCreate(form: HTMLFormElement, allowDuplicate: boolean) {
    startTransition(async () => {
      setError(null);
      setStatus(null);
      if (!allowDuplicate) setDuplicate(null);
      const formData = new FormData(form);
      formData.set("pet_id", petId);
      formData.set("initial_weight_record_id", weightRecordId);
      if (allowDuplicate) formData.set("allow_duplicate_name", "true");
      else formData.delete("allow_duplicate_name");

      let newlyCreatedPaths: string[] = [];
      try {
        newlyCreatedPaths = (
          await runDirectPetPhotoUpload(formData, petId, photoIntentId, photoFileRef.current, (progress) => {
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

        {status || pending ? (
          <p className="mb-4 text-sm font-semibold text-[var(--lavender-strong)]" aria-live="polite">
            {status ?? "Salvando..."}
          </p>
        ) : null}

        <PetFields
          includeInitialWeight
          disabled={!configured || pending}
          nameInputRef={nameInputRef}
          croppedFile={croppedFile}
          onRequestCrop={(file) => setCropFile(file)}
          onClearCropped={() => {
            photoFileRef.current = null;
            setCroppedFile(null);
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

      <ProfilePhotoCropDialog
        open={Boolean(cropFile)}
        file={cropFile}
        pending={pending}
        onCancel={() => setCropFile(null)}
        onConfirm={(cropped) => {
          photoFileRef.current = cropped;
          setCroppedFile(cropped);
          setPhotoIntentId(crypto.randomUUID());
          setCropFile(null);
        }}
      />

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
