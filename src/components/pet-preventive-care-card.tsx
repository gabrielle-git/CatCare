"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bug, Check, ChevronDown, ChevronUp, Clock, Syringe } from "lucide-react";
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

function VaccineRow({ vaccine, petId, editable, returnTo }: { vaccine: ScheduledVaccine; petId: string; editable: boolean; returnTo: string }) {
  const [open, setOpen] = useState(false);
  const config = vaccineStatusConfig[vaccine.status];
  const Icon = config.icon;
  const actionable = vaccine.status !== "done" && vaccine.status !== "not_applicable";
  const registerHref = vaccineAlertHref(petId, vaccine.name, vaccine.doseLabel, returnTo, vaccine.key);

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

function vaccineHeadline(schedule: ScheduledVaccine[]) {
  if (schedule.length === 0) return "Sem protocolo para esta espécie";
  const overdue = schedule.filter((v) => v.status === "overdue").length;
  const due = schedule.filter((v) => v.status === "due").length;
  if (overdue === 1) return "1 vacina atrasada";
  if (overdue > 1) return `${overdue} vacinas atrasadas`;
  if (due === 1) return "1 vacina na hora";
  if (due > 1) return `${due} vacinas na hora`;
  return "Em dia";
}

function dewormingHeadline(schedule: ScheduledDeworming) {
  if (schedule.status === "overdue") return "1 vermífugo atrasado";
  if (schedule.status === "due") return "Vermífugo na hora";
  if (schedule.status === "upcoming" && schedule.appliedAt) return "Em dia";
  return dewormingStatusConfig[schedule.status].label;
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
  compact = false,
}: {
  vaccineSchedule: ScheduledVaccine[];
  dewormingSchedule: ScheduledDeworming;
  petId: string;
  petName: string;
  editable: boolean;
  /** Overview: summary first, protocol expands on demand. */
  compact?: boolean;
}) {
  const vaccineOverdue = vaccineSchedule.filter((v) => v.status === "overdue").length;
  const vaccineDue = vaccineSchedule.filter((v) => v.status === "due").length;
  const dewormingOverdue = dewormingSchedule.status === "overdue";
  const dewormingDue = dewormingSchedule.status === "due";
  const hasAlert = vaccineOverdue > 0 || vaccineDue > 0 || dewormingOverdue || dewormingDue;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [vaccinesOpen, setVaccinesOpen] = useState(false);
  const [dewormingOpen, setDewormingOpen] = useState(false);
  const firstVaccine = firstActionableVaccine(vaccineSchedule);
  const petReturnTo = `/pets/${petId}`;
  const firstVaccineHref = firstVaccine ? vaccineAlertHref(petId, firstVaccine.name, firstVaccine.doseLabel, petReturnTo, firstVaccine.key) : null;
  const dewormingAlertLink = dewormingAlertHref(petId, petReturnTo);
  const dewormingRegisterLink = typedRecordHref(petId, "deworming", petReturnTo);
  const vaccineRegisterLink = typedRecordHref(petId, "vaccine", petReturnTo);
  const saudeHref = `/pets/${petId}/saude`;

  const summaryLines = [
    vaccineOverdue > 0
      ? vaccineOverdue === 1
        ? "1 vacina atrasada"
        : `${vaccineOverdue} vacinas atrasadas`
      : vaccineDue > 0
        ? vaccineDue === 1
          ? "1 vacina na hora"
          : `${vaccineDue} vacinas na hora`
        : null,
    dewormingOverdue ? "Vermífugo atrasado" : dewormingDue ? "Vermífugo na hora" : null,
  ].filter(Boolean) as string[];

  return (
    <div className={compact ? "cd-pet-preventive" : "cd-pet-preventive cd-pet-preventive-full"} data-compact={compact ? "true" : undefined}>
      {compact ? (
        <div className="cd-pet-preventive-summary">
          <div className="min-w-0 flex-1">
            <p className="cd-pet-section-title" style={{ display: "block" }}>
              Saúde preventiva
            </p>
            {summaryLines.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {summaryLines.map((line) => (
                  <li key={line} className="text-sm font-semibold text-[var(--text-primary)]">
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">Protocolo em dia.</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              className="cd-pet-text-link focus-ring"
              onClick={() => setDetailsOpen((open) => !open)}
            >
              {detailsOpen ? "Ocultar" : "Detalhes"}
            </button>
            <Link href={saudeHref} className="cd-pet-text-link focus-ring">
              Ver em Saúde
            </Link>
          </div>
        </div>
      ) : null}

      {(compact ? detailsOpen : true) && (
        <>
          {compact && hasAlert && (
            <div className="cd-pet-preventive-alerts">
              {vaccineOverdue > 0 && firstVaccineHref && (
                <Link href={firstVaccineHref} className="cd-pet-alert-link focus-ring" data-tone="danger">
                  <AlertTriangle size={14} />
                  {vaccineOverdue === 1 ? "1 vacina atrasada — registrar agora" : `${vaccineOverdue} vacinas atrasadas — registrar agora`}
                </Link>
              )}
              {vaccineOverdue === 0 && vaccineDue > 0 && firstVaccineHref && (
                <Link href={firstVaccineHref} className="cd-pet-alert-link focus-ring" data-tone="warn">
                  <Clock size={14} />
                  {vaccineDue === 1 ? "1 vacina para aplicar agora" : `${vaccineDue} vacinas para aplicar agora`}
                </Link>
              )}
              {dewormingOverdue && (
                <Link href={dewormingAlertLink} className="cd-pet-alert-link focus-ring" data-tone="danger">
                  <AlertTriangle size={14} />
                  Vermífugo atrasado — registrar agora
                </Link>
              )}
              {!dewormingOverdue && dewormingDue && (
                <Link href={dewormingAlertLink} className="cd-pet-alert-link focus-ring" data-tone="warn">
                  <Clock size={14} />
                  Hora do vermífugo — registrar agora
                </Link>
              )}
            </div>
          )}

          <div className="cd-pet-preventive-blocks">
            <div className="cd-pet-preventive-block">
              <button
                type="button"
                onClick={() => setVaccinesOpen(!vaccinesOpen)}
                className="focus-ring cd-pet-preventive-toggle"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--mint-soft)]">
                  <Syringe size={14} className="text-[var(--success)]" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="cd-pet-section-title" style={{ display: "block" }}>Vacinas</span>
                  <span className="cd-body mt-1 block font-semibold">{vaccineHeadline(vaccineSchedule)}</span>
                </span>
                <span className="text-[var(--muted)]">{vaccinesOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
              </button>
              {vaccinesOpen && (
                <div className="cd-pet-preventive-detail">
                  {vaccineSchedule.length === 0 ? (
                    <p className="text-xs leading-relaxed text-[var(--muted)]">
                      Ainda não há calendário preventivo de vacinas para esta espécie. Você pode registrar vacinas no histórico sem baixa automática de protocolo.
                    </p>
                  ) : (
                    vaccineSchedule.map((vaccine, i) => (
                      <VaccineRow key={`${vaccine.key}-${i}`} vaccine={vaccine} petId={petId} editable={editable} returnTo={petReturnTo} />
                    ))
                  )}
                  {editable && (
                    <Link href={vaccineRegisterLink} className="focus-ring mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--success)]">
                      <Syringe size={13} /> Registrar vacina
                    </Link>
                  )}
                </div>
              )}
            </div>

            <div className="cd-pet-preventive-block cd-pet-preventive-deworm">
              <button type="button" onClick={() => setDewormingOpen(!dewormingOpen)} className="focus-ring cd-pet-preventive-toggle">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#fbead9]">
                  <Bug size={14} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="cd-pet-section-title" style={{ display: "block" }}>Vermífugo</span>
                  <span className="cd-body mt-1 block font-semibold">{dewormingHeadline(dewormingSchedule)}</span>
                </span>
                <span className="text-[var(--muted)]">{dewormingOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
              </button>
              {dewormingOpen ? (
                <div className="cd-pet-preventive-detail">
                  <p className="text-xs leading-relaxed text-[var(--muted)]">
                    {dewormingSummary(dewormingSchedule)}
                    {dewormingSchedule.dueAt ? ` • ${formatDueInDays(dewormingSchedule.dueAt)}` : ""}
                  </p>
                  {dewormingSchedule.appliedAt ? (
                    <p className="text-xs text-[var(--muted)]">
                      Último: {formatFullDate(`${dewormingSchedule.appliedAt.slice(0, 10)}T12:00:00-03:00`)}
                    </p>
                  ) : null}
                  {editable ? (
                    <Link href={dewormingRegisterLink} className="cd-pet-text-link focus-ring">
                      Registrar
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
