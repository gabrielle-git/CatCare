import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";
import {
  FAMILY_HISTORY_TYPE_OPTIONS,
  filterFamilyHistoryItems,
  timelineItemMatchesQuery,
} from "./family-history";
import {
  HYGIENE_PRESETS,
  HYGIENE_SUBTYPE_KEYS,
  buildHygieneFields,
  buildHygieneFieldsList,
  countHygieneAwareCreateRecords,
  hygieneDisplayLabel,
  hygieneRecordTitle,
  hygieneSearchExtrasFromDisplayTitle,
} from "./hygiene-care";
import { validateCreateRecordForm } from "./record-form-validation";
import { recordKindFromHealth, resolvePostCreateDestination, resolveRecordSource } from "./record-form";
import { routinePresets } from "./routine-presets";
import { validateFactualDateTimeLocal } from "./factual-datetime";
import type { TimelineItem } from "@/types/database";

function hygieneItem(
  partial: Partial<TimelineItem> & Pick<TimelineItem, "id" | "pet_id" | "title" | "occurred_at">,
): TimelineItem {
  return {
    source: "health",
    kind: "hygiene",
    detail: partial.detail ?? null,
    tone: "mint",
    ...partial,
  };
}

describe("hygiene care catalog + fields", () => {
  it("A–J: presets build valid fields and titles", () => {
    const cases: Array<{ key: (typeof HYGIENE_SUBTYPE_KEYS)[number]; label: string; custom?: string }> = [
      { key: "bath", label: "Banho" },
      { key: "dry_bath", label: "Banho a seco" },
      { key: "coat_brushing", label: "Escovação da pelagem" },
      { key: "grooming", label: "Tosa" },
      { key: "hygienic_grooming", label: "Tosa higiênica" },
      { key: "nail_trim", label: "Corte de unhas" },
      { key: "ear_cleaning", label: "Limpeza das orelhas" },
      { key: "dental_hygiene", label: "Higiene dental" },
      { key: "eye_cleaning", label: "Limpeza dos olhos" },
      { key: "other", label: "Limpeza das patinhas", custom: "Limpeza das patinhas" },
    ];

    for (const entry of cases) {
      const built = buildHygieneFields(entry.key, entry.custom ?? null);
      assert.equal(built.ok, true);
      if (!built.ok) continue;
      assert.equal(built.fields.hygiene_subtype, entry.key);
      assert.equal(built.fields.hygiene_custom_label, entry.key === "other" ? entry.custom : null);
      assert.equal(hygieneRecordTitle(built.fields.hygiene_subtype, built.fields.hygiene_custom_label), entry.label);
      assert.equal(hygieneDisplayLabel(entry.key, entry.custom ?? null), entry.label);
    }

    assert.equal(HYGIENE_PRESETS.length, 10);
    assert.deepEqual(
      HYGIENE_PRESETS.map((p) => p.key),
      [...HYGIENE_SUBTYPE_KEYS],
    );
  });

  it("K: other without custom is rejected", () => {
    const built = buildHygieneFields("other", "  ");
    assert.equal(built.ok, false);
    if (built.ok) return;
    assert.match(built.message, /cuidado/i);
  });

  it("L: non-other never keeps custom label", () => {
    const built = buildHygieneFields("bath", "Limpeza das patinhas");
    assert.equal(built.ok, true);
    if (!built.ok) return;
    assert.equal(built.fields.hygiene_custom_label, null);
  });

  it("M: multi-pet × multi-care expands to pets × cares rows", () => {
    const built = buildHygieneFieldsList(["bath", "coat_brushing", "ear_cleaning"], null);
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const petIds = ["gwen", "hinata"];
    const notes = "sessão da manhã";
    const rows = petIds.flatMap((pet_id) =>
      built.items.map((fields) => ({
        pet_id,
        type: "hygiene" as const,
        notes,
        ...fields,
        title: hygieneRecordTitle(fields.hygiene_subtype, fields.hygiene_custom_label),
      })),
    );
    assert.equal(rows.length, 6);
    assert.equal(countHygieneAwareCreateRecords(["hygiene"], 2, 3), 6);
    assert.equal(countHygieneAwareCreateRecords(["hygiene"], 1, 3), 3);
    assert.equal(countHygieneAwareCreateRecords(["hygiene"], 1, 1), 1);
    assert.ok(rows.every((row) => row.notes === notes));
    assert.deepEqual(
      rows.filter((row) => row.pet_id === "gwen").map((row) => row.hygiene_subtype),
      ["bath", "coat_brushing", "ear_cleaning"],
    );
  });

  it("E/F: Other + preset; Other without custom rejected", () => {
    const ok = buildHygieneFieldsList(["bath", "other"], "Limpeza das patinhas");
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.items.length, 2);
      assert.equal(ok.items[0].hygiene_custom_label, null);
      assert.equal(ok.items[1].hygiene_custom_label, "Limpeza das patinhas");
    }
    const bad = buildHygieneFieldsList(["bath", "other"], "  ");
    assert.equal(bad.ok, false);
  });

  it("G/H: edit/delete remain per single factual row", () => {
    const create = readFileSync(join(process.cwd(), "src/app/(app)/records/new/actions.ts"), "utf8");
    const update = readFileSync(join(process.cwd(), "src/app/(app)/records/actions.ts"), "utf8");
    assert.match(create, /buildHygieneFieldsList/);
    assert.match(update, /buildHygieneFields\(/);
    assert.match(update, /export async function deleteRecord/);
    assert.doesNotMatch(update, /buildHygieneFieldsList/);
  });

  it("I–K: multi-pet redirect to /historico; returnTo and single-pet preserved", () => {
    assert.equal(
      resolvePostCreateDestination({ returnTo: null, petIds: ["a", "b"] }),
      "/historico",
    );
    assert.equal(
      resolvePostCreateDestination({ returnTo: "/neonatal", petIds: ["a", "b"] }),
      "/neonatal",
    );
    assert.equal(
      resolvePostCreateDestination({ returnTo: null, petIds: ["only"] }),
      "/pets/only",
    );
    assert.equal(
      resolvePostCreateDestination({ returnTo: "/agenda", petIds: ["only"] }),
      "/agenda",
    );
  });

  it("N–P: edit subtype transitions reconcile custom label", () => {
    const bathToNail = buildHygieneFields("nail_trim", null);
    assert.equal(bathToNail.ok, true);
    if (bathToNail.ok) assert.equal(bathToNail.fields.hygiene_custom_label, null);

    const bathToOther = buildHygieneFields("other", "Limpeza das patinhas");
    assert.equal(bathToOther.ok, true);
    if (bathToOther.ok) {
      assert.equal(bathToOther.fields.hygiene_subtype, "other");
      assert.equal(bathToOther.fields.hygiene_custom_label, "Limpeza das patinhas");
    }

    const otherToBath = buildHygieneFields("bath", "stale custom");
    assert.equal(otherToBath.ok, true);
    if (otherToBath.ok) {
      assert.equal(otherToBath.fields.hygiene_subtype, "bath");
      assert.equal(otherToBath.fields.hygiene_custom_label, null);
    }
  });

  it("Q: delete lifecycle stays on health_records (no hygiene-specific table)", () => {
    const actions = readFileSync(join(process.cwd(), "src/app/(app)/records/actions.ts"), "utf8");
    assert.match(actions, /export async function deleteRecord/);
    assert.match(actions, /health_records/);
    assert.doesNotMatch(actions, /hygiene_records/);
  });

  it("R: factual future datetime blocked (shared helper)", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const d = String(tomorrow.getDate()).padStart(2, "0");
    const result = validateFactualDateTimeLocal(`${y}-${m}-${d}T12:00`);
    assert.equal(result.ok, false);
  });

  it("S/T: timeline display uses preset or custom label", () => {
    assert.equal(hygieneDisplayLabel("bath", null), "Banho");
    assert.equal(hygieneDisplayLabel("other", "Limpeza das patinhas"), "Limpeza das patinhas");
  });

  it("U/V: histórico filter Higiene (family + kind match)", () => {
    assert.ok(FAMILY_HISTORY_TYPE_OPTIONS.some((option) => option.value === "hygiene" && option.label === "Higiene"));
    const items: TimelineItem[] = [
      hygieneItem({
        id: "h1",
        pet_id: "p1",
        title: "Banho",
        occurred_at: "2026-09-07T14:30:00-03:00",
      }),
      {
        id: "v1",
        pet_id: "p1",
        source: "health",
        kind: "vaccine",
        title: "Vacina",
        detail: null,
        tone: "mint",
        occurred_at: "2026-09-07T10:00:00-03:00",
      },
    ];
    const filtered = filterFamilyHistoryItems(items, { q: "", from: null, to: null, type: "hygiene" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].title, "Banho");
  });

  it("W–Z: busca banho / unha / custom / notes", () => {
    const names = { p1: "Gwen", p2: "Hinata", p3: "Dobby" };
    const bath = hygieneItem({
      id: "b",
      pet_id: "p1",
      title: "Banho",
      detail: "usou shampoo suave",
      occurred_at: "2026-09-07T14:30:00-03:00",
    });
    const nails = hygieneItem({
      id: "n",
      pet_id: "p2",
      title: "Corte de unhas",
      occurred_at: "2026-09-06T10:00:00-03:00",
    });
    const custom = hygieneItem({
      id: "c",
      pet_id: "p3",
      title: "Limpeza das patinhas",
      occurred_at: "2026-09-05T09:00:00-03:00",
    });

    assert.equal(timelineItemMatchesQuery(bath, "banho", names), true);
    assert.equal(timelineItemMatchesQuery(bath, "banho a seco", names), false);
    assert.equal(timelineItemMatchesQuery(nails, "unha", names), true);
    assert.equal(timelineItemMatchesQuery(custom, "patinhas", names), true);
    assert.equal(timelineItemMatchesQuery(bath, "shampoo", names), true);
    assert.equal(timelineItemMatchesQuery(bath, "Gwen", names), true);

    const dry = hygieneItem({
      id: "d",
      pet_id: "p1",
      title: "Banho a seco",
      occurred_at: "2026-09-04T09:00:00-03:00",
    });
    assert.equal(timelineItemMatchesQuery(dry, "banho seco", names), true);
    assert.match(hygieneSearchExtrasFromDisplayTitle("Banho a seco"), /banho seco/i);
  });

  it("AA: other health kinds still resolve", () => {
    assert.equal(recordKindFromHealth("vaccine"), "vaccine");
    assert.equal(recordKindFromHealth("other"), "observation");
    assert.equal(recordKindFromHealth("hygiene"), "hygiene");
    assert.equal(resolveRecordSource("hygiene"), "health");
    assert.equal(resolveRecordSource("vaccine"), "health");
  });

  it("AB: feeding resolves to feeding source; urine stays neonatal", () => {
    assert.equal(resolveRecordSource("feeding"), "feeding");
    assert.equal(resolveRecordSource("urine"), "neonatal");
  });

  it("AC: rotinas alinhadas ao catálogo (aditivo)", () => {
    const titles = routinePresets.map((preset) => preset.title);
    for (const label of ["Banho", "Banho a seco", "Tosa", "Tosa higiênica", "Corte de unhas", "Higiene dental", "Escovação da pelagem", "Limpeza dos olhos", "Limpeza das orelhas"]) {
      assert.ok(titles.includes(label), `missing routine preset ${label}`);
    }
  });

  it("AD: agenda preserva category hygiene", () => {
    const agendaActions = readFileSync(join(process.cwd(), "src/app/(app)/agenda/actions.ts"), "utf8");
    assert.match(agendaActions, /"hygiene"/);
  });

  it("create form validation wires hygiene", () => {
    const petNames = new Map([["p1", "Gwen"]]);
    assert.equal(
      validateCreateRecordForm({
        petIds: ["p1"],
        types: ["hygiene"],
        weightKg: "",
        weightKgByPetId: {},
        feedingSubtype: "",
        feedingAmountValue: "",
        feedingUnitPreset: "ml",
        feedingUnitOther: "",
        temperatureC: "",
        hygieneSubtype: "",
        hygieneSubtypes: [],
        hygieneCustomLabel: "",
        petNames,
      }),
      "Escolha ao menos um cuidado de higiene.",
    );
    assert.equal(
      validateCreateRecordForm({
        petIds: ["p1"],
        types: ["hygiene"],
        weightKg: "",
        weightKgByPetId: {},
        feedingSubtype: "",
        feedingAmountValue: "",
        feedingUnitPreset: "ml",
        feedingUnitOther: "",
        temperatureC: "",
        hygieneSubtype: "other",
        hygieneSubtypes: ["other"],
        hygieneCustomLabel: "",
        petNames,
      }),
      "Informe qual outro cuidado você fez.",
    );
    assert.equal(
      validateCreateRecordForm({
        petIds: ["p1"],
        types: ["hygiene"],
        weightKg: "",
        weightKgByPetId: {},
        feedingSubtype: "",
        feedingAmountValue: "",
        feedingUnitPreset: "ml",
        feedingUnitOther: "",
        temperatureC: "",
        hygieneSubtype: "bath",
        hygieneSubtypes: ["bath", "ear_cleaning"],
        hygieneCustomLabel: "",
        petNames,
      }),
      null,
    );
  });

  it("clinic_or_vet is not used on hygiene create/update paths", () => {
    const create = readFileSync(join(process.cwd(), "src/app/(app)/records/new/actions.ts"), "utf8");
    const update = readFileSync(join(process.cwd(), "src/app/(app)/records/actions.ts"), "utf8");
    assert.match(create, /clinic_or_vet: null/);
    assert.match(update, /type === "hygiene" \? null/);
  });
});
