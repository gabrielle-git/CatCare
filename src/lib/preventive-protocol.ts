/**
 * Preventive protocol foundation.
 *
 * vaccine_doses remains a ledger of applications.
 * Future obligations are derived from protocol + ledger — not from next_due_at.
 *
 * Recurrence fields are structural only until clinically validated per item.
 * Do not invent intervals for V3/V4/V5.
 */

export type PreventiveSpecies = string;

/** Prepared for future validated rules. Not activated in this PR. */
export type VaccineRecurrenceRule =
  | { kind: "calendar_years"; interval: number; graceDays?: number }
  | { kind: "interval_days"; interval: number; graceDays?: number };

export type PrimaryDoseSpec = {
  label: string;
  /** Minimum age in weeks to receive this dose */
  minWeeks: number;
  /** Age in weeks after which this dose is overdue */
  overdueWeeks: number;
};

export type PreventiveVaccineItem = {
  key: string;
  name: string;
  primarySeries: PrimaryDoseSpec[];
  /**
   * Optional recurrence after the primary series is complete.
   * Must stay null until a validated clinical rule exists for this item.
   */
  recurrence: VaccineRecurrenceRule | null;
};

/**
 * Extensible protocol document.
 * Future: region, risk profile, product label, pet overrides — without a global schedule.
 */
export type PreventiveProtocol = {
  id: string;
  species: PreventiveSpecies;
  version: number;
  /** Which core combo series is active for this household/protocol variant (v3|v4|v5). */
  coreVaccineKey: string;
  vaccines: PreventiveVaccineItem[];
};

/** Current CatCare feline calendar — ages/doses unchanged from pre-abstraction schedule. */
export const FELINE_DEFAULT_PROTOCOL_ID = "feline_default_v1";

const FELINE_DEFAULT_V1_VACCINES: PreventiveVaccineItem[] = [
  {
    key: "v3",
    name: "Tríplice Felina (V3)",
    primarySeries: [
      { label: "1ª dose", minWeeks: 8, overdueWeeks: 12 },
      { label: "2ª dose", minWeeks: 12, overdueWeeks: 16 },
      { label: "3ª dose", minWeeks: 16, overdueWeeks: 20 },
    ],
    recurrence: null,
  },
  {
    key: "v4",
    name: "Quádrupla Felina (V4)",
    primarySeries: [
      { label: "1ª dose", minWeeks: 8, overdueWeeks: 12 },
      { label: "2ª dose", minWeeks: 12, overdueWeeks: 16 },
      { label: "3ª dose", minWeeks: 16, overdueWeeks: 20 },
    ],
    recurrence: null,
  },
  {
    key: "v5",
    name: "Quíntupla Felina (V5/FeLV)",
    primarySeries: [
      { label: "1ª dose", minWeeks: 8, overdueWeeks: 12 },
      { label: "2ª dose", minWeeks: 12, overdueWeeks: 16 },
    ],
    recurrence: null,
  },
  {
    key: "rabies",
    name: "Antirrábica",
    primarySeries: [
      // Existing CatCare threshold (16 weeks). DF annual renewal is NOT activated here.
      { label: "Dose única", minWeeks: 16, overdueWeeks: 24 },
    ],
    recurrence: null,
  },
];

export function createFelineDefaultProtocol(coreVaccineKey: "v3" | "v4" | "v5" = "v4"): PreventiveProtocol {
  return {
    id: FELINE_DEFAULT_PROTOCOL_ID,
    species: "cat",
    version: 1,
    coreVaccineKey,
    vaccines: FELINE_DEFAULT_V1_VACCINES,
  };
}

function normalizeSpecies(species: string | null | undefined): string | null {
  if (species == null) return null;
  const trimmed = species.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve which preventive vaccine protocol applies to a pet.
 * Unsupported / unknown species → null (no silent feline schedule).
 */
export function resolvePreventiveProtocol(
  species: string | null | undefined,
  coreVaccineKey: "v3" | "v4" | "v5" = "v4",
): PreventiveProtocol | null {
  const normalized = normalizeSpecies(species);
  if (normalized === "cat") {
    return createFelineDefaultProtocol(coreVaccineKey);
  }
  return null;
}

/** Vaccines visible for the active core combo + always-on companions (e.g. rabies). */
export function activeVaccinesForProtocol(protocol: PreventiveProtocol): PreventiveVaccineItem[] {
  return protocol.vaccines.filter(
    (item) => item.key === protocol.coreVaccineKey || item.key === "rabies",
  );
}

export function protocolVaccineKeys(protocol: PreventiveProtocol): Set<string> {
  return new Set(protocol.vaccines.map((item) => item.key));
}
