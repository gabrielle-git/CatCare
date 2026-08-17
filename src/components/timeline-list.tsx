"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { ClipboardPlus, Droplets, Milk, Pill, Scale, Stethoscope, Syringe, Thermometer, type LucideIcon } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { TimelineItem } from "@/types/database";

const toneClasses = {
  lavender: "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]",
  rose: "bg-[var(--rose-soft)] text-[#9a536c]",
  mint: "bg-[var(--mint-soft)] text-[var(--success)]",
  peach: "bg-[#fbead9] text-[#96613e]",
};

function iconFor(kind: TimelineItem["kind"]): LucideIcon {
  if (kind === "weight") return Scale;
  if (kind === "feeding") return Milk;
  if (kind === "urine" || kind === "stool") return Droplets;
  if (kind === "temperature") return Thermometer;
  if (kind === "vaccine") return Syringe;
  if (kind === "medication") return Pill;
  if (kind === "consultation" || kind === "exam") return Stethoscope;
  return ClipboardPlus;
}

export function TimelineList({
  items,
  emptyText = "Nenhum cuidado registrado ainda.",
  editable = false,
  deleteAction,
}: {
  items: TimelineItem[];
  emptyText?: string;
  editable?: boolean;
  deleteAction?: (item: TimelineItem) => (formData: FormData) => Promise<void>;
}) {
  if (items.length === 0) {
    return <div className="rounded-[20px] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">{emptyText}</div>;
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => {
        const Icon = iconFor(item.kind);
        const editHref = `/records/${item.id}/edit?source=${item.source}&kind=${encodeURIComponent(item.kind)}`;
        const remove = deleteAction?.(item);
        return (
          <li key={`${item.source}-${item.kind}-${item.id}`} className="flex gap-3 rounded-[20px] border border-[var(--border)] bg-white p-3.5">
            <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${toneClasses[item.tone]}`}><Icon size={18} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold">{item.title}</p>
                <time className="shrink-0 text-[11px] text-[var(--muted)]" dateTime={item.occurred_at}>{formatDateTime(item.occurred_at)}</time>
              </div>
              {item.detail && <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{item.detail}</p>}
              {editable && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={editHref} className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[var(--lavender-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--lavender-strong)]"><Pencil size={13} /> Editar</Link>
                  {remove && (
                    <form action={remove}>
                      <ConfirmButton message="Apagar este registro permanentemente? Esta ação não pode ser desfeita." className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-[11px] font-bold text-[var(--danger)]"><Trash2 size={13} /> Apagar</ConfirmButton>
                    </form>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
