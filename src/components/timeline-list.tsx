"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardPlus, Droplets, Milk, Pill, Pencil, Scale, Stethoscope, Syringe, Thermometer, Trash2, type LucideIcon } from "lucide-react";
import { deleteRecord, deleteRecords } from "@/app/(app)/records/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { formatDateTime } from "@/lib/format";
import type { TimelineItem } from "@/types/database";

const toneClasses = {
  lavender: "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]",
  rose: "bg-[var(--rose-soft)] text-[#9a536c]",
  mint: "bg-[var(--mint-soft)] text-[var(--success)]",
  peach: "bg-[#fbead9] text-[#96613e]",
};

const neonatalFilters = [
  { value: "all", label: "Todos" },
  { value: "feeding", label: "Mamada" },
  { value: "urine", label: "Xixi" },
  { value: "stool", label: "Cocô" },
  { value: "temperature", label: "Temp." },
  { value: "weight", label: "Peso" },
] as const;

const fullFilters = [
  ...neonatalFilters,
  { value: "vaccine", label: "Vacina" },
  { value: "deworming", label: "Vermífugo" },
  { value: "medication", label: "Remédio" },
  { value: "consultation", label: "Consulta" },
  { value: "observation", label: "Nota" },
] as const;

function iconFor(kind: TimelineItem["kind"]): LucideIcon {
  if (kind === "weight") return Scale;
  if (kind === "feeding") return Milk;
  if (kind === "urine" || kind === "stool") return Droplets;
  if (kind === "temperature") return Thermometer;
  if (kind === "vaccine") return Syringe;
  if (kind === "deworming") return Pill;
  if (kind === "medication") return Pill;
  if (kind === "consultation" || kind === "exam") return Stethoscope;
  return ClipboardPlus;
}

export function TimelineList({
  items,
  emptyText = "Nenhum cuidado registrado ainda.",
  editable = false,
  returnTo,
  filterMode = "all",
  petNames,
}: {
  items: TimelineItem[];
  emptyText?: string;
  editable?: boolean;
  returnTo?: string;
  filterMode?: "neonatal" | "all";
  /** When set, shows "Mamada · Luna" style labels (for multi-pet lists like neonatal). */
  petNames?: Record<string, string>;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filters = filterMode === "neonatal" ? neonatalFilters : fullFilters;
  const fallbackReturn = returnTo ?? "/";

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelected(new Set());
  }

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.kind === filter)),
    [items, filter],
  );

  const selectedItems = filtered.filter((item) => selected.has(item.id));
  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((item) => next.delete(item.id));
        return next;
      });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((item) => next.add(item.id));
      return next;
    });
  }

  if (items.length === 0) {
    return <div className="rounded-[20px] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">{emptyText}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`focus-ring rounded-full px-3 py-1.5 text-[11px] font-bold transition ${filter === value ? "bg-[var(--graphite)] text-white" : "border border-[var(--border)] bg-white text-[var(--muted)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-[var(--muted)]">
          {filter === "all" ? `${items.length} registro${items.length === 1 ? "" : "s"}` : `${filtered.length} de ${items.length} registros`}
        </p>
        {editable && filtered.length > 0 && !selectionMode && (
          <button
            type="button"
            onClick={() => setSelectionMode(true)}
            className="focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--muted)]"
          >
            Selecionar
          </button>
        )}
      </div>

      {editable && selectionMode && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--cream)]/50 px-3.5 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} className="size-4 accent-[var(--lavender)]" />
            Selecionar tudo ({filtered.length})
          </label>
          <button
            type="button"
            onClick={exitSelectionMode}
            className="focus-ring rounded-full px-2.5 py-1 text-[11px] font-bold text-[var(--muted)]"
          >
            Cancelar
          </button>
          {selectedItems.length > 0 && (
            <form action={deleteRecords} className="ml-auto">
              <input type="hidden" name="return_to" value={fallbackReturn} />
              <input
                type="hidden"
                name="records"
                value={JSON.stringify(selectedItems.map((item) => ({ id: item.id, source: item.source, petId: item.pet_id })))}
              />
              <ConfirmButton
                title={`Apagar ${selectedItems.length} registro${selectedItems.length > 1 ? "s" : ""}?`}
                message="Esta ação remove os registros selecionados permanentemente e não pode ser desfeita."
                confirmLabel={`Apagar ${selectedItems.length}`}
                className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[var(--danger)] px-3 py-1.5 text-[11px] font-bold text-white"
              >
                <Trash2 size={13} /> Apagar selecionados
              </ConfirmButton>
            </form>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">Nenhum registro neste filtro.</div>
      ) : (
        <ol className="space-y-3">
          {filtered.map((item) => {
            const Icon = iconFor(item.kind);
            const editHref = `/records/${item.id}/edit?source=${item.source}&kind=${encodeURIComponent(item.kind)}`;
            const remove = deleteRecord.bind(null, item.id, item.source, item.pet_id);
            const checked = selected.has(item.id);
            const petLabel = petNames?.[item.pet_id];
            const heading = petLabel ? `${item.title} · ${petLabel}` : item.title;
            return (
              <li key={`${item.source}-${item.kind}-${item.id}`} className={`flex gap-3 rounded-[20px] border bg-white p-3.5 ${checked ? "border-[var(--lavender)] ring-1 ring-[var(--lavender-soft)]" : "border-[var(--border)]"}`}>
                {editable && selectionMode && (
                  <label className="flex shrink-0 items-start pt-2">
                    <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} className="size-4 accent-[var(--lavender)]" aria-label={`Selecionar ${item.title}`} />
                  </label>
                )}
                <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${toneClasses[item.tone]}`}><Icon size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold">{heading}</p>
                    <time className="shrink-0 text-[11px] text-[var(--muted)]" dateTime={item.occurred_at}>{formatDateTime(item.occurred_at)}</time>
                  </div>
                  {item.detail && <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{item.detail}</p>}
                  {editable && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={editHref} className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[var(--lavender-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--lavender-strong)]"><Pencil size={13} /> Editar</Link>
                      <form action={remove}>
                        <input type="hidden" name="return_to" value={fallbackReturn} />
                        <ConfirmButton message="Apagar este registro permanentemente? Esta ação não pode ser desfeita." className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-[11px] font-bold text-[var(--danger)]"><Trash2 size={13} /> Apagar</ConfirmButton>
                      </form>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
