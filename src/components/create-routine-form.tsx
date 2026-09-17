"use client";

import { useState, useTransition } from "react";
import { RoutineFormFields } from "@/components/routine-form-fields";
import type { CreateRoutineResult } from "@/app/(app)/routines/actions";

/**
 * Create routine with stable routine_id for the form mount + pending UX.
 * Edit flows keep using native form actions without a new intent id.
 */
export function CreateRoutineForm({
  action,
  pets,
  configured,
  initialError,
}: {
  action: (formData: FormData) => Promise<CreateRoutineResult>;
  pets: { id: string; name: string }[];
  configured: boolean;
  initialError?: string | null;
}) {
  const [routineId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="cat-card mt-6 space-y-1 p-5 md:p-7"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        startTransition(async () => {
          setError(null);
          const formData = new FormData(form);
          formData.set("routine_id", routineId);
          try {
            const result = await action(formData);
            if (result.ok) {
              window.location.replace(result.redirectTo);
              return;
            }
            setError(result.error);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Não foi possível salvar. Tente novamente.");
          }
        });
      }}
    >
      <input type="hidden" name="routine_id" value={routineId} />
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
      <RoutineFormFields pets={pets} disabled={!configured || pending} submitLabel="Salvar rotina" />
    </form>
  );
}
