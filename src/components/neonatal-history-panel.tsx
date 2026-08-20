"use client";

import { useMemo, useState } from "react";
import { TimelineList } from "@/components/timeline-list";
import { formatPeriodLabel, isInDateRange, todayIsoDate } from "@/lib/neonatal-stats";
import type { TimelineItem } from "@/types/database";

export function NeonatalHistoryPanel({
  items,
  petNames,
  editable,
}: {
  items: TimelineItem[];
  petNames: Record<string, string>;
  editable: boolean;
}) {
  const today = todayIsoDate();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const filtered = useMemo(
    () => items.filter((item) => isInDateRange(item.occurred_at, from, to)),
    [from, items, to],
  );

  return (
    <div className="space-y-4">
      <section className="cat-card p-4 md:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9a536c]">Filtrar por data</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[140px] flex-1">
            <label className="block text-[11px] font-bold text-[var(--muted)]">De</label>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="field mt-1.5" />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="block text-[11px] font-bold text-[var(--muted)]">Até</label>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="field mt-1.5" />
          </div>
          <button
            type="button"
            onClick={() => { setFrom(today); setTo(today); }}
            className="focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-bold text-[var(--muted)]"
          >
            Hoje
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {filtered.length} registro{filtered.length === 1 ? "" : "s"} {formatPeriodLabel(from, to)}.
        </p>
      </section>

      <TimelineList
        items={filtered}
        emptyText="Nenhum cuidado neste período."
        editable={editable}
        returnTo="/neonatal/historico"
        filterMode="neonatal"
        petNames={petNames}
        showNewRecord={editable}
      />
    </div>
  );
}
