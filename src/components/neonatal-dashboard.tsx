"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Droplets, Milk, Plus, Scale } from "lucide-react";
import { PetAvatar } from "@/components/pet-avatar";
import { formatHumanEquivalentAge, formatPetAge, formatWeight } from "@/lib/format";
import {
  aggregateHouseholdSummary,
  computeNeonatalSummaries,
  formatNeonatalDailyStats,
  formatTimeAgo,
  todayIsoDate,
  type NeonatalPetSummary,
} from "@/lib/neonatal-stats";
import { preselectRecordHref } from "@/lib/record-links";
import type { NeonatalRecord } from "@/types/database";

type Baby = {
  id: string;
  name: string;
  photo_url: string | null;
  birth_date: string | null;
  birth_date_estimated: boolean;
  current_weight_grams: number | null;
};

function FeedingAlert({ stats }: { stats: NeonatalPetSummary }) {
  if (!stats.lastFeedingAt) return null;
  const hoursSince = (Date.now() - new Date(stats.lastFeedingAt).getTime()) / 3_600_000;
  if (hoursSince < 4) return null;
  return (
    <p className="mt-2 rounded-xl border border-[#e3b6c4] bg-white/80 px-2.5 py-1.5 text-[10px] font-semibold text-[#9a536c]">
      Sem mamada nova há {Math.floor(hoursSince)} h — vale registrar se alimentou.
    </p>
  );
}

function LastLines({ stats }: { stats: NeonatalPetSummary }) {
  return (
    <ul className="mt-2 space-y-1 text-[10px] text-[var(--muted)]">
      <li className="flex items-start gap-1.5">
        <Milk size={12} className="mt-0.5 shrink-0 text-[var(--rose)]" />
        {stats.lastFeedingAt ? (
          <span>
            Última mamada {formatTimeAgo(stats.lastFeedingAt)}
            {stats.lastFeedingMl != null ? ` · ${stats.lastFeedingMl.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ml` : ""}
          </span>
        ) : (
          <span>Nenhuma mamada registrada</span>
        )}
      </li>
      <li className="flex items-start gap-1.5">
        <Droplets size={12} className="mt-0.5 shrink-0 text-[#96613e]" />
        {stats.lastStoolAt ? <span>Último cocô {formatTimeAgo(stats.lastStoolAt)}</span> : <span>Nenhum cocô registrado</span>}
      </li>
      <li className="flex items-start gap-1.5">
        <Droplets size={12} className="mt-0.5 shrink-0 text-[var(--lavender-strong)]" />
        {stats.lastUrineAt ? <span>Último xixi {formatTimeAgo(stats.lastUrineAt)}</span> : <span>Nenhum xixi registrado</span>}
      </li>
    </ul>
  );
}

export function NeonatalDashboard({
  babies,
  records,
  editable,
}: {
  babies: Baby[];
  records: NeonatalRecord[];
  editable: boolean;
}) {
  const today = todayIsoDate();
  const petIds = useMemo(() => babies.map((pet) => pet.id), [babies]);
  const summaries = useMemo(
    () => computeNeonatalSummaries(records, petIds, { from: today, to: today }),
    [petIds, records, today],
  );
  const household = useMemo(() => aggregateHouseholdSummary(summaries), [summaries]);
  const hasActivity = household.feedingCount + household.stoolCount + household.urineCount > 0;

  return (
    <div className="mt-7 space-y-4">
      <section className="cat-card overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--rose-soft)]/60 px-5 py-4 md:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a536c]">Resumo de hoje</p>
          <p className="mt-1 text-xl font-bold tracking-[-0.02em] md:text-2xl">
            {hasActivity ? formatNeonatalDailyStats(household) : "Nenhum cuidado registrado hoje ainda"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {babies.length === 1 ? "Totais do filhote em acompanhamento." : `Totais da ninhada (${babies.length} filhotes).`}
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {babies.map((pet) => {
          const stats = summaries.get(pet.id);
          if (!stats) return null;
          return (
            <section key={pet.id} className="cat-card overflow-hidden">
              <div className="flex items-start gap-4 bg-[var(--rose-soft)] p-5">
                <PetAvatar name={pet.name} photoUrl={pet.photo_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">{pet.name}</h2>
                    <span className="rounded-full bg-white/75 px-2 py-1 text-[9px] font-bold text-[#9a536c]">Neonatal automático</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatPetAge(pet.birth_date, pet.birth_date_estimated)} de vida • {formatWeight(pet.current_weight_grams)}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--muted)]">{formatHumanEquivalentAge(pet.birth_date)}</p>
                  <p className="mt-2 rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-bold text-[#9a536c]">
                    Hoje: {formatNeonatalDailyStats(stats)}
                  </p>
                  <LastLines stats={stats} />
                  <FeedingAlert stats={stats} />
                </div>
              </div>
              {editable ? (
                <div className="grid grid-cols-2 gap-2 p-4">
                  <Link href={preselectRecordHref({ pet: pet.id, type: "feeding", returnTo: "/neonatal", neonatal: true })} className="focus-ring flex items-center justify-center gap-2 rounded-[18px] bg-[var(--rose-soft)] px-3 py-3 text-xs font-bold"><Milk size={17} /> Mamada</Link>
                  <Link href={preselectRecordHref({ pet: pet.id, type: "weight", returnTo: "/neonatal", neonatal: true })} className="focus-ring flex items-center justify-center gap-2 rounded-[18px] bg-[var(--lavender-soft)] px-3 py-3 text-xs font-bold"><Scale size={17} /> Peso</Link>
                  <Link href={preselectRecordHref({ pet: pet.id, type: "urine", returnTo: "/neonatal", neonatal: true })} className="focus-ring rounded-[18px] border border-[var(--border)] px-3 py-3 text-center text-xs font-bold">Xixi</Link>
                  <Link href={preselectRecordHref({ pet: pet.id, type: "stool", returnTo: "/neonatal", neonatal: true })} className="focus-ring rounded-[18px] border border-[var(--border)] px-3 py-3 text-center text-xs font-bold">Cocô</Link>
                  <Link href={preselectRecordHref({ pet: pet.id, returnTo: "/neonatal", neonatal: true })} className="focus-ring col-span-2 flex items-center justify-center gap-1 rounded-[18px] border border-[var(--border)] px-3 py-3 text-xs font-bold"><Plus size={14} /> Novo cuidado</Link>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-[var(--muted)]">Somente leitura nesta família.</div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
