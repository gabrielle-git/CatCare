/**
 * Pure engine: pet profile + sparse overrides + civil "today"
 * → effectivePreventiveProtocol.
 *
 * No DB writes, no UI, no recurrence activation, no clinical rule changes.
 */

import {
  getPreventiveProtocolById,
  normalizePreventiveSpecies,
  resolvePreventiveProtocol,
  type PreventiveProtocol,
  type PreventiveVaccineItem,
  type PrimaryDoseSpec,
  type VaccineRecurrenceRule,
} from "@/lib/preventive-protocol";

/** Civil calendar date YYYY-MM-DD — never derived from Date.now() inside this module. */
export type CivilDate = string;

export type PetPreventiveItemOverrideInput = {
  item_key: string;
  status: "not_applicable" | "deferred";
  deferred_until: CivilDate | null;
  reason: string | null;
};

export type ResolveEffectivePreventiveProtocolInput = {
  species: string | null | undefined;
  preventiveProtocolId?: string | null;
  preventiveCoreVaccineKey?: string | null;
  overrides?: readonly PetPreventiveItemOverrideInput[];
  /** Required civil date for deferred expiry (YYYY-MM-DD). */
  today: CivilDate;
};

export type EffectiveProtocolSource =
  | { kind: "inherited_species"; species: string }
  | { kind: "explicit_protocol_id"; protocolId: string }
  | { kind: "none"; species: string | null }
  | { kind: "invalid_protocol_id"; protocolId: string }
  | { kind: "invalid_core_vaccine_key"; protocolId: string; coreVaccineKey: string };

/**
 * Per-item applicability on top of the template definition.
 * not_applicable / deferred_active stay identifiable for future UI —
 * they are not clinical "done" and must not invent health_records.
 */
export type EffectiveItemApplicability =
  | { kind: "inherit" }
  | { kind: "not_applicable"; reason: string | null }
  | { kind: "deferred_active"; deferredUntil: CivilDate; reason: string | null }
  | {
      kind: "deferred_expired";
      deferredUntil: CivilDate;
      reason: string | null;
    };

export type EffectivePreventiveItem = {
  key: string;
  name: string;
  primarySeries: PrimaryDoseSpec[];
  recurrence: VaccineRecurrenceRule | null;
  applicability: EffectiveItemApplicability;
};

export type EffectivePreventiveIssue =
  | { code: "unknown_protocol_id"; protocolId: string }
  | { code: "invalid_core_vaccine_key"; coreVaccineKey: string; protocolId: string }
  | { code: "orphan_override"; itemKey: string }
  | { code: "no_protocol_for_species"; species: string | null };

export type EffectivePreventiveProtocolResult = {
  /** false when an explicit pet config cannot be honored safely. */
  ok: boolean;
  source: EffectiveProtocolSource;
  /** Effective protocol document (core applied). Null when none / invalid. */
  protocol: PreventiveProtocol | null;
  items: EffectivePreventiveItem[];
  issues: EffectivePreventiveIssue[];
};

const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCivilDate(value: string): boolean {
  return CIVIL_DATE_RE.test(value);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cloneProtocol(protocol: PreventiveProtocol, coreVaccineKey: string): PreventiveProtocol {
  return {
    id: protocol.id,
    species: protocol.species,
    version: protocol.version,
    coreVaccineKey,
    vaccines: protocol.vaccines.map((item) => ({
      ...item,
      primarySeries: item.primarySeries.map((dose) => ({ ...dose })),
    })),
  };
}

function templateHasItemKey(protocol: PreventiveProtocol, key: string): boolean {
  return protocol.vaccines.some((item) => item.key === key);
}

/**
 * Deferred is active strictly while today < deferred_until.
 * today >= deferred_until → expired (inherit schedule rules; row stays in DB).
 */
export function resolveDeferredApplicability(
  deferredUntil: CivilDate,
  today: CivilDate,
  reason: string | null,
): Extract<EffectiveItemApplicability, { kind: "deferred_active" | "deferred_expired" }> {
  if (today < deferredUntil) {
    return { kind: "deferred_active", deferredUntil, reason };
  }
  return { kind: "deferred_expired", deferredUntil, reason };
}

function applicabilityForOverride(
  override: PetPreventiveItemOverrideInput,
  today: CivilDate,
): EffectiveItemApplicability {
  if (override.status === "not_applicable") {
    return { kind: "not_applicable", reason: override.reason };
  }
  // deferred without a date is schema-invalid; treat as inherit + no crash
  if (!override.deferred_until || !isCivilDate(override.deferred_until)) {
    return { kind: "inherit" };
  }
  return resolveDeferredApplicability(override.deferred_until, today, override.reason);
}

function toEffectiveItem(
  item: PreventiveVaccineItem,
  applicability: EffectiveItemApplicability,
): EffectivePreventiveItem {
  return {
    key: item.key,
    name: item.name,
    primarySeries: item.primarySeries.map((dose) => ({ ...dose })),
    recurrence: item.recurrence,
    applicability,
  };
}

/**
 * Resolve the effective preventive protocol for one pet.
 * Pure: no I/O, no mutation of shared catalog templates.
 */
export function resolveEffectivePreventiveProtocol(
  input: ResolveEffectivePreventiveProtocolInput,
): EffectivePreventiveProtocolResult {
  const today = input.today;
  const overrides = input.overrides ?? [];
  const issues: EffectivePreventiveIssue[] = [];
  const species = normalizePreventiveSpecies(input.species);
  const explicitProtocolId = normalizeOptionalText(input.preventiveProtocolId ?? null);
  const explicitCoreKey = normalizeOptionalText(input.preventiveCoreVaccineKey ?? null);

  let base: PreventiveProtocol | null = null;
  let source: EffectiveProtocolSource;

  if (explicitProtocolId) {
    base = getPreventiveProtocolById(explicitProtocolId);
    if (!base) {
      return {
        ok: false,
        source: { kind: "invalid_protocol_id", protocolId: explicitProtocolId },
        protocol: null,
        items: [],
        issues: [{ code: "unknown_protocol_id", protocolId: explicitProtocolId }],
      };
    }
    source = { kind: "explicit_protocol_id", protocolId: explicitProtocolId };
  } else {
    base = resolvePreventiveProtocol(species, "v4");
    if (!base) {
      return {
        ok: true,
        source: { kind: "none", species },
        protocol: null,
        items: [],
        issues: [{ code: "no_protocol_for_species", species }],
      };
    }
    source = { kind: "inherited_species", species: species! };
  }

  let effectiveCore = base.coreVaccineKey;
  if (explicitCoreKey) {
    if (!templateHasItemKey(base, explicitCoreKey)) {
      return {
        ok: false,
        source: {
          kind: "invalid_core_vaccine_key",
          protocolId: base.id,
          coreVaccineKey: explicitCoreKey,
        },
        protocol: null,
        items: [],
        issues: [
          {
            code: "invalid_core_vaccine_key",
            coreVaccineKey: explicitCoreKey,
            protocolId: base.id,
          },
        ],
      };
    }
    effectiveCore = explicitCoreKey;
  }

  const protocol = cloneProtocol(base, effectiveCore);

  const overrideByKey = new Map<string, PetPreventiveItemOverrideInput>();
  for (const row of overrides) {
    const key = normalizeOptionalText(row.item_key);
    if (!key) continue;
    if (!templateHasItemKey(protocol, key)) {
      issues.push({ code: "orphan_override", itemKey: key });
      continue;
    }
    // Last write wins if duplicates slip through; UNIQUE(pet_id,item_key) prevents this in DB.
    overrideByKey.set(key, { ...row, item_key: key });
  }

  const items: EffectivePreventiveItem[] = protocol.vaccines.map((item) => {
    const override = overrideByKey.get(item.key);
    const applicability = override ? applicabilityForOverride(override, today) : { kind: "inherit" as const };
    return toEffectiveItem(item, applicability);
  });

  return {
    ok: true,
    source,
    protocol,
    items,
    issues,
  };
}

/** Items that should participate in due/overdue evaluation (not N/A, not actively deferred). */
export function evaluableEffectiveItems(
  result: EffectivePreventiveProtocolResult,
): EffectivePreventiveItem[] {
  return result.items.filter((item) => {
    const kind = item.applicability.kind;
    return kind === "inherit" || kind === "deferred_expired";
  });
}
