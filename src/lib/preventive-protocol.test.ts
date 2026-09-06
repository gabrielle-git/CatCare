import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FELINE_DEFAULT_PROTOCOL_ID,
  activeVaccinesForProtocol,
  createFelineDefaultProtocol,
  resolvePreventiveProtocol,
} from "./preventive-protocol";
import {
  buildVaccineSchedule,
  listSelectableVaccines,
  type AppliedDose,
} from "./vaccine-schedule";

describe("resolvePreventiveProtocol", () => {
  it("A. cat receives feline_default_v1", () => {
    const protocol = resolvePreventiveProtocol("cat");
    assert.ok(protocol);
    assert.equal(protocol.id, FELINE_DEFAULT_PROTOCOL_ID);
    assert.equal(protocol.species, "cat");
    assert.equal(protocol.version, 1);
    assert.equal(protocol.coreVaccineKey, "v4");
  });

  it("normalizes CAT casing and whitespace", () => {
    assert.equal(resolvePreventiveProtocol(" CAT ")?.id, FELINE_DEFAULT_PROTOCOL_ID);
  });

  it("C. non-cat does not receive feline protocol", () => {
    assert.equal(resolvePreventiveProtocol("dog"), null);
    assert.equal(resolvePreventiveProtocol("bird"), null);
    assert.equal(resolvePreventiveProtocol("rabbit"), null);
  });

  it("D. unknown / empty / null species is safe (no invented protocol)", () => {
    assert.equal(resolvePreventiveProtocol(null), null);
    assert.equal(resolvePreventiveProtocol(undefined), null);
    assert.equal(resolvePreventiveProtocol(""), null);
    assert.equal(resolvePreventiveProtocol("   "), null);
    assert.equal(resolvePreventiveProtocol("unknown"), null);
  });
});

describe("feline protocol clinical values preserved", () => {
  it("does not invent recurrence on any feline item", () => {
    const protocol = createFelineDefaultProtocol();
    for (const item of protocol.vaccines) {
      assert.equal(item.recurrence, null, `${item.key} must keep recurrence null`);
    }
  });

  it("preserves primary series ages/labels for v4 + rabies active set", () => {
    const protocol = createFelineDefaultProtocol("v4");
    const active = activeVaccinesForProtocol(protocol);
    assert.deepEqual(
      active.map((item) => ({
        key: item.key,
        doses: item.primarySeries.map((dose) => ({
          label: dose.label,
          minWeeks: dose.minWeeks,
          overdueWeeks: dose.overdueWeeks,
        })),
      })),
      [
        {
          key: "v4",
          doses: [
            { label: "1ª dose", minWeeks: 8, overdueWeeks: 12 },
            { label: "2ª dose", minWeeks: 12, overdueWeeks: 16 },
            { label: "3ª dose", minWeeks: 16, overdueWeeks: 20 },
          ],
        },
        {
          key: "rabies",
          doses: [{ label: "Dose única", minWeeks: 16, overdueWeeks: 24 }],
        },
      ],
    );
  });
});

describe("buildVaccineSchedule species resolution", () => {
  const empty: AppliedDose[] = [];

  it("B. cat keeps previous schedule shape (v4 + rabies primary doses)", () => {
    const schedule = buildVaccineSchedule("2024-01-01", empty, { species: "cat" });
    assert.deepEqual(
      schedule.map((row) => ({
        key: row.key,
        doseLabel: row.doseLabel,
        minAgeDays: row.minAgeDays,
        overdueDays: row.overdueDays,
      })),
      [
        { key: "v4", doseLabel: "1ª dose", minAgeDays: 56, overdueDays: 84 },
        { key: "v4", doseLabel: "2ª dose", minAgeDays: 84, overdueDays: 112 },
        { key: "v4", doseLabel: "3ª dose", minAgeDays: 112, overdueDays: 140 },
        { key: "rabies", doseLabel: "Dose única", minAgeDays: 112, overdueDays: 168 },
      ],
    );
  });

  it("legacy string core arg still implies cat", () => {
    const viaString = buildVaccineSchedule("2024-01-01", empty, "v4");
    const viaOptions = buildVaccineSchedule("2024-01-01", empty, { species: "cat", coreVaccineKey: "v4" });
    assert.deepEqual(
      viaString.map((row) => `${row.key}:${row.doseLabel}`),
      viaOptions.map((row) => `${row.key}:${row.doseLabel}`),
    );
  });

  it("C. non-cat schedule is empty (no silent V3/V4/V5/rabies)", () => {
    assert.deepEqual(buildVaccineSchedule("2024-01-01", empty, { species: "dog" }), []);
    assert.deepEqual(buildVaccineSchedule("2024-01-01", empty, { species: "bird" }), []);
  });

  it("D. null species does not invent a feline schedule", () => {
    assert.deepEqual(buildVaccineSchedule("2024-01-01", empty, { species: null }), []);
  });

  it("E. structured applied doses still mark primary as done (ledger semantics)", () => {
    const applied: AppliedDose[] = [
      {
        vaccineTitle: "Quádrupla Felina (V4) — 1ª dose",
        occurredAt: "2024-06-01T12:00:00-03:00",
        vaccineKey: "v4",
        doseLabel: "1ª dose",
      },
    ];
    const schedule = buildVaccineSchedule("2024-01-01", applied, { species: "cat" });
    const first = schedule.find((row) => row.key === "v4" && row.doseLabel === "1ª dose");
    assert.equal(first?.status, "done");
    assert.equal(first?.appliedAt, "2024-06-01T12:00:00-03:00");
  });
});

describe("listSelectableVaccines", () => {
  it("cat gets v4 + rabies", () => {
    const keys = listSelectableVaccines({ species: "cat" }).map((item) => item.key);
    assert.deepEqual(keys, ["v4", "rabies"]);
  });

  it("non-cat gets no protocol vaccines", () => {
    assert.deepEqual(listSelectableVaccines({ species: "dog" }), []);
  });
});
