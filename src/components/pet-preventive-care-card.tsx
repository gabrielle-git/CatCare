"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bug, Check, ChevronDown, ChevronUp, Clock, HeartPulse, Syringe } from "lucide-react";
import { formatFullDate } from "@/lib/format";
import { dewormingAlertHref, typedRecordHref, vaccineAlertHref } from "@/lib/record-links";
import { formatDueInDays, type DewormingStatus, type ScheduledDeworming } from "@/lib/deworming-schedule";
import { formatWeeksAge, firstActionableVaccine, type ScheduledVaccine, type VaccineStatus } from "@/lib/vaccine-schedule";

const vaccineStatusConfig: Record<VaccineStatus, { label: string; className: string; icon: typeof Check }> = {
  done: { label: "Aplicada", className: "bg-[var(--mint-soft)] text-[var(--success)]", icon: Check },
  due: { label: "Na hora", className: "bg-amber-50 text-amber-700", icon: Clock },
  overdue: { label: "Atrasada", className: "bg-red-50 text-[var(--danger)]", icon: AlertTriangle },
  upcoming: { label: "Em breve", className: "bg-[var(--cream)] text-[var(--muted)]", icon: Clock },
  not_applicable: { label: "—", className: "bg-gray-50 text-gray-400", icon: Clock },
};

const dewormingStatusConfig: Record<DewormingStatus | "done", { label: string; className: string; icon: typeof Check }> = {
  done: { label: "Em dia", className: "bg-[var(--mint-soft)] text-[var(--success)]", icon: Check },
  due: { label: "Na hora", className: "bg-amber-50 text-amber-700", icon: Clock },
  overdue: { label: "Atrasado", className: "bg-red-50 text-[var(--danger)]", icon: AlertTriangle },
  upcoming: { label: "Em breve", className: "bg-[var(--cream)] text-[var(--muted)]", icon: Clock },
};

function VaccineRow({ vaccine, petId, editable }: { vaccine: ScheduledVaccine; petId: string; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const config = vaccineStatusConfig[vaccine.status];
  const Icon = config.icon;
  const actionable = vaccine.status !== "done" && vaccine.status !== "not_applicable";
  const registerHref = vaccineAlertHref(petId, vaccine.name, vaccine.doseLabel);

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
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${config.className}`}>
            {config.label}
          </span>
          {actionable && <span className="text-[var(--muted)]">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>}
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
            <Link href={registerHref} className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--mint-soft)] px-3 py-2 text-xs font-bold text-[var(--success)]">
              <Check size={14} /> Registrar como aplicada
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function vaccineSummary(schedule: ScheduledVaccine[]) {
  const overdue = schedule.filter((v) => v.status === "overdue").length;
  const due = schedule.filter((v) => v.status === "due").length;
  if (overdue > 0) return `${overdue} atrasada${overdue > 1 ? "s" : ""}`;
  if (due > 0) return `${due} para aplicar agora`;
  return "Em dia";
}

function dewormingSummary(schedule: ScheduledDeworming) {
  const status = schedule.status === "upcoming" && schedule.appliedAt ? "done" : schedule.status;
  return dewormingStatusConfig[status].label;
}

export function PetPreventiveCareCard({
  vaccineSchedule,
  dewormingSchedule,
  petId,
  editable,
}: {
  vaccineSchedule: ScheduledVaccine[];
  dewormingSchedule: ScheduledDeworming;
  petId: string;
  petName: string;
  editable: boolean;
}) {
  const vaccineOverdue = vaccineSchedule.filter((v) => v.status === "overdue").length;
  const vaccineDue = vaccineSchedule.filter((v) => v.status === "due").length;
  const dewormingOverdue = dewormingSchedule.status === "overdue";
  const dewormingDue = dewormingSchedule.status === "due";
  const hasAlert = vaccineOverdue > 0 || vaccineDue > 0 || dewormingOverdue || dewormingDue;
  const [vaccinesOpen, setVaccinesOpen] = useState(vaccineOverdue > 0 || vaccineDue > 0);
  const firstVaccine = firstActionableVaccine(vaccineSchedule);
  const firstVaccineHref = firstVaccine ? vaccineAlertHref(petId, firstVaccine.name, firstVaccine.doseLabel) : null;
  const dewormingAlertLink = dewormingAlertHref(petId);
  const dewormingRegisterLink = typedRecordHref(petId, "deworming");
  const vaccineRegisterLink = typedRecordHref(petId, "vaccine");

  return (
    <div className="cat-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[15px] bg-[var(--mint-soft)]">
            <HeartPulse size={18} className="text-[var(--success)]" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--success)]">Prevenção</p>
            <h2 className="mt-1 font-bold">Saúde preventiva</h2>
          </div>
        </div>
      </div>

      {hasAlert && (
        <div className="mt-4 space-y-2">
          {vaccineOverdue > 0 && firstVaccineHref && (
            <Link href={firstVaccineHref} className="focus-ring flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-[var(--danger)]">
              <AlertTriangle size={14} />
              {vaccineOverdue === 1 ? "1 vacina atrasada — registrar agora" : `${vaccineOverdue} vacinas atrasadas — registrar agora`}
            </Link>
          )}
          {vaccineOverdue === 0 && vaccineDue > 0 && firstVaccineHref && (
            <Link href={firstVaccineHref} className="focus-ring flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
              <Clock size={14} />
              {vaccineDue === 1 ? "1 vacina para aplicar agora" : `${vaccineDue} vacinas para aplicar agora`}
            </Link>
          )}
          {dewormingOverdue && (
            <Link href={dewormingAlertLink} className="focus-ring flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-[var(--danger)]">
              <AlertTriangle size={14} />
              Vermífugo atrasado — registrar agora
            </Link>
          )}
          {!dewormingOverdue && dewormingDue && (
            <Link href={dewormingAlertLink} className="focus-ring flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
              <Clock size={14} />
              Hora do vermífugo — registrar agora
            </Link>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--cream)]/40">
          <button
            type="button"
            onClick={() => setVaccinesOpen(!vaccinesOpen)}
            className="focus-ring flex w-full items-center gap-3 px-3.5 py-3 text-left"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--mint-soft)]">
              <Syringe size={15} className="text-[var(--success)]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Vacinas</p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">{vaccineSummary(vaccineSchedule)}</p>
            </div>
            <span className="text-[var(--muted)]">{vaccinesOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
          </button>
          {vaccinesOpen && (
            <div className="space-y-2 border-t border-[var(--border)] bg-white px-3.5 py-3">
              {vaccineSchedule.map((vaccine, i) => (
                <VaccineRow key={`${vaccine.key}-${i}`} vaccine={vaccine} petId={petId} editable={editable} />
              ))}
              {editable && (
                <Link href={vaccineRegisterLink} className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[var(--mint-soft)] px-3 py-2 text-[11px] font-bold text-[var(--success)]">
                  <Syringe size={13} /> Registrar vacina
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--cream)]/40 px-3.5 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#fbead9]">
              <Bug size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Vermífugo</p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                {dewormingSummary(dewormingSchedule)}
                {dewormingSchedule.dueAt ? ` • ${formatDueInDays(dewormingSchedule.dueAt)}` : ""}
              </p>
              {dewormingSchedule.appliedAt && (
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                  Último: {formatFullDate(`${dewormingSchedule.appliedAt.slice(0, 10)}T12:00:00-03:00`)}
                </p>
              )}
            </div>
            {editable && (
              <Link href={dewormingRegisterLink} className="focus-ring shrink-0 rounded-xl bg-[#fbead9] px-2.5 py-2 text-[10px] font-bold">
                Registrar
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
