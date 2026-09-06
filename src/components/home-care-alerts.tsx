"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, Pill, Syringe } from "lucide-react";

export type HomeVaccineAlert = {
  petId: string;
  petName: string;
  overdue: number;
  due: number;
  registerHref: string | null;
};

export type HomeDewormingAlert = {
  petId: string;
  petName: string;
  overdue: boolean;
  due: boolean;
  registerHref: string;
};

type CareAlertItem = {
  id: string;
  href: string;
  tone: "overdue" | "due";
  label: string;
  kind: "vaccine" | "deworming";
};

function buildAlertItems(vaccineAlerts: HomeVaccineAlert[], dewormingAlerts: HomeDewormingAlert[]): CareAlertItem[] {
  const items: CareAlertItem[] = [];

  for (const alert of vaccineAlerts) {
    items.push({
      id: `vaccine-${alert.petId}`,
      href: alert.registerHref ?? `/pets/${alert.petId}`,
      tone: alert.overdue > 0 ? "overdue" : "due",
      kind: "vaccine",
      label:
        alert.overdue > 0
          ? `${alert.petName} — ${alert.overdue} vacina${alert.overdue > 1 ? "s" : ""} atrasada${alert.overdue > 1 ? "s" : ""}`
          : `${alert.petName} — ${alert.due} vacina${alert.due > 1 ? "s" : ""} para aplicar`,
    });
  }

  for (const alert of dewormingAlerts) {
    items.push({
      id: `deworming-${alert.petId}`,
      href: alert.registerHref,
      tone: alert.overdue ? "overdue" : "due",
      kind: "deworming",
      label: alert.overdue
        ? `${alert.petName} — vermífugo atrasado`
        : `Vermífugo de ${alert.petName}`,
    });
  }

  items.sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === "overdue" ? -1 : 1;
    return a.label.localeCompare(b.label, "pt-BR");
  });

  return items;
}

function AlertIcon({ kind, tone }: { kind: CareAlertItem["kind"]; tone: CareAlertItem["tone"] }) {
  if (kind === "deworming") {
    return tone === "overdue" ? <AlertTriangle size={16} aria-hidden="true" /> : <Pill size={16} aria-hidden="true" />;
  }
  return tone === "overdue" ? <AlertTriangle size={16} aria-hidden="true" /> : <Syringe size={16} aria-hidden="true" />;
}

function toneClasses(tone: CareAlertItem["tone"]) {
  return tone === "overdue"
    ? "border-red-200 bg-red-50 text-[var(--danger)]"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function summaryLine(overdueCount: number, dueCount: number) {
  if (overdueCount > 0 && dueCount > 0) {
    return `${overdueCount} atrasado${overdueCount > 1 ? "s" : ""} • ${dueCount} próximo${dueCount > 1 ? "s" : ""}`;
  }
  if (overdueCount > 0) {
    return `${overdueCount} atrasado${overdueCount > 1 ? "s" : ""}`;
  }
  return `${dueCount} próximo${dueCount > 1 ? "s" : ""}`;
}

export function HomeCareAlerts({
  vaccineAlerts,
  dewormingAlerts,
}: {
  vaccineAlerts: HomeVaccineAlert[];
  dewormingAlerts: HomeDewormingAlert[];
}) {
  const items = buildAlertItems(vaccineAlerts, dewormingAlerts);
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (items.length === 0) return null;

  const overdueCount = items.filter((item) => item.tone === "overdue").length;
  const dueCount = items.length - overdueCount;
  const hasOverdue = overdueCount > 0;
  const shellTone = hasOverdue ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50";
  const titleTone = hasOverdue ? "text-[var(--danger)]" : "text-amber-800";
  const iconTone = hasOverdue ? "bg-red-100 text-[var(--danger)]" : "bg-amber-100 text-amber-700";

  return (
    <section className="mt-5" aria-label="Cuidados que pedem atenção">
      <div className={`rounded-[20px] border px-4 py-3.5 ${shellTone}`}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${iconTone}`}>
            <AlertTriangle size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-sm font-bold ${titleTone}`}>
                  {items.length} cuidado{items.length > 1 ? "s" : ""} pedem atenção
                </p>
                <p className="mt-0.5 text-xs font-semibold text-[var(--muted)]">
                  {summaryLine(overdueCount, dueCount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded((open) => !open)}
                className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-bold text-[var(--lavender-strong)]"
                aria-expanded={expanded}
                aria-controls={panelId}
              >
                {expanded ? "Ocultar detalhes" : "Ver detalhes"}
                <ChevronDown
                  size={14}
                  className={`transition ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
            </div>

            <div
              id={panelId}
              hidden={!expanded}
              className={expanded ? "mt-3" : undefined}
            >
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`focus-ring flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold md:gap-3 md:px-4 md:py-2.5 md:text-sm md:font-bold ${toneClasses(item.tone)}`}
                    >
                      <AlertIcon kind={item.kind} tone={item.tone} />
                      <span className="min-w-0 break-words">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
