"use client";

import { useEffect, useId, useState } from "react";
import { Trash2, X } from "lucide-react";

export function DeleteHouseholdForm({
  householdName,
  action,
}: {
  householdName: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const matches = typed.trim() === householdName.trim();

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
        onClick={() => { setTyped(""); setOpen(true); }}
        className="focus-ring inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-[10px] font-bold text-[var(--danger)]"
      >
        <Trash2 size={13} /> Excluir família
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
                <p id={titleId} className="text-lg font-bold">Excluir esta família?</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">Isso apaga pets, registros, memórias, gastos e fotos. Não dá para desfazer.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="focus-ring grid size-8 shrink-0 place-items-center rounded-full text-[var(--muted)]" aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <form action={action} className="mt-4 space-y-3">
              <label className="block text-sm font-bold">
                Digite <span className="text-[var(--danger)]">{householdName}</span> para confirmar
                <input
                  name="confirm_name"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  autoFocus
                  className="field mt-2 py-2 text-sm"
                  placeholder={householdName}
                />
              </label>
              <button
                type="submit"
                disabled={!matches}
                className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--danger)] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={16} /> Excluir de vez
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
