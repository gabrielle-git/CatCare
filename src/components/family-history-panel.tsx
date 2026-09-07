"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TimelineList } from "@/components/timeline-list";
import {
  FAMILY_HISTORY_TYPE_OPTIONS,
  familyHistoryHref,
  filterFamilyHistoryItems,
  resolveFamilyHistoryFilters,
  type FamilyHistoryFilters,
  type FamilyHistoryTypeFilter,
} from "@/lib/family-history";
import { formatPeriodLabel, todayIsoDate } from "@/lib/neonatal-stats";
import type { TimelineItem } from "@/types/database";

type PetOption = { id: string; name: string };

export function FamilyHistoryPanel({
  items,
  pets,
  editable,
  initialPet,
  initialFrom,
  initialTo,
  initialType,
}: {
  items: TimelineItem[];
  pets: PetOption[];
  editable: boolean;
  initialPet?: string | null;
  initialFrom?: string | null;
  initialTo?: string | null;
  initialType?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const today = todayIsoDate();
  const knownPetIds = useMemo(() => pets.map((pet) => pet.id), [pets]);

  const filters = useMemo(
    () =>
      resolveFamilyHistoryFilters({
        pet: initialPet,
        from: initialFrom,
        to: initialTo,
        type: initialType,
        knownPetIds,
      }),
    [initialPet, initialFrom, initialTo, initialType, knownPetIds],
  );

  const persist = useCallback(
    (next: FamilyHistoryFilters) => {
      const href = familyHistoryHref(next, pathname || "/historico");
      router.replace(href, { scroll: false });
    },
    [pathname, router],
  );

  const filtered = useMemo(() => filterFamilyHistoryItems(items, filters), [items, filters]);

  const petNames = useMemo(
    () => Object.fromEntries(pets.map((pet) => [pet.id, pet.name])),
    [pets],
  );

  const returnTo = familyHistoryHref(filters, pathname || "/historico");

  const periodLabel =
    filters.from && filters.to
      ? formatPeriodLabel(filters.from, filters.to)
      : filters.from
        ? `a partir de ${filters.from}`
        : filters.to
          ? `até ${filters.to}`
          : "em todo o histórico carregado";

  return (
    <div className="space-y-4">
      <section className="cat-card space-y-5 p-4 md:p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--lavender-strong)]">Pet</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <FilterChip
              active={!filters.petId}
              label="Todos os pets"
              onClick={() => persist({ ...filters, petId: null })}
            />
            {pets.map((pet) => (
              <FilterChip
                key={pet.id}
                active={filters.petId === pet.id}
                label={pet.name}
                onClick={() => persist({ ...filters, petId: pet.id })}
              />
            ))}
          </div>
        </div>

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
                  const value = e.target.value || null;
                  persist(
                    resolveFamilyHistoryFilters({
                      pet: filters.petId,
                      from: value,
                      to: filters.to,
                      type: filters.type,
                      knownPetIds,
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
                  const value = e.target.value || null;
                  persist(
                    resolveFamilyHistoryFilters({
                      pet: filters.petId,
                      from: filters.from,
                      to: value,
                      type: filters.type,
                      knownPetIds,
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
                    pet: filters.petId,
                    from: today,
                    to: today,
                    type: filters.type,
                    knownPetIds,
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

        <p className="text-xs text-[var(--muted)]">
          {filtered.length} registro{filtered.length === 1 ? "" : "s"} {periodLabel}.
        </p>
      </section>

      <TimelineList
        items={filtered}
        emptyText="Nenhum cuidado encontrado com esses filtros."
        editable={editable}
        returnTo={returnTo}
        filterMode="all"
        petNames={petNames}
        showNewRecord={editable}
        showTypeFilters={false}
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
