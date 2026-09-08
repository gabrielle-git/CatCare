"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { appButtonClass } from "@/lib/ui-button";

export function RoutineCompleteButton({
  routineId,
  pets,
  editable,
  completeAction,
}: {
  routineId: string;
  pets: { id: string; name: string; pending: boolean }[];
  editable: boolean;
  completeAction: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const pendingPets = pets.filter((pet) => pet.pending);

  const close = () => dialogRef.current?.close();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, []);

  if (!editable || pendingPets.length === 0) {
    return (
      <button
        type="button"
        disabled
        aria-label="Concluir rotina indisponível"
        title={editable ? "Nada pendente" : "Somente leitura"}
        className="focus-ring grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--muted)] opacity-55"
      >
        <Check size={16} />
      </button>
    );
  }

  if (pendingPets.length === 1) {
    return (
      <form action={completeAction}>
        <input type="hidden" name="pet_ids" value={pendingPets[0].id} />
        <button
          type="submit"
          aria-label={`Concluir ${pendingPets[0].name}`}
          title={`Concluir para ${pendingPets[0].name}`}
          className="focus-ring grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--muted)] transition hover:border-[var(--mint)] hover:bg-[var(--mint-soft)] hover:text-[var(--success)]"
        >
          <Check size={16} />
        </button>
      </form>
    );
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(pendingPets.map((pet) => pet.id)));
  const clearAll = () => setSelected(new Set());

  const openDialog = () => {
    setSelected(new Set());
    dialogRef.current?.showModal();
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        aria-label="Concluir rotina"
        title="Escolher pets concluídos"
        className="focus-ring grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-white text-[var(--muted)] transition hover:border-[var(--mint)] hover:bg-[var(--mint-soft)] hover:text-[var(--success)]"
      >
        <Check size={16} />
      </button>

      <dialog
        ref={dialogRef}
        className="routine-complete-dialog fixed inset-0 z-[80] m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/40 open:flex open:items-end open:justify-center sm:open:items-center"
        aria-labelledby={`complete-routine-${routineId}`}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        <div
          className="w-full max-w-md rounded-t-[24px] border border-[var(--border)] bg-[var(--cream)] shadow-2xl sm:rounded-[24px]"
          onClick={(event) => event.stopPropagation()}
        >
          <form
            action={completeAction}
            className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onSubmit={(event) => {
              if (selected.size === 0) event.preventDefault();
            }}
          >
            <h2 id={`complete-routine-${routineId}`} className="text-lg font-bold">
              Concluir rotina
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Para quais pets você realizou este cuidado?
            </p>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={selectAll} className={appButtonClass("secondary")}>
                Selecionar todos
              </button>
              <button type="button" onClick={clearAll} className={appButtonClass("secondary")}>
                Limpar
              </button>
            </div>

            <div className="mt-4 space-y-2" role="group" aria-label="Pets para concluir">
              {pendingPets.map((pet) => (
                <label
                  key={pet.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                    selected.has(pet.id)
                      ? "border-[var(--lavender)] bg-[var(--lavender-soft)]/50"
                      : "border-[var(--border)] bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="pet_ids"
                    value={pet.id}
                    checked={selected.has(pet.id)}
                    onChange={() => toggle(pet.id)}
                    className="size-4 accent-[var(--lavender)]"
                  />
                  {pet.name}
                </label>
              ))}
            </div>

            {selected.size === 0 && (
              <p className="mt-3 text-sm font-semibold text-[var(--danger)]" role="alert">
                Selecione ao menos um pet.
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="focus-ring rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold"
              >
                Cancelar
              </button>
              <SubmitButton
                disabled={selected.size === 0}
                className="focus-ring rounded-2xl bg-[var(--graphite)] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
              >
                Registrar conclusão
              </SubmitButton>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
