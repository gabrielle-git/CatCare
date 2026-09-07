import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluableEffectiveItems,
  resolveDeferredApplicability,
  resolveEffectivePreventiveProtocol,
} from "./effective-preventive-protocol";
import {
  FELINE_DEFAULT_PROTOCOL_ID,
  createFelineDefaultProtocol,
  getPreventiveProtocolById,
} from "./preventive-protocol";

const TODAY = "2026-09-07";
const TOMORROW = "2026-09-08";
const YESTERDAY = "2026-09-06";

const FELINE_CLINICAL_SHAPE = [
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
    primarySeries: [{ label: "Dose única", minWeeks: 16, overdueWeeks: 24 }],
    recurrence: null,
  },
];

describe("resolveEffectivePreventiveProtocol", () => {
  it("A. cat + protocol_id null + core null inherits feline_default_v1 / V4", () => {
    const result = resolveEffectivePreventiveProtocol({
      species: "cat",
      preventiveProtocolId: null,
      preventiveCoreVaccineKey: null,
      today: TODAY,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.source, { kind: "inherited_species", species: "cat" });
    assert.ok(result.protocol);
    assert.equal(result.protocol.id, FELINE_DEFAULT_PROTOCOL_ID);
    assert.equal(result.protocol.coreVaccineKey, "v4");
    assert.equal(result.issues.length, 0);
  });

  it("B. species without template → no automatic protocol", () => {
    const result = resolveEffectivePreventiveProtocol({
      species: "dog",
      today: TODAY,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.source, { kind: "none", species: "dog" });
    assert.equal(result.protocol, null);
    assert.deepEqual(result.items, []);
    assert.ok(result.issues.some((issue) => issue.code === "no_protocol_for_species"));
  });

  it("C. explicit valid protocol_id uses that template", () => {
    const result = resolveEffectivePreventiveProtocol({
      species: "dog", // species ignored when id is explicit
      preventiveProtocolId: FELINE_DEFAULT_PROTOCOL_ID,
      today: TODAY,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.source, {
      kind: "explicit_protocol_id",
      protocolId: FELINE_DEFAULT_PROTOCOL_ID,
    });
    assert.equal(result.protocol?.id, FELINE_DEFAULT_PROTOCOL_ID);
  });

  it("D. explicit invalid protocol_id does NOT silent-fallback to species default", () => {
    const result = resolveEffectivePreventiveProtocol({
      species: "cat",
      preventiveProtocolId: "feline_future_v99",
      today: TODAY,
    });
    assert.equal(result.ok, false);
    assert.equal(result.source.kind, "invalid_protocol_id");
    assert.equal(result.protocol, null);
    assert.deepEqual(result.items, []);
    assert.ok(result.issues.some((issue) => issue.code === "unknown_protocol_id"));
  });

  it("E. valid core override applies without mutating base template", () => {
    const templateBefore = createFelineDefaultProtocol("v4");
    assert.equal(templateBefore.coreVaccineKey, "v4");

    const result = resolveEffectivePreventiveProtocol({
      species: "cat",
      preventiveCoreVaccineKey: "v3",
      today: TODAY,
    });
    assert.equal(result.ok, true);
    assert.equal(result.protocol?.coreVaccineKey, "v3");

    const catalogAgain = getPreventiveProtocolById(FELINE_DEFAULT_PROTOCOL_ID);
    assert.equal(catalogAgain?.coreVaccineKey, "v4");
    assert.equal(createFelineDefaultProtocol().coreVaccineKey, "v4");
  });

  it("F. invalid core override does NOT silent-swap to V4/default", () => {
    const result = resolveEffectivePreventiveProtocol({
      species: "cat",
      preventiveCoreVaccineKey: "v9_invented",
      today: TODAY,
    });
    assert.equal(result.ok, false);
    assert.equal(result.source.kind, "invalid_core_vaccine_key");
    assert.equal(result.protocol, null);
    assert.ok(result.issues.some((issue) => issue.code === "invalid_core_vaccine_key"));
  });

  it("G. no item override → inherit", () => {
    const result = resolveEffectivePreventiveProtocol({
      species: "cat",
      overrides: [],
      today: TODAY,
    });
    assert.ok(result.items.every((item) => item.applicability.kind === "inherit"));
  });

  it("H. not_applicable stays identifiable and is not evaluable/done", () => {
    const result = resolveEffectivePreventiveProtocol({
      species: "cat",
      today: TODAY,
      overrides: [
        {
          item_key: "rabies",
          status: "not_applicable",
          deferred_until: null,
          reason: "Indoor only",
        },
      ],
    });
    const rabies = result.items.find((item) => item.key === "rabies");
    assert.ok(rabies);
    assert.deepEqual(rabies.applicability, {
      kind: "not_applicable",
      reason: "Indoor only",
    });
    assert.equal(rabies.name, "Antirrábica");
    assert.ok(!evaluableEffectiveItems(result).some((item) => item.key === "rabies"));
    // Still present on the effective list (not deleted / not "done")
    assert.ok(result.items.some((item) => item.key === "rabies"));
  });

  it("I. deferred_until tomorrow → deferred active", () => {
    const result = resolveEffectivePreventiveProtocol({
      species: "cat",
      today: TODAY,
      overrides: [
        {
          item_key: "v4",
          status: "deferred",
          deferred_until: TOMORROW,
          reason: "Wait for clinic",
        },
      ],
    });
    const v4 = result.items.find((item) => item.key === "v4");
    assert.deepEqual(v4?.applicability, {
      kind: "deferred_active",
      deferredUntil: TOMORROW,
      reason: "Wait for clinic",
    });
    assert.ok(!evaluableEffectiveItems(result).some((item) => item.key === "v4"));
  });

  it("J. deferred_until today → expired, normal evaluation again", () => {
    const result = resolveEffectivePreventiveProtocol({
      species: "cat",
      today: TODAY,
      overrides: [
        {
          item_key: "v4",
          status: "deferred",
          deferred_until: TODAY,
          reason: null,
        },
      ],
    });
    const v4 = result.items.find((item) => item.key === "v4");
    assert.equal(v4?.applicability.kind, "deferred_expired");
    assert.ok(evaluableEffectiveItems(result).some((item) => item.key === "v4"));
  });

  it("K. deferred_until yesterday → expired / normal evaluation", () => {
    assert.deepEqual(resolveDeferredApplicability(YESTERDAY, TODAY, null), {
      kind: "deferred_expired",
      deferredUntil: YESTERDAY,
      reason: null,
    });
    const result = resolveEffectivePreventiveProtocol({
      species: "cat",
      today: TODAY,
      overrides: [
        {
          item_key: "rabies",
          status: "deferred",
          deferred_until: YESTERDAY,
          reason: null,
        },
      ],
    });
    assert.equal(
      result.items.find((item) => item.key === "rabies")?.applicability.kind,
      "deferred_expired",
    );
    assert.ok(evaluableEffectiveItems(result).some((item) => item.key === "rabies"));
  });

  it("L. unknown override item_key → no crash + orphan warning", () => {
    const result = resolveEffectivePreventiveProtocol({
      species: "cat",
      today: TODAY,
      overrides: [
        {
          item_key: "custom_future_item",
          status: "not_applicable",
          deferred_until: null,
          reason: null,
        },
      ],
    });
    assert.equal(result.ok, true);
    assert.ok(result.protocol);
    assert.ok(result.issues.some((issue) => issue.code === "orphan_override"));
    assert.ok(!result.items.some((item) => item.key === "custom_future_item"));
  });

  it("M. two pets with different overrides do not contaminate each other", () => {
    const petA = resolveEffectivePreventiveProtocol({
      species: "cat",
      today: TODAY,
      overrides: [
        {
          item_key: "rabies",
          status: "not_applicable",
          deferred_until: null,
          reason: "A",
        },
      ],
    });
    const petB = resolveEffectivePreventiveProtocol({
      species: "cat",
      today: TODAY,
      overrides: [
        {
          item_key: "v4",
          status: "deferred",
          deferred_until: TOMORROW,
          reason: "B",
        },
      ],
    });

    assert.equal(petA.items.find((i) => i.key === "rabies")?.applicability.kind, "not_applicable");
    assert.equal(petA.items.find((i) => i.key === "v4")?.applicability.kind, "inherit");
    assert.equal(petB.items.find((i) => i.key === "rabies")?.applicability.kind, "inherit");
    assert.equal(petB.items.find((i) => i.key === "v4")?.applicability.kind, "deferred_active");

    // Mutating petA effective item must not affect petB / catalog
    const aRabies = petA.items.find((i) => i.key === "rabies")!;
    aRabies.name = "MUTATED";
    aRabies.primarySeries[0].minWeeks = 999;
    assert.equal(petB.items.find((i) => i.key === "rabies")?.name, "Antirrábica");
    assert.equal(getPreventiveProtocolById(FELINE_DEFAULT_PROTOCOL_ID)?.vaccines[3].name, "Antirrábica");
    assert.equal(createFelineDefaultProtocol().vaccines.find((v) => v.key === "rabies")?.primarySeries[0].minWeeks, 16);
  });

  it("N. recurrence on effective items stays null", () => {
    const result = resolveEffectivePreventiveProtocol({
      species: "cat",
      preventiveCoreVaccineKey: "v5",
      today: TODAY,
    });
    assert.ok(result.items.every((item) => item.recurrence === null));
    assert.ok(result.protocol?.vaccines.every((item) => item.recurrence === null));
  });

  it("O. feline_default_v1 clinical shape matches PR #22", () => {
    const protocol = createFelineDefaultProtocol("v4");
    assert.equal(protocol.id, FELINE_DEFAULT_PROTOCOL_ID);
    assert.equal(protocol.species, "cat");
    assert.equal(protocol.version, 1);
    assert.equal(protocol.coreVaccineKey, "v4");
    assert.deepEqual(
      protocol.vaccines.map((item) => ({
        key: item.key,
        name: item.name,
        primarySeries: item.primarySeries,
        recurrence: item.recurrence,
      })),
      FELINE_CLINICAL_SHAPE,
    );
  });
});

describe("getPreventiveProtocolById", () => {
  it("returns feline_default_v1 and null for unknown", () => {
    assert.equal(getPreventiveProtocolById(FELINE_DEFAULT_PROTOCOL_ID)?.id, FELINE_DEFAULT_PROTOCOL_ID);
    assert.equal(getPreventiveProtocolById("nope"), null);
    assert.equal(getPreventiveProtocolById("  "), null);
  });
});
