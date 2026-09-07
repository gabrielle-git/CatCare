"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TimelineList } from "@/components/timeline-list";
import {
  neonatalHistoryHref,
  resolveNeonatalHistoryRange,
  sortNeonatalTimelineItems,
} from "@/lib/neonatal-history";
import { formatPeriodLabel, isInDateRange, todayIsoDate } from "@/lib/neonatal-stats";
import type { TimelineItem } from "@/types/database";

export function NeonatalHistoryPanel({
  items,
  petNames,
  editable,
  initialFrom,
  initialTo,
}: {
  items: TimelineItem[];
  petNames: Record<string, string>;
  editable: boolean;
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const today = todayIsoDate();
  const range = resolveNeonatalHistoryRange(initialFrom, initialTo, today);

  const persistRange = useCallback(
    (from: string, to: string) => {
      const next = resolveNeonatalHistoryRange(from, to, today);
      router.replace(neonatalHistoryHref(next, pathname || "/neonatal/historico"), { scroll: false });
    },
    [pathname, router, today],
  );

  const filtered = useMemo(() => {
    const inRange = items.filter((item) => isInDateRange(item.occurred_at, range.from, range.to));
    return sortNeonatalTimelineItems(inRange, petNames);
  }, [items, petNames, range.from, range.to]);

  const returnTo = neonatalHistoryHref(range, pathname || "/neonatal/historico");

  return (
    <div className="space-y-4">
      <section className="cat-card p-4 md:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9a536c]">Filtrar por data</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[140px] flex-1">
            <label className="block text-[11px] font-bold text-[var(--muted)]">De</label>
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => persistRange(e.target.value, range.to)}
              className="field mt-1.5"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="block text-[11px] font-bold text-[var(--muted)]">Até</label>
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => persistRange(range.from, e.target.value)}
              className="field mt-1.5"
            />
          </div>
          <button
            type="button"
            onClick={() => persistRange(today, today)}
            className="focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-bold text-[var(--muted)]"
          >
            Hoje
          </button>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {filtered.length} registro{filtered.length === 1 ? "" : "s"} {formatPeriodLabel(range.from, range.to)}.
        </p>
      </section>

      <TimelineList
        items={filtered}
        emptyText="Nenhum cuidado neste período."
        editable={editable}
        returnTo={returnTo}
        filterMode="neonatal"
        petNames={petNames}
        showNewRecord={editable}
      />
    </div>
  );
}
