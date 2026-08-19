"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Clock, Pill } from "lucide-react";
import { formatFullDate } from "@/lib/format";
import { dewormingAlertHref, typedRecordHref, vaccineAlertHref } from "@/lib/record-links";
import { formatDueInDays, type DewormingStatus, type ScheduledDeworming } from "@/lib/deworming-schedule";

const statusConfig: Record<DewormingStatus, { label: string; className: string; icon: typeof Check }> = {
  done: { label: "Em dia", className: "bg-[var(--mint-soft)] text-[var(--success)]", icon: Check },
  due: { label: "Na hora", className: "bg-amber-50 text-amber-700", icon: Clock },
  overdue: { label: "Atrasado", className: "bg-red-50 text-[var(--danger)]", icon: AlertTriangle },
  upcoming: { label: "Em breve", className: "bg-[var(--cream)] text-[var(--muted)]", icon: Clock },
};

function DewormingRow({ schedule, petId, editable }: { schedule: ScheduledDeworming; petId: string; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const config = statusConfig[schedule.status === "upcoming" && schedule.appliedAt ? "done" : schedule.status];
  const Icon = config.icon;
  const actionable = schedule.status !== "done";
  const registerHref = dewormingAlertHref(petId);

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
          <p className="truncate text-sm font-bold">{schedule.name}</p>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            {schedule.label} • a cada {schedule.intervalDays} dias
            {schedule.dueAt ? ` • ${formatDueInDays(schedule.dueAt)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${config.className}`}>
              {config.label}
            </span>
            {schedule.appliedAt && (
              <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                Último: {formatFullDate(`${schedule.appliedAt.slice(0, 10)}T12:00:00-03:00`)}
              </p>
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
            {schedule.status === "overdue"
              ? "O vermífugo já passou do prazo recomendado. Consulte o veterinário se tiver dúvidas sobre o produto ou intervalo."
              : schedule.status === "due"
                ? "Está na hora de aplicar o vermífugo conforme o intervalo da fase de vida do pet."
                : schedule.dueAt
                  ? `Próxima dose prevista ${formatDueInDays(schedule.dueAt)}.`
                  : "Informe a data de nascimento do pet para calcular o calendário automaticamente."}
          </p>
          {editable && (
            <Link
              href={registerHref}
              className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-[#fbead9] px-3 py-2 text-xs font-bold text-[var(--foreground)]"
            >
              <Check size={14} /> Registrar aplicação
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function DewormingScheduleCard({
  schedule,
  petId,
  petName,
  editable,
}: {
  schedule: ScheduledDeworming;
  petId: string;
  petName: string;
  editable: boolean;
}) {
  const overdue = schedule.status === "overdue";
  const due = schedule.status === "due";

  return (
    <div className="cat-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[15px] bg-[#fbead9]">
            <Pill size={18} className="text-[var(--foreground)]" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Prevenção</p>
            <h2 className="mt-1 font-bold">Vermífugo</h2>
          </div>
        </div>
        {editable && (
          <Link
            href={typedRecordHref(petId, "deworming")}
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[#fbead9] px-2.5 py-2 text-[11px] font-bold"
          >
            <Pill size={13} /> Registrar
          </Link>
        )}
      </div>

      {overdue && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-[var(--danger)]">
          <AlertTriangle size={15} />
          {petName} está com o vermífugo atrasado
        </div>
      )}

      {!overdue && due && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-700">
          <Clock size={15} />
          Hora de aplicar o vermífugo de {petName}
        </div>
      )}

      <div className="mt-4">
        <DewormingRow schedule={schedule} petId={petId} editable={editable} />
      </div>
    </div>
  );
}
