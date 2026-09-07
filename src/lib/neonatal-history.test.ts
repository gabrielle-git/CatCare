import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FACTUAL_DATE_MESSAGE,
  validateFactualCivilDate,
} from "./factual-datetime";
import {
  compareNeonatalTimelineItems,
  isNeonatalHistoryKind,
  neonatalHistoryHref,
  resolveNeonatalHistoryRange,
  sortNeonatalTimelineItems,
} from "./neonatal-history";
import { resolveReturnTo, safeReturnPath, shouldSaveObservationAsNeonatal } from "./record-form";
import type { TimelineItem } from "@/types/database";

function item(partial: Partial<TimelineItem> & Pick<TimelineItem, "id" | "pet_id" | "kind" | "occurred_at">): TimelineItem {
  return {
    source: partial.source ?? "neonatal",
    title: partial.title ?? partial.kind,
    detail: partial.detail ?? null,
    tone: partial.tone ?? "peach",
    ...partial,
  };
}

const SAME_TIME = "2026-09-07T08:00:00.000Z";
const PETS: Record<string, string> = { gwen: "Gwen", hinata: "Hinata" };

describe("neonatal history filters / return context", () => {
  it("A. from/to in URL resolve and survive reload representation", () => {
    const range = resolveNeonatalHistoryRange("2026-08-20", "2026-09-07");
    assert.deepEqual(range, { from: "2026-08-20", to: "2026-09-07" });
    assert.equal(
      neonatalHistoryHref(range),
      "/neonatal/historico?from=2026-08-20&to=2026-09-07",
    );
  });

  it("B/C/D. return_to with filters is a safe navigable path", () => {
    const href = neonatalHistoryHref({ from: "2026-08-20", to: "2026-09-07" });
    assert.equal(resolveReturnTo(href), href);
    assert.equal(safeReturnPath(href, "/neonatal"), href);
    // Cancel/edit flows reuse the same encoded return_to
    const encoded = encodeURIComponent(href);
    assert.equal(decodeURIComponent(encoded), href);
  });

  it("swaps inverted from/to", () => {
    assert.deepEqual(resolveNeonatalHistoryRange("2026-09-07", "2026-08-20"), {
      from: "2026-08-20",
      to: "2026-09-07",
    });
  });
});

describe("neonatal history ordering", () => {
  it("E. same occurred_at sorts by kind rank (urine before stool)", () => {
    const rows = [
      item({ id: "1", pet_id: "gwen", kind: "stool", occurred_at: SAME_TIME }),
      item({ id: "2", pet_id: "gwen", kind: "urine", occurred_at: SAME_TIME }),
    ];
    const sorted = sortNeonatalTimelineItems(rows, PETS);
    assert.deepEqual(sorted.map((row) => row.kind), ["urine", "stool"]);
  });

  it("F. same time + kind sorts by pet name", () => {
    const rows = [
      item({ id: "1", pet_id: "hinata", kind: "urine", occurred_at: SAME_TIME }),
      item({ id: "2", pet_id: "gwen", kind: "urine", occurred_at: SAME_TIME }),
    ];
    const sorted = sortNeonatalTimelineItems(rows, PETS);
    assert.deepEqual(sorted.map((row) => row.pet_id), ["gwen", "hinata"]);
  });

  it("G. ordering is deterministic across refreshes", () => {
    const rows = [
      item({ id: "c", pet_id: "hinata", kind: "stool", occurred_at: SAME_TIME }),
      item({ id: "a", pet_id: "gwen", kind: "urine", occurred_at: SAME_TIME }),
      item({ id: "b", pet_id: "hinata", kind: "urine", occurred_at: SAME_TIME }),
      item({ id: "d", pet_id: "gwen", kind: "stool", occurred_at: SAME_TIME }),
    ];
    const once = sortNeonatalTimelineItems(rows, PETS).map((row) => row.id).join(",");
    const twice = sortNeonatalTimelineItems([...rows].reverse(), PETS).map((row) => row.id).join(",");
    assert.equal(once, twice);
    assert.equal(once, "a,b,d,c");
  });

  it("desired same-hour visual cluster", () => {
    const rows = [
      item({ id: "1", pet_id: "hinata", kind: "stool", occurred_at: SAME_TIME, title: "Cocô" }),
      item({ id: "2", pet_id: "gwen", kind: "urine", occurred_at: SAME_TIME, title: "Xixi" }),
      item({ id: "3", pet_id: "hinata", kind: "urine", occurred_at: SAME_TIME, title: "Xixi" }),
      item({ id: "4", pet_id: "gwen", kind: "stool", occurred_at: SAME_TIME, title: "Cocô" }),
    ];
    const labels = sortNeonatalTimelineItems(rows, PETS).map(
      (row) => `${row.title} — ${PETS[row.pet_id]}`,
    );
    assert.deepEqual(labels, [
      "Xixi — Gwen",
      "Xixi — Hinata",
      "Cocô — Gwen",
      "Cocô — Hinata",
    ]);
  });

  it("does not merge items (J)", () => {
    const rows = [
      item({ id: "1", pet_id: "gwen", kind: "urine", occurred_at: SAME_TIME }),
      item({ id: "2", pet_id: "hinata", kind: "urine", occurred_at: SAME_TIME }),
    ];
    assert.equal(sortNeonatalTimelineItems(rows, PETS).length, 2);
  });
});

describe("neonatal Nota visibility", () => {
  it("H. observation is a neonatal history kind", () => {
    assert.equal(isNeonatalHistoryKind("observation"), true);
  });

  it("I. other neonatal kinds remain included", () => {
    for (const kind of ["feeding", "urine", "stool", "weight", "temperature"]) {
      assert.equal(isNeonatalHistoryKind(kind), true);
    }
    assert.equal(isNeonatalHistoryKind("vaccine"), false);
  });

  it("neonatal observation saves to neonatal path", () => {
    assert.equal(
      shouldSaveObservationAsNeonatal("observation", [{ birth_date: "2026-08-20" }], true, () => true),
      true,
    );
    assert.equal(
      shouldSaveObservationAsNeonatal("observation", [{ birth_date: "2020-01-01" }], false, () => false),
      false,
    );
  });
});

describe("PR #25 integrity does not regress", () => {
  it("K. factual civil date still rejects tomorrow", () => {
    const now = new Date("2026-09-07T14:00:00-03:00");
    const result = validateFactualCivilDate("2026-09-08", now);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, FACTUAL_DATE_MESSAGE);
  });
});

describe("compareNeonatalTimelineItems", () => {
  it("later timestamp wins regardless of kind", () => {
    const later = item({ id: "1", pet_id: "gwen", kind: "stool", occurred_at: "2026-09-07T09:00:00.000Z" });
    const earlier = item({ id: "2", pet_id: "gwen", kind: "urine", occurred_at: "2026-09-07T08:00:00.000Z" });
    assert.ok(compareNeonatalTimelineItems(later, earlier, PETS) < 0);
  });
});
