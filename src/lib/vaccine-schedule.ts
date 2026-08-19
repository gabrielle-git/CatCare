import { getPetAgeDays } from "@/lib/format";

export type VaccineStatus = "done" | "due" | "overdue" | "upcoming" | "not_applicable";

export type ScheduledVaccine = {
  key: string;
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
  key: string;
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

export type AppliedDose = {
  vaccineTitle: string;
  occurredAt: string;
};

function matchesVaccine(title: string, key: string): boolean {
  const t = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (key === "v3") return /\bv\s*3\b|triplice|tr[ií]plice/i.test(t);
  if (key === "v4") return /\bv\s*4\b|quadrupla|qu[aá]drupla/i.test(t);
  if (key === "v5") return /\bv\s*5\b|quintupla|qu[ií]ntupla|felv/i.test(t);
  if (key === "rabies") return /anti\s*r[aá]bica|raiva|rabies/i.test(t);
  return false;
}

function matchesDose(title: string, label: string): boolean {
  const t = title.toLowerCase();
  if (/1[ªa]\s*dose|primeira\s*dose/.test(t) && label === "1ª dose") return true;
  if (/2[ªa]\s*dose|segunda\s*dose/.test(t) && label === "2ª dose") return true;
  if (/3[ªa]\s*dose|terceira\s*dose/.test(t) && label === "3ª dose") return true;
  if (label === "Dose única") return true;
  return false;
}

/**
 * Build the vaccine schedule for a pet given their birth_date and applied doses.
 * The `protocol` param picks which polyvalent vaccine the family uses (default v4).
 */
export function buildVaccineSchedule(
  birthDate: string | null,
  appliedDoses: AppliedDose[],
  protocol: "v3" | "v4" | "v5" = "v4",
): ScheduledVaccine[] {
  const ageDays = getPetAgeDays(birthDate);
  const specs = SCHEDULE.filter((s) => s.key === protocol || s.key === "rabies");

  return specs.flatMap((spec) => {
    let appliedCount = 0;
    return spec.doses.map((dose): ScheduledVaccine => {
      const minAgeDays = dose.minWeeks * 7;
      const overdueDays = dose.overdueWeeks * 7;

      const applied = appliedDoses.find(
        (d) => matchesVaccine(d.vaccineTitle, spec.key) && matchesDose(d.vaccineTitle, dose.label),
      );

      if (!applied && appliedCount < appliedDoses.filter((d) => matchesVaccine(d.vaccineTitle, spec.key)).length) {
        appliedCount++;
      }

      if (applied) {
        return { key: spec.key, name: spec.name, doseLabel: dose.label, minAgeDays, overdueDays, status: "done", appliedAt: applied.occurredAt };
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
    });
  });
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
