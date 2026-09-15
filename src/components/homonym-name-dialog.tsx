"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * Accessible centered modal for active-homonym name decisions (create + edit).
 * Fixed overlay — visible regardless of form scroll position.
 */
export function HomonymNameDialog({
  open,
  title = "Já existe um pet com esse nome",
  description,
  confirmLabel,
  onCancel,
  onConfirm,
  pending = false,
}: {
  open: boolean;
  title?: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus stays inside the dialog; callers move focus after cancel/confirm.
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel, pending]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onClick={() => {
        if (!pending) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id={titleId} className="text-lg font-bold text-[var(--graphite)]">
              {title}
            </p>
            <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="focus-ring grid size-8 shrink-0 place-items-center rounded-full text-[var(--muted)] disabled:opacity-50"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="focus-ring inline-flex w-full items-center justify-center rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmLabel}
          </button>
          <button
            ref={cancelRef}
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="focus-ring inline-flex w-full items-center justify-center rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-bold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
