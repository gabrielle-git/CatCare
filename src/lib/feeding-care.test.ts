import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FEEDING_CARE_PRESETS,
  FEEDING_CARE_SUBTYPE_KEYS,
  buildFeedingAmountPair,
  buildFeedingItem,
  buildFeedingItems,
  buildFeedingSessionBatchPayload,
  countFeedingAwareCreateRecords,
  feedingCareDisplayLabel,
  feedingSearchExtras,
  feedingSessionTimelineTitle,
  formatFeedingSessionDetail,
  parseFeedingSubtypeList,
} from "./feeding-care";
import { isNeonatalCareType, resolveRecordSource } from "./record-form";
import { validateCreateRecordForm } from "./record-form-validation";
import { computeNeonatalSummaries, formatNeonatalDailyStats } from "./neonatal-stats";
import { isNeonatalTimelineItem } from "./records";
import type { FeedingSessionWithItems, NeonatalRecord, TimelineItem } from "@/types/database";

describe("feeding-care catalog", () => {
  it("presets cover expected keys and PT labels", () => {
    assert.deepEqual(
      FEEDING_CARE_PRESETS.map((p) => p.key),
      [...FEEDING_CARE_SUBTYPE_KEYS],
    );
    assert.equal(feedingCareDisplayLabel("milk"), "Leite / mamadeira");
    assert.equal(feedingCareDisplayLabel("wet_food"), "Sachê / alimento úmido");
    assert.equal(feedingCareDisplayLabel("puree"), "Papinha");
    assert.equal(feedingCareDisplayLabel("dry_food"), "Ração seca");
    assert.equal(feedingCareDisplayLabel("treat"), "Petisco");
    assert.equal(feedingCareDisplayLabel("homemade"), "Comida caseira");
    assert.equal(feedingCareDisplayLabel("other", "Frango"), "Frango");
  });

  it("amount optional: both null OR value+unit", () => {
    assert.deepEqual(buildFeedingAmountPair("", "ml", ""), { ok: true, amount_value: null, amount_unit: null });
    const ok = buildFeedingAmountPair("25", "g", "");
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.amount_value, 25);
      assert.equal(ok.amount_unit, "g");
    }
    const bad = buildFeedingAmountPair("25", "", "");
    assert.equal(bad.ok, false);
  });

  it("other requires custom label", () => {
    assert.equal(buildFeedingItem("other", "  ").ok, false);
    const ok = buildFeedingItem("other", "Patê caseiro");
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.item.custom_label, "Patê caseiro");
      assert.equal(ok.item.amount_value, null);
    }
  });

  it("1 session = 1 meal with 2 items display", () => {
    const built = buildFeedingItems(["dry_food", "wet_food"], null, new Map([
      ["dry_food", { value: "25", unitPreset: "g", unitOther: "" }],
      ["wet_food", { value: "20", unitPreset: "g", unitOther: "" }],
    ]));
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.items.length, 2);
    assert.equal(formatFeedingSessionDetail(built.items), "Ração seca 25 g · Sachê / alimento úmido 20 g");
    assert.equal(countFeedingAwareCreateRecords(["feeding"], 1, 0), 1);
    assert.equal(countFeedingAwareCreateRecords(["feeding"], 2, 0), 2);
  });

  it("multi-pet payload expands 1 session per pet with shared items", () => {
    const built = buildFeedingItems(["dry_food", "wet_food"], null);
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const batch = buildFeedingSessionBatchPayload({
      petIds: ["gwen", "hinata"],
      notesByPetId: new Map([
        ["gwen", "comeu bem"],
        ["hinata", null],
      ]),
      defaultItems: built.items,
    });
    assert.equal(batch.ok, true);
    if (!batch.ok) return;
    assert.equal(batch.payload.length, 2);
    assert.equal(batch.payload[0].items.length, 2);
    assert.equal(batch.payload[0].notes, "comeu bem");
    assert.equal(batch.payload[1].notes, null);
  });

  it("search aliases cover racao/sache/leite", () => {
    const extras = feedingSearchExtras([
      { subtype: "dry_food", custom_label: null },
      { subtype: "wet_food", custom_label: null },
      { subtype: "milk", custom_label: null },
    ]);
    assert.match(extras, /racao/i);
    assert.match(extras, /sache/i);
    assert.match(extras, /mamadeira/i);
  });

  it("resolveRecordSource feeding → feeding; adult feeding allowed / urine blocked", () => {
    assert.equal(resolveRecordSource("feeding"), "feeding");
    assert.equal(resolveRecordSource("urine"), "neonatal");
    assert.equal(isNeonatalCareType("feeding"), false);
    assert.equal(isNeonatalCareType("urine"), true);
  });

  it("create validation: at least one component; amount optional", () => {
    const petNames = new Map([["p1", "Gwen"]]);
    assert.equal(
      validateCreateRecordForm({
        petIds: ["p1"],
        types: ["feeding"],
        weightKg: "",
        weightKgByPetId: {},
        feedingSubtype: "",
        feedingAmountValue: "",
        feedingUnitPreset: "ml",
        feedingUnitOther: "",
        feedingSessionMode: true,
        feedingSubtypes: [],
        feedingCustomLabel: "",
        temperatureC: "",
        hygieneSubtype: "",
        hygieneCustomLabel: "",
        petNames,
      }),
      "Escolha ao menos um alimento.",
    );
    assert.equal(
      validateCreateRecordForm({
        petIds: ["p1"],
        types: ["feeding"],
        weightKg: "",
        weightKgByPetId: {},
        feedingSubtype: "",
        feedingAmountValue: "",
        feedingUnitPreset: "ml",
        feedingUnitOther: "",
        feedingSessionMode: true,
        feedingSubtypes: ["dry_food"],
        feedingCustomLabel: "",
        temperatureC: "",
        hygieneSubtype: "",
        hygieneCustomLabel: "",
        petNames,
      }),
      null,
    );
  });

  it("parseFeedingSubtypeList dedupes", () => {
    assert.deepEqual(parseFeedingSubtypeList(["dry_food", "dry_food", "treat"]), ["dry_food", "treat"]);
  });
});

describe("feeding session timeline classification (not neonatal)", () => {
  it("adult feeding_session → source feeding / Alimentação; never neonatal", () => {
    const item: TimelineItem = {
      id: "session-adult",
      pet_id: "adult-pet",
      source: "feeding",
      kind: "feeding",
      title: feedingSessionTimelineTitle(),
      detail: "Ração seca 25 g · Sachê / alimento úmido 20 g",
      occurred_at: "2026-09-08T19:30:00-03:00",
      tone: "rose",
    };
    assert.equal(item.source, "feeding");
    assert.equal(item.kind, "feeding");
    assert.equal(item.title, "Alimentação");
    assert.equal(isNeonatalTimelineItem(item), false);
    // Adult pet history keeps non-neonatal rows (feeding sessions stay visible).
    const adultHistory = [item].filter((row) => !isNeonatalTimelineItem(row));
    assert.equal(adultHistory.length, 1);
    assert.equal(adultHistory[0]?.source, "feeding");
  });

  it("kitten feeding_session → still feeding/Alimentação (not neonatal source)", () => {
    const item: TimelineItem = {
      id: "session-kitten",
      pet_id: "kitten-pet",
      source: "feeding",
      kind: "feeding",
      title: feedingSessionTimelineTitle(),
      detail: "Leite / mamadeira 18 ml · Sachê / alimento úmido 10 g",
      occurred_at: "2026-09-08T10:00:00-03:00",
      tone: "rose",
    };
    assert.equal(isNeonatalTimelineItem(item), false);
    assert.equal(item.title, "Alimentação");
    assert.equal(resolveRecordSource("feeding"), "feeding");
  });

  it("legacy neonatal_records feeding → remains neonatal", () => {
    const legacy: TimelineItem = {
      id: "neo-legacy",
      pet_id: "adult-pet",
      source: "neonatal",
      kind: "feeding",
      title: "Leite / mamadeira",
      detail: "9 ml",
      occurred_at: "2026-08-20T07:40:00-03:00",
      tone: "rose",
    };
    assert.equal(isNeonatalTimelineItem(legacy), true);
    assert.equal(legacy.source, "neonatal");
    // Adult pet history archives legacy only under neonatal filter.
    const adultMain = [legacy].filter((row) => !isNeonatalTimelineItem(row));
    assert.equal(adultMain.length, 0);
  });

  it("session + legacy are distinct timeline rows (no duplicate merge)", () => {
    const session: TimelineItem = {
      id: "s1",
      pet_id: "p1",
      source: "feeding",
      kind: "feeding",
      title: feedingSessionTimelineTitle(),
      detail: "Ração seca",
      occurred_at: "2026-09-08T12:00:00-03:00",
      tone: "rose",
    };
    const legacy: TimelineItem = {
      id: "n1",
      pet_id: "p1",
      source: "neonatal",
      kind: "feeding",
      title: "Alimentação",
      detail: "10 ml",
      occurred_at: "2026-09-08T12:00:00-03:00",
      tone: "rose",
    };
    const merged = [session, legacy];
    assert.equal(merged.length, 2);
    assert.equal(new Set(merged.map((row) => `${row.source}:${row.id}`)).size, 2);
    assert.equal(merged.filter((row) => row.source === "feeding").length, 1);
    assert.equal(merged.filter((row) => row.source === "neonatal").length, 1);
  });
});

describe("neonatal-stats dual-read + refeições", () => {
  it("merges sessions and legacy feeding rows", () => {
    const legacy: NeonatalRecord[] = [
      {
        id: "l1",
        household_id: "hh",
        pet_id: "p1",
        type: "feeding",
        occurred_at: "2026-09-08T08:00:00-03:00",
        amount_ml: 10,
        feeding_subtype: null,
        feeding_amount_value: null,
        feeding_amount_unit: null,
        weight_grams: null,
        temperature_c: null,
        quality: null,
        notes: null,
        created_at: "2026-09-08T08:00:00-03:00",
      },
    ];
    const sessions: FeedingSessionWithItems[] = [
      {
        id: "s1",
        pet_id: "p1",
        occurred_at: "2026-09-08T12:00:00-03:00",
        notes: null,
        quality: null,
        created_at: "2026-09-08T12:00:00-03:00",
        updated_at: "2026-09-08T12:00:00-03:00",
        feeding_items: [
          {
            id: "i1",
            session_id: "s1",
            subtype: "milk",
            custom_label: null,
            amount_value: 15,
            amount_unit: "ml",
            created_at: "2026-09-08T12:00:00-03:00",
            updated_at: "2026-09-08T12:00:00-03:00",
          },
          {
            id: "i2",
            session_id: "s1",
            subtype: "dry_food",
            custom_label: null,
            amount_value: 25,
            amount_unit: "g",
            created_at: "2026-09-08T12:00:00-03:00",
            updated_at: "2026-09-08T12:00:00-03:00",
          },
        ],
      },
    ];
    const stats = computeNeonatalSummaries(legacy, ["p1"], { from: "2026-09-08", to: "2026-09-08" }, sessions);
    const entry = stats.get("p1")!;
    assert.equal(entry.feedingCount, 2);
    assert.equal(entry.totalMl, 25);
    assert.equal(entry.lastFeedingAt, "2026-09-08T12:00:00-03:00");
    assert.equal(entry.lastFeedingAmountLabel, "15 ml · 25 g");
    assert.match(formatNeonatalDailyStats(entry), /2 refeições/);
  });
});
