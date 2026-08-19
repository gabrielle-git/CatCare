"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Clock, Syringe } from "lucide-react";
import { formatFullDate } from "@/lib/format";
import { formatWeeksAge, type ScheduledVaccine, type VaccineStatus } from "@/lib/vaccine-schedule";

const statusConfig: Record<VaccineStatus, { label: string; className: string; icon: typeof Check }> = {
  done: { label: "Aplicada", className: "bg-[var(--mint-soft)] text-[var(--success)]", icon: Check },
  due: { label: "Na hora", className: "bg-amber-50 text-amber-700", icon: Clock },
  overdue: { label: "Atrasada", className: "bg-red-50 text-[var(--danger)]", icon: AlertTriangle },
  upcoming: { label: "Em breve", className: "bg-[var(--cream)] text-[var(--muted)]", icon: Clock },
  not_applicable: { label: "—", className: "bg-gray-50 text-gray-400", icon: Clock },
};

function VaccineRow({ vaccine, petId, editable }: { vaccine: ScheduledVaccine; petId: string; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const config = statusConfig[vaccine.status];
  const Icon = config.icon;
  const actionable = vaccine.status !== "done" && vaccine.status !== "not_applicable";
  const registerTitle = `${vaccine.name} — ${vaccine.doseLabel}`;
  const registerHref = `/records/new?pet=${petId}&type=vaccine&title=${encodeURIComponent(registerTitle)}`;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white">
      <button
        type="button"
        onClick={() => actionable && setOpen(!open)}
        className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left ${actionable ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${config.className}`}>
          <Icon size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{vaccine.name}</p>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            {vaccine.doseLabel} • a partir de {formatWeeksAge(vaccine.minAgeDays)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${config.className}`}>
              {config.label}
            </span>
            {vaccine.appliedAt && (
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">{formatFullDate(`${vaccine.appliedAt.slice(0, 10)}T12:00:00-03:00`)}</p>
            )}
          </div>
          {actionable && (
            <span className="text-[var(--muted)]">
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          )}
        </div>
      </button>

      {open && actionable && (
        <div className="border-t border-[var(--border)] px-3.5 py-3">
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            {vaccine.status === "overdue"
              ? `Esta dose já deveria ter sido aplicada. O ideal era a partir de ${formatWeeksAge(vaccine.minAgeDays)} de vida.`
              : vaccine.status === "due"
                ? `O momento ideal para esta dose é agora — a partir de ${formatWeeksAge(vaccine.minAgeDays)} de vida.`
                : `Esta dose deve ser aplicada a partir de ${formatWeeksAge(vaccine.minAgeDays)} de vida.`}
          </p>
          {editable && (
            <Link
              href={registerHref}
              className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--mint-soft)] px-3 py-2 text-xs font-bold text-[var(--success)]"
            >
              <Check size={14} /> Registrar como aplicada
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function VaccineScheduleCard({ schedule, petId, petName, editable }: { schedule: ScheduledVaccine[]; petId: string; petName: string; editable: boolean }) {
  const overdueCount = schedule.filter((v) => v.status === "overdue").length;
  const dueCount = schedule.filter((v) => v.status === "due").length;

  return (
    <div className="cat-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[15px] bg-[var(--mint-soft)]">
            <Syringe size={18} className="text-[var(--success)]" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--success)]">Calendário</p>
            <h2 className="mt-1 font-bold">Vacinas</h2>
          </div>
        </div>
        {editable && (
          <Link
            href={`/records/new?pet=${petId}&type=vaccine`}
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[var(--mint-soft)] px-2.5 py-2 text-[11px] font-bold text-[var(--success)]"
          >
            <Syringe size={13} /> Registrar
          </Link>
        )}
      </div>

      {overdueCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-[var(--danger)]">
          <AlertTriangle size={15} />
          {overdueCount === 1
            ? `${petName} tem 1 vacina atrasada`
            : `${petName} tem ${overdueCount} vacinas atrasadas`}
        </div>
      )}

      {overdueCount === 0 && dueCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-700">
          <Clock size={15} />
          {dueCount === 1
            ? `${petName} tem 1 vacina para aplicar agora`
            : `${petName} tem ${dueCount} vacinas para aplicar agora`}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {schedule.map((vaccine, i) => (
          <VaccineRow key={`${vaccine.key}-${i}`} vaccine={vaccine} petId={petId} editable={editable} />
        ))}
      </div>
    </div>
  );
}
