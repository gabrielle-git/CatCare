import { getPetAgeDays } from "@/lib/format";

export type VaccineStatus = "done" | "due" | "overdue" | "upcoming" | "not_applicable";

export type ProtocolVaccineKey = "v3" | "v4" | "v5" | "rabies";
export type VaccineKey = ProtocolVaccineKey | "other";

export type ScheduledVaccine = {
  key: ProtocolVaccineKey;
  name: string;
  doseLabel: string;
  /** Minimum age in days to receive this dose */
  minAgeDays: number;
  /** Age in days after which this dose is considered overdue (grace window) */
  overdueDays: number;
  status: VaccineStatus;
  appliedAt: string | null;
};

type DoseSpec = {
  key: ProtocolVaccineKey;
  name: string;
  doses: { label: string; minWeeks: number; overdueWeeks: number }[];
};

const SCHEDULE: DoseSpec[] = [
  {
    key: "v3",
    name: "Tríplice Felina (V3)",
    doses: [
      { label: "1ª dose", minWeeks: 8, overdueWeeks: 12 },
      { label: "2ª dose", minWeeks: 12, overdueWeeks: 16 },
      { label: "3ª dose", minWeeks: 16, overdueWeeks: 20 },
    ],
  },
  {
    key: "v4",
    name: "Quádrupla Felina (V4)",
    doses: [
      { label: "1ª dose", minWeeks: 8, overdueWeeks: 12 },
      { label: "2ª dose", minWeeks: 12, overdueWeeks: 16 },
      { label: "3ª dose", minWeeks: 16, overdueWeeks: 20 },
    ],
  },
  {
    key: "v5",
    name: "Quíntupla Felina (V5/FeLV)",
    doses: [
      { label: "1ª dose", minWeeks: 8, overdueWeeks: 12 },
      { label: "2ª dose", minWeeks: 12, overdueWeeks: 16 },
    ],
  },
  {
    key: "rabies",
    name: "Antirrábica",
    doses: [
      { label: "Dose única", minWeeks: 16, overdueWeeks: 24 },
    ],
  },
];

const PROTOCOL_KEYS = new Set<string>(["v3", "v4", "v5", "rabies"]);

export type AppliedDose = {
  vaccineTitle: string;
  occurredAt: string;
  /** Structured key when known (from vaccine_doses.vaccine_name). */
  vaccineKey?: string | null;
  /** Structured dose label when known (from vaccine_doses.dose_label). */
  doseLabel?: string | null;
};

export function isProtocolVaccineKey(value: string | null | undefined): value is ProtocolVaccineKey {
  return Boolean(value && PROTOCOL_KEYS.has(value));
}

export function vaccineDisplayName(key: string): string {
  return SCHEDULE.find((spec) => spec.key === key)?.name ?? key;
}

export function dosesForVaccineKey(key: string): string[] {
  return SCHEDULE.find((spec) => spec.key === key)?.doses.map((dose) => dose.label) ?? [];
}

/** Vaccines offered in the current household protocol (default V4 + rabies). */
export function listSelectableVaccines(protocol: "v3" | "v4" | "v5" = "v4"): { key: ProtocolVaccineKey; name: string; doses: string[] }[] {
  return SCHEDULE.filter((spec) => spec.key === protocol || spec.key === "rabies").map((spec) => ({
    key: spec.key,
    name: spec.name,
    doses: spec.doses.map((dose) => dose.label),
  }));
}

export function formatVaccineRecordTitle(vaccineKey: string, doseLabel: string): string {
  return `${vaccineDisplayName(vaccineKey)} — ${doseLabel}`;
}

function matchesVaccine(title: string, key: string): boolean {
  const t = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (key === "v3") return /\bv\s*3\b|triplice|tr[ií]plice/i.test(t);
  if (key === "v4") return /\bv\s*4\b|quadrupla|qu[aá]drupla/i.test(t);
  if (key === "v5") return /\bv\s*5\b|quintupla|qu[ií]ntupla|felv/i.test(t);
  if (key === "rabies") return /anti\s*r[aá]bica|raiva|rabies/i.test(t);
  return false;
}

function matchesDoseLegacy(title: string, label: string): boolean {
  const t = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/1[ªa]\s*dose|primeira\s*dose/.test(t) && label === "1ª dose") return true;
  if (/2[ªa]\s*dose|segunda\s*dose/.test(t) && label === "2ª dose") return true;
  if (/3[ªa]\s*dose|terceira\s*dose/.test(t) && label === "3ª dose") return true;
  if (label === "Dose única") {
    // Prefer explicit "dose única"; also accept antirabies titles without a numbered dose.
    if (/dose\s*unica/.test(t)) return true;
    if (!/[123][ªa]\s*dose|primeira|segunda|terceira/.test(t)) return true;
  }
  return false;
}

function doseMatches(applied: AppliedDose, vaccineKey: ProtocolVaccineKey, doseLabel: string): boolean {
  if (applied.vaccineKey && isProtocolVaccineKey(applied.vaccineKey) && applied.doseLabel) {
    return applied.vaccineKey === vaccineKey && applied.doseLabel === doseLabel;
  }
  return matchesVaccine(applied.vaccineTitle, vaccineKey) && matchesDoseLegacy(applied.vaccineTitle, doseLabel);
}

/**
 * Build the vaccine schedule for a pet given their birth_date and applied doses.
 * Prefers structured vaccineKey/doseLabel; falls back to legacy title matching.
 */
export function buildVaccineSchedule(
  birthDate: string | null,
  appliedDoses: AppliedDose[],
  protocol: "v3" | "v4" | "v5" = "v4",
): ScheduledVaccine[] {
  const ageDays = getPetAgeDays(birthDate);
  const specs = SCHEDULE.filter((s) => s.key === protocol || s.key === "rabies");
  const used = new Set<number>();

  return specs.flatMap((spec) =>
    spec.doses.map((dose): ScheduledVaccine => {
      const minAgeDays = dose.minWeeks * 7;
      const overdueDays = dose.overdueWeeks * 7;

      const appliedIdx = appliedDoses.findIndex(
        (entry, index) => !used.has(index) && doseMatches(entry, spec.key, dose.label),
      );
      const applied = appliedIdx >= 0 ? appliedDoses[appliedIdx] : null;
      if (appliedIdx >= 0) used.add(appliedIdx);

      if (applied) {
        return {
          key: spec.key,
          name: spec.name,
          doseLabel: dose.label,
          minAgeDays,
          overdueDays,
          status: "done",
          appliedAt: applied.occurredAt,
        };
      }

      if (ageDays == null) {
        return { key: spec.key, name: spec.name, doseLabel: dose.label, minAgeDays, overdueDays, status: "upcoming", appliedAt: null };
      }

      if (ageDays < minAgeDays) {
        return { key: spec.key, name: spec.name, doseLabel: dose.label, minAgeDays, overdueDays, status: "upcoming", appliedAt: null };
      }

      if (ageDays >= overdueDays) {
        return { key: spec.key, name: spec.name, doseLabel: dose.label, minAgeDays, overdueDays, status: "overdue", appliedAt: null };
      }

      return { key: spec.key, name: spec.name, doseLabel: dose.label, minAgeDays, overdueDays, status: "due", appliedAt: null };
    }),
  );
}

export function countOverdue(schedule: ScheduledVaccine[]): number {
  return schedule.filter((v) => v.status === "overdue").length;
}

export function countDue(schedule: ScheduledVaccine[]): number {
  return schedule.filter((v) => v.status === "due").length;
}

export function firstActionableVaccine(schedule: ScheduledVaccine[]) {
  return schedule.find((v) => v.status === "overdue" || v.status === "due") ?? null;
}

export function formatWeeksAge(days: number): string {
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} semana${weeks !== 1 ? "s" : ""}`;
  const months = Math.floor(weeks / 4.33);
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}
