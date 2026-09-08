"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ListFilter, Search } from "lucide-react";
import { TimelineList } from "@/components/timeline-list";
import {
  FAMILY_HISTORY_TYPE_OPTIONS,
  familyHistoryHasAdvancedFilters,
  familyHistoryHref,
  filterFamilyHistoryItems,
  resolveFamilyHistoryFilters,
  type FamilyHistoryFilters,
  type FamilyHistoryTypeFilter,
} from "@/lib/family-history";
import { todayIsoDate } from "@/lib/neonatal-stats";
import type { TimelineItem } from "@/types/database";

type PetOption = { id: string; name: string };

export function FamilyHistoryPanel({
  items,
  pets,
  editable,
  initialQ,
  initialFrom,
  initialTo,
  initialType,
}: {
  items: TimelineItem[];
  pets: PetOption[];
  editable: boolean;
  initialQ?: string | null;
  initialFrom?: string | null;
  initialTo?: string | null;
  initialType?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const today = todayIsoDate();

  const filters = useMemo(
    () =>
      resolveFamilyHistoryFilters({
        q: initialQ,
        from: initialFrom,
        to: initialTo,
        type: initialType,
      }),
    [initialQ, initialFrom, initialTo, initialType],
  );

  const advancedOpenDefault = familyHistoryHasAdvancedFilters(filters);
  const [filtersOpen, setFiltersOpen] = useState(advancedOpenDefault);
  const [draftQ, setDraftQ] = useState(filters.q);

  useEffect(() => {
    setDraftQ(filters.q);
  }, [filters.q]);

  const persist = useCallback(
    (next: FamilyHistoryFilters) => {
      router.replace(familyHistoryHref(next, pathname || "/historico"), { scroll: false });
    },
    [pathname, router],
  );

  useEffect(() => {
    const normalized = draftQ.trim();
    if (normalized === filters.q) return;
    const timer = window.setTimeout(() => {
      persist({ ...filters, q: normalized.slice(0, 120) });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [draftQ, filters, persist]);

  const petNames = useMemo(
    () => Object.fromEntries(pets.map((pet) => [pet.id, pet.name])),
    [pets],
  );

  const filtered = useMemo(
    () => filterFamilyHistoryItems(items, filters, petNames),
    [items, filters, petNames],
  );

  const returnTo = familyHistoryHref(filters, pathname || "/historico");
  const hasAdvanced = familyHistoryHasAdvancedFilters(filters);
  const hasActiveQuery = Boolean(filters.q);
  const resultLabel =
    hasAdvanced || hasActiveQuery
      ? `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`
      : `${filtered.length} registro${filtered.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-4">
      <section className="cat-card space-y-3 p-4 md:p-5">
        <label className="relative block">
          <span className="sr-only">Buscar no histórico</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={draftQ}
            onChange={(event) => setDraftQ(event.target.value)}
            placeholder="Buscar por leite, vacina, consulta..."
            className="field w-full pl-10"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>

        <div>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className={`focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              hasAdvanced
                ? "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]"
                : "border border-[var(--border)] bg-white text-[var(--muted)]"
            }`}
            aria-expanded={filtersOpen}
            aria-controls="family-history-filters"
          >
            <ListFilter size={14} aria-hidden="true" />
            Filtros
            {hasAdvanced ? <span className="text-[10px]">• ativos</span> : null}
            <ChevronDown
              size={14}
              className={`transition ${filtersOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          <div id="family-history-filters" hidden={!filtersOpen} className={filtersOpen ? "mt-4 space-y-5" : undefined}>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--lavender-strong)]">Período</p>
              <div className="mt-2.5 flex flex-wrap items-end gap-3">
                <div className="min-w-[140px] flex-1">
                  <label className="block text-[11px] font-bold text-[var(--muted)]">De</label>
                  <input
                    type="date"
                    value={filters.from ?? ""}
                    max={filters.to ?? undefined}
                    onChange={(e) => {
                      persist(
                        resolveFamilyHistoryFilters({
                          q: filters.q,
                          from: e.target.value || null,
                          to: filters.to,
                          type: filters.type,
                        }),
                      );
                    }}
                    className="field mt-1.5"
                  />
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className="block text-[11px] font-bold text-[var(--muted)]">Até</label>
                  <input
                    type="date"
                    value={filters.to ?? ""}
                    min={filters.from ?? undefined}
                    onChange={(e) => {
                      persist(
                        resolveFamilyHistoryFilters({
                          q: filters.q,
                          from: filters.from,
                          to: e.target.value || null,
                          type: filters.type,
                        }),
                      );
                    }}
                    className="field mt-1.5"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    persist(
                      resolveFamilyHistoryFilters({
                        q: filters.q,
                        from: today,
                        to: today,
                        type: filters.type,
                      }),
                    )
                  }
                  className="focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-bold text-[var(--muted)]"
                >
                  Hoje
                </button>
                {(filters.from || filters.to) && (
                  <button
                    type="button"
                    onClick={() => persist({ ...filters, from: null, to: null })}
                    className="focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-bold text-[var(--muted)]"
                  >
                    Limpar datas
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--lavender-strong)]">Tipo</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {FAMILY_HISTORY_TYPE_OPTIONS.map((option) => (
                  <FilterChip
                    key={option.value}
                    active={filters.type === option.value}
                    label={option.label}
                    onClick={() =>
                      persist({
                        ...filters,
                        type: option.value as FamilyHistoryTypeFilter,
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <p className="px-1 text-[11px] text-[var(--muted)]">{resultLabel}</p>

      <TimelineList
        items={filtered}
        emptyText="Nenhum cuidado encontrado com essa busca."
        editable={editable}
        returnTo={returnTo}
        filterMode="all"
        petNames={petNames}
        showNewRecord={editable}
        showTypeFilters={false}
        showResultCount={false}
      />
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
        active ? "bg-[var(--graphite)] text-white" : "border border-[var(--border)] bg-white text-[var(--muted)]"
      }`}
    >
      {label}
    </button>
  );
}
