"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { MORE_MENU_ACCOUNT, MORE_MENU_GROUPS } from "@/lib/more-menu";

export function MoreMenuSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };

    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      closeButtonRef.current?.focus();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="more-menu-sheet fixed inset-0 z-[80] m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/40 open:flex open:items-end open:justify-center"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div
        className="flex max-h-[min(88svh,720px)] w-full max-w-[520px] flex-col rounded-t-[28px] border border-[var(--border)] bg-[var(--background)] shadow-2xl"
        role="document"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">CatCare</p>
            <h2 id={titleId} className="text-lg font-bold tracking-[-0.03em]">
              Mais recursos
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="focus-ring grid size-10 place-items-center rounded-2xl border border-[var(--border)] bg-white text-[var(--muted)]"
            aria-label="Fechar menu Mais"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="space-y-5">
            {MORE_MENU_GROUPS.map((group) => (
              <section key={group.id} aria-label={group.label}>
                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                  {group.label}
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {group.items.map(({ label, detail, href, icon: Icon, tone }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className="focus-ring flex min-h-[108px] flex-col gap-2 rounded-[20px] border border-[var(--border)] bg-white p-3.5 transition hover:-translate-y-0.5"
                    >
                      <span className={`grid size-10 place-items-center rounded-[16px] ${tone}`}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <strong className="block text-sm leading-tight">{label}</strong>
                        <span className="mt-1 block text-[11px] leading-snug text-[var(--muted)]">{detail}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}

            <section aria-label="Conta">
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Conta</p>
              <Link
                href={MORE_MENU_ACCOUNT.href}
                onClick={onClose}
                className="focus-ring flex items-center gap-3 rounded-[20px] border border-[var(--border)] bg-white p-3.5"
              >
                {(() => {
                  const AccountIcon = MORE_MENU_ACCOUNT.icon;
                  return (
                    <span className={`grid size-10 shrink-0 place-items-center rounded-[16px] ${MORE_MENU_ACCOUNT.tone}`}>
                      <AccountIcon size={18} aria-hidden="true" />
                    </span>
                  );
                })()}
                <span className="min-w-0">
                  <strong className="block text-sm">{MORE_MENU_ACCOUNT.label}</strong>
                  <span className="mt-0.5 block text-[11px] text-[var(--muted)]">{MORE_MENU_ACCOUNT.detail}</span>
                </span>
              </Link>
            </section>
          </div>
        </div>
      </div>
    </dialog>
  );
}
