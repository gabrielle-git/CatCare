"use client";

import { useState } from "react";
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

const MOBILE_PREVIEW = 2;

export function HomeCareAlerts({
  vaccineAlerts,
  dewormingAlerts,
}: {
  vaccineAlerts: HomeVaccineAlert[];
  dewormingAlerts: HomeDewormingAlert[];
}) {
  const items = buildAlertItems(vaccineAlerts, dewormingAlerts);
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const overdueCount = items.filter((item) => item.tone === "overdue").length;
  const mobileVisible = expanded ? items : items.slice(0, MOBILE_PREVIEW);
  const hiddenCount = items.length - MOBILE_PREVIEW;

  return (
    <>
      <section className="mt-5 md:hidden" aria-label="Cuidados que pedem atenção">
        <div className={`rounded-[20px] border px-4 py-3.5 ${overdueCount > 0 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${overdueCount > 0 ? "bg-red-100 text-[var(--danger)]" : "bg-amber-100 text-amber-700"}`}>
              <AlertTriangle size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${overdueCount > 0 ? "text-[var(--danger)]" : "text-amber-800"}`}>
                {items.length} cuidado{items.length > 1 ? "s" : ""} pedem atenção
              </p>
              <ul className="mt-2 space-y-1.5">
                {mobileVisible.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`focus-ring flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${toneClasses(item.tone)}`}
                    >
                      <AlertIcon kind={item.kind} tone={item.tone} />
                      <span className="min-w-0 break-words">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {items.length > MOBILE_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setExpanded((open) => !open)}
                  className="focus-ring mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--lavender-strong)]"
                  aria-expanded={expanded}
                >
                  {expanded ? "Mostrar menos" : `Ver todos (${hiddenCount} a mais)`}
                  <ChevronDown size={14} className={`transition ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 hidden space-y-2 md:block" aria-label="Cuidados que pedem atenção">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`focus-ring flex min-w-0 items-center gap-3 rounded-[20px] border px-4 py-3 text-sm font-bold ${toneClasses(item.tone)}`}
          >
            <span className="shrink-0">
              <AlertIcon kind={item.kind} tone={item.tone} />
            </span>
            <span className="min-w-0 break-words">{item.label}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
