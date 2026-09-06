import { getPetAgeDays } from "@/lib/format";
import {
  activeVaccinesForProtocol,
  resolvePreventiveProtocol,
  type PreventiveProtocol,
  type PreventiveVaccineItem,
} from "@/lib/preventive-protocol";

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

const PROTOCOL_KEYS = new Set<string>(["v3", "v4", "v5", "rabies"]);

export type AppliedDose = {
  vaccineTitle: string;
  occurredAt: string;
  /** Structured key when known (from vaccine_doses.vaccine_name). */
  vaccineKey?: string | null;
  /** Structured dose label when known (from vaccine_doses.dose_label). */
  doseLabel?: string | null;
};

export type BuildVaccineScheduleOptions = {
  /** Pet species — drives protocol resolution. Default "cat" preserves legacy callers. */
  species?: string | null;
  /** Core combo variant when feline protocol applies. */
  coreVaccineKey?: "v3" | "v4" | "v5";
  /** Optional explicit protocol (tests / future overrides). */
  protocol?: PreventiveProtocol | null;
};

export function isProtocolVaccineKey(value: string | null | undefined): value is ProtocolVaccineKey {
  return Boolean(value && PROTOCOL_KEYS.has(value));
}

function catalogName(key: string): string | undefined {
  const protocol = createCatalogLookup();
  return protocol.vaccines.find((item) => item.key === key)?.name;
}

function createCatalogLookup(): PreventiveProtocol {
  return resolvePreventiveProtocol("cat", "v4")!;
}

export function vaccineDisplayName(key: string): string {
  return catalogName(key) ?? key;
}

export function dosesForVaccineKey(key: string): string[] {
  const item = createCatalogLookup().vaccines.find((entry) => entry.key === key);
  return item?.primarySeries.map((dose) => dose.label) ?? [];
}

/** Vaccines offered for recording — empty when species has no protocol. */
export function listSelectableVaccines(
  coreOrOptions: "v3" | "v4" | "v5" | { species?: string | null; coreVaccineKey?: "v3" | "v4" | "v5" } = "v4",
): { key: ProtocolVaccineKey; name: string; doses: string[] }[] {
  const options = typeof coreOrOptions === "string"
    ? { species: "cat" as const, coreVaccineKey: coreOrOptions }
    : { species: coreOrOptions.species ?? "cat", coreVaccineKey: coreOrOptions.coreVaccineKey ?? "v4" };

  const protocol = resolvePreventiveProtocol(options.species, options.coreVaccineKey);
  if (!protocol) return [];

  return activeVaccinesForProtocol(protocol)
    .filter((item): item is PreventiveVaccineItem & { key: ProtocolVaccineKey } => isProtocolVaccineKey(item.key))
    .map((item) => ({
      key: item.key,
      name: item.name,
      doses: item.primarySeries.map((dose) => dose.label),
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
 * Build the vaccine schedule for a pet.
 * Protocol is resolved from species (or an explicit protocol override).
 * Unsupported species → empty schedule (no silent feline vaccines).
 */
export function buildVaccineSchedule(
  birthDate: string | null,
  appliedDoses: AppliedDose[],
  protocolOrOptions: "v3" | "v4" | "v5" | BuildVaccineScheduleOptions = "v4",
): ScheduledVaccine[] {
  const options: BuildVaccineScheduleOptions = typeof protocolOrOptions === "string"
    ? { species: "cat", coreVaccineKey: protocolOrOptions }
    : protocolOrOptions;

  const species = typeof protocolOrOptions === "string"
    ? "cat"
    : (options.species === undefined ? "cat" : options.species);

  const protocol = options.protocol !== undefined
    ? options.protocol
    : resolvePreventiveProtocol(species, options.coreVaccineKey ?? "v4");

  if (!protocol) return [];

  const ageDays = getPetAgeDays(birthDate);
  const specs = activeVaccinesForProtocol(protocol);
  const used = new Set<number>();

  return specs.flatMap((spec) => {
    if (!isProtocolVaccineKey(spec.key)) return [];
    const key = spec.key;

    return spec.primarySeries.map((dose): ScheduledVaccine => {
      const minAgeDays = dose.minWeeks * 7;
      const overdueDays = dose.overdueWeeks * 7;

      const appliedIdx = appliedDoses.findIndex(
        (entry, index) => !used.has(index) && doseMatches(entry, key, dose.label),
      );
      const applied = appliedIdx >= 0 ? appliedDoses[appliedIdx] : null;
      if (appliedIdx >= 0) used.add(appliedIdx);

      if (applied) {
        return {
          key,
          name: spec.name,
          doseLabel: dose.label,
          minAgeDays,
          overdueDays,
          status: "done",
          appliedAt: applied.occurredAt,
        };
      }

      if (ageDays == null) {
        return { key, name: spec.name, doseLabel: dose.label, minAgeDays, overdueDays, status: "upcoming", appliedAt: null };
      }

      if (ageDays < minAgeDays) {
        return { key, name: spec.name, doseLabel: dose.label, minAgeDays, overdueDays, status: "upcoming", appliedAt: null };
      }

      if (ageDays >= overdueDays) {
        return { key, name: spec.name, doseLabel: dose.label, minAgeDays, overdueDays, status: "overdue", appliedAt: null };
      }

      return { key, name: spec.name, doseLabel: dose.label, minAgeDays, overdueDays, status: "due", appliedAt: null };
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
