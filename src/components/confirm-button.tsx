"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

export function ConfirmButton({
  message,
  children,
  className,
  title = "Tem certeza?",
  confirmLabel = "Confirmar",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const submitRef = useRef<HTMLButtonElement>(null);

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
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <button ref={submitRef} type="submit" hidden tabIndex={-1} aria-hidden="true" />
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
                <p id={titleId} className="text-lg font-bold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{message}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="focus-ring grid size-8 shrink-0 place-items-center rounded-full text-[var(--muted)]" aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  submitRef.current?.click();
                }}
                className="focus-ring inline-flex w-full items-center justify-center rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white"
              >
                {confirmLabel}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="focus-ring inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-bold text-[var(--muted)]">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
