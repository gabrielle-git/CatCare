"use client";

import { useEffect, useId, useState } from "react";
import { LogOut, X } from "lucide-react";

export function LeaveHouseholdForm({
  householdName,
  action,
}: {
  householdName: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring inline-flex items-center justify-center gap-1 rounded-xl border border-[var(--border)] px-3 py-2 text-[10px] font-bold text-[var(--muted)]"
      >
        <LogOut size={13} /> Sair da família
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="presentation" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p id={titleId} className="text-lg font-bold">Sair de {householdName}?</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">Você deixa de ver os gatos e os registros desta família. Para voltar, alguém precisa convidar você de novo.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="focus-ring grid size-8 shrink-0 place-items-center rounded-full text-[var(--muted)]" aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <form action={action} className="flex-1">
                <button type="submit" className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white">
                  <LogOut size={16} /> Sair da família
                </button>
              </form>
              <button type="button" onClick={() => setOpen(false)} className="focus-ring inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-bold text-[var(--muted)] sm:flex-1">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
