import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FEEDING_GENERIC_LABEL,
  feedingAmountInMl,
  feedingRecordTitle,
  formatFeedingAmountFromRow,
  getFeedingDisplay,
  resolveFeedingAmount,
  resolvePetNotes,
  resolvePetNotesForCreate,
  shouldPreserveLegacyFeedingAmount,
  showPerPetNotesToggle,
  syncPerPetNotesTargets,
} from "./neonatal-feeding";
import { computeNeonatalSummaries } from "./neonatal-stats";
import { compareNeonatalTimelineItems } from "./neonatal-history";
import type { NeonatalRecord, TimelineItem } from "@/types/database";

function feeding(partial: Partial<NeonatalRecord> & Pick<NeonatalRecord, "id" | "pet_id">): NeonatalRecord {
  return {
    household_id: "hh",
    type: "feeding",
    occurred_at: "2026-09-07T10:00:00-03:00",
    amount_ml: null,
    feeding_subtype: null,
    feeding_amount_value: null,
    feeding_amount_unit: null,
    weight_grams: null,
    temperature_c: null,
    quality: null,
    notes: null,
    created_at: "2026-09-07T10:00:00-03:00",
    ...partial,
  };
}

describe("neonatal feeding helpers", () => {
  it("A/B: legacy amount_ml displays as ml with Alimentação title", () => {
    const row = feeding({ id: "1", pet_id: "p1", amount_ml: 15 });
    assert.deepEqual(resolveFeedingAmount(row), { value: 15, unit: "ml", source: "legacy_ml" });
    assert.equal(formatFeedingAmountFromRow(row), "15 ml");
    assert.equal(feedingRecordTitle(row), FEEDING_GENERIC_LABEL);
  });

  it("C–F: structured subtypes and amounts", () => {
    assert.equal(feedingRecordTitle(feeding({ id: "m", pet_id: "p", feeding_subtype: "milk" })), "Leite / mamadeira");
    assert.equal(feedingRecordTitle(feeding({ id: "w", pet_id: "p", feeding_subtype: "wet_food" })), "Sachê / alimento úmido");
    assert.equal(feedingRecordTitle(feeding({ id: "u", pet_id: "p", feeding_subtype: "puree" })), "Papinha");
    assert.equal(feedingRecordTitle(feeding({ id: "o", pet_id: "p", feeding_subtype: "other" })), "Outro");

    const wet = feeding({
      id: "w2",
      pet_id: "p",
      feeding_subtype: "wet_food",
      feeding_amount_value: 20,
      feeding_amount_unit: "g",
    });
    assert.equal(formatFeedingAmountFromRow(wet), "20 g");
    assert.equal(getFeedingDisplay(wet).title, "Sachê / alimento úmido");
  });

  it("G–J: totalMl only sums millilitres", () => {
    const rows = [
      feeding({ id: "l", pet_id: "p1", amount_ml: 10, occurred_at: "2026-09-07T08:00:00-03:00" }),
      feeding({
        id: "m",
        pet_id: "p1",
        feeding_subtype: "milk",
        feeding_amount_value: 8,
        feeding_amount_unit: "ml",
        occurred_at: "2026-09-07T09:00:00-03:00",
      }),
      feeding({
        id: "g",
        pet_id: "p1",
        feeding_subtype: "wet_food",
        feeding_amount_value: 20,
        feeding_amount_unit: "g",
        occurred_at: "2026-09-07T10:00:00-03:00",
      }),
      feeding({
        id: "s",
        pet_id: "p1",
        feeding_subtype: "puree",
        feeding_amount_value: 1,
        feeding_amount_unit: "spoon",
        occurred_at: "2026-09-07T11:00:00-03:00",
      }),
    ];
    assert.equal(feedingAmountInMl(rows[0]), 10);
    assert.equal(feedingAmountInMl(rows[1]), 8);
    assert.equal(feedingAmountInMl(rows[2]), null);
    assert.equal(feedingAmountInMl(rows[3]), null);

    const stats = computeNeonatalSummaries(rows, ["p1"], { from: "2026-09-07", to: "2026-09-07" });
    const entry = stats.get("p1")!;
    assert.equal(entry.totalMl, 18);
    assert.equal(entry.feedingCount, 4);
    assert.equal(entry.lastFeedingAt, "2026-09-07T11:00:00-03:00");
    assert.equal(entry.lastFeedingMl, null);
    assert.equal(entry.lastFeedingAmountLabel, "1 colher");
  });

  it("K/L: shared notes vs per-pet override", () => {
    assert.equal(resolvePetNotes("aceitaram bem", null), "aceitaram bem");
    assert.equal(resolvePetNotes("aceitaram bem", ""), "aceitaram bem");
    assert.equal(resolvePetNotes("aceitaram bem", "comeu um pouco menos"), "comeu um pouco menos");
    assert.equal(resolvePetNotes(null, "só individual"), "só individual");
  });

  it("A–C/F: per-pet notes toggle UX rules", () => {
    assert.equal(showPerPetNotesToggle("create", 1), false);
    assert.equal(showPerPetNotesToggle("edit", 2), false);
    assert.equal(showPerPetNotesToggle("create", 2), true);

    assert.deepEqual(syncPerPetNotesTargets(["gwen", "hinata"], ["gwen", "dobby"]), ["gwen"]);

    assert.equal(
      resolvePetNotesForCreate({
        shared: "aceitaram bem",
        individual: "comeu menos",
        perPetNotesEnabled: true,
        petSelectedForIndividual: true,
      }),
      "comeu menos",
    );
    assert.equal(
      resolvePetNotesForCreate({
        shared: "aceitaram bem",
        individual: "",
        perPetNotesEnabled: true,
        petSelectedForIndividual: true,
      }),
      "aceitaram bem",
    );
    assert.equal(
      resolvePetNotesForCreate({
        shared: "aceitaram bem",
        individual: "rascunho escondido",
        perPetNotesEnabled: false,
        petSelectedForIndividual: true,
      }),
      "aceitaram bem",
    );
    assert.equal(
      resolvePetNotesForCreate({
        shared: "aceitaram bem",
        individual: "só para outro",
        perPetNotesEnabled: true,
        petSelectedForIndividual: false,
      }),
      "aceitaram bem",
    );
  });

  it("N/O: legacy preserve vs explicit conversion", () => {
    const legacy = feeding({ id: "1", pet_id: "p", amount_ml: 18 });
    assert.equal(
      shouldPreserveLegacyFeedingAmount({
        existing: legacy,
        nextSubtype: null,
        nextValue: 18,
        nextUnit: "ml",
      }),
      true,
    );
    assert.equal(
      shouldPreserveLegacyFeedingAmount({
        existing: legacy,
        nextSubtype: null,
        nextValue: 19,
        nextUnit: "ml",
      }),
      false,
    );
    assert.equal(
      shouldPreserveLegacyFeedingAmount({
        existing: legacy,
        nextSubtype: "milk",
        nextValue: 18,
        nextUnit: "ml",
      }),
      false,
    );
  });

  it("structured amount wins over legacy amount_ml if both present", () => {
    const row = feeding({
      id: "1",
      pet_id: "p",
      amount_ml: 99,
      feeding_amount_value: 20,
      feeding_amount_unit: "g",
      feeding_subtype: "wet_food",
    });
    assert.equal(resolveFeedingAmount(row)?.source, "structured");
    assert.equal(formatFeedingAmountFromRow(row), "20 g");
  });
});

describe("neonatal history ordering regression", () => {
  it("P: same-time feedings stay stably ordered by kind then pet", () => {
    const petNames = { a: "Gwen", b: "Hinata" };
    const items: TimelineItem[] = [
      {
        id: "2",
        pet_id: "b",
        source: "neonatal",
        kind: "feeding",
        title: "Alimentação",
        detail: "20 g",
        occurred_at: "2026-09-07T10:00:00-03:00",
        tone: "rose",
      },
      {
        id: "1",
        pet_id: "a",
        source: "neonatal",
        kind: "feeding",
        title: "Alimentação",
        detail: "18 ml",
        occurred_at: "2026-09-07T10:00:00-03:00",
        tone: "rose",
      },
    ];
    const sorted = [...items].sort((x, y) => compareNeonatalTimelineItems(x, y, petNames));
    assert.deepEqual(sorted.map((i) => i.id), ["1", "2"]);
  });
});
