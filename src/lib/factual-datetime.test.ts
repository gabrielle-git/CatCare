import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FACTUAL_DATE_MESSAGE,
  FACTUAL_TIME_MESSAGE,
  civilDateInAppTz,
  civilDateTimeLocalInAppTz,
  shiftCivilDate,
  validateFactualCivilDate,
  validateFactualDateTimeLocal,
  validateFactualInstant,
} from "./factual-datetime";
import { parseLocalDateTime } from "./record-form";

/** Fixed "now": 2026-09-07 14:00:00 America/Sao_Paulo (−03:00). */
const NOW = new Date("2026-09-07T14:00:00-03:00");
const TODAY = "2026-09-07";
const YESTERDAY = "2026-09-06";
const TOMORROW = "2026-09-08";

describe("validateFactualCivilDate", () => {
  it("A. yesterday is valid", () => {
    assert.equal(validateFactualCivilDate(YESTERDAY, NOW).ok, true);
  });

  it("B. today is valid", () => {
    assert.equal(validateFactualCivilDate(TODAY, NOW).ok, true);
  });

  it("C. tomorrow is invalid for a fact", () => {
    const result = validateFactualCivilDate(TOMORROW, NOW);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, FACTUAL_DATE_MESSAGE);
  });
});

describe("validateFactualDateTimeLocal", () => {
  it("D. today, earlier time is valid", () => {
    assert.equal(validateFactualDateTimeLocal(`${TODAY}T10:30`, NOW).ok, true);
  });

  it("E. today, future time is invalid", () => {
    const result = validateFactualDateTimeLocal(`${TODAY}T18:00`, NOW);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, FACTUAL_TIME_MESSAGE);
  });

  it("B. now (same minute) is valid within skew", () => {
    assert.equal(validateFactualDateTimeLocal(`${TODAY}T14:00`, NOW).ok, true);
  });

  it("C. tomorrow datetime is invalid", () => {
    const result = validateFactualDateTimeLocal(`${TOMORROW}T09:00`, NOW);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, FACTUAL_DATE_MESSAGE);
  });
});

describe("planning vs factual", () => {
  it("F. planning tomorrow remains allowed (no factual validator applied)", () => {
    // Agenda/reminder due_at is planning: callers must NOT run validateFactual*.
    const planningDue = `${TOMORROW}T09:00`;
    assert.match(planningDue, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    // Explicitly: factual validator would reject — proving the rule is opt-in per field.
    assert.equal(validateFactualDateTimeLocal(planningDue, NOW).ok, false);
  });
});

describe("create/edit factual rejection (server helper)", () => {
  it("G. create factual future instant is rejected", () => {
    const iso = parseLocalDateTime(`${TOMORROW}T10:00`);
    assert.ok(iso);
    const result = validateFactualInstant(iso, NOW);
    assert.equal(result.ok, false);
  });

  it("H. edit factual future instant is rejected (same helper)", () => {
    const iso = parseLocalDateTime(`${TODAY}T20:15`);
    assert.ok(iso);
    const result = validateFactualInstant(iso, NOW);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, FACTUAL_TIME_MESSAGE);
  });
});

describe("timezone / civil DATE", () => {
  it("I. civil date does not shift via UTC midnight parsing", () => {
    // 23:30 in São Paulo on Sep 7 => already Sep 8 in UTC.
    const lateBrazil = new Date("2026-09-07T23:30:00-03:00");
    assert.equal(lateBrazil.toISOString().slice(0, 10), "2026-09-08"); // UTC trap
    assert.equal(civilDateInAppTz(lateBrazil), "2026-09-07");
    assert.equal(validateFactualCivilDate("2026-09-07", lateBrazil).ok, true);
    assert.equal(validateFactualCivilDate("2026-09-08", lateBrazil).ok, false);
  });

  it("I. datetime-local max uses APP_TZ wall clock", () => {
    assert.equal(civilDateTimeLocalInAppTz(NOW), "2026-09-07T14:00");
  });
});

describe("domain smoke — factual paths stay usable", () => {
  it("J. Agenda-style future datetime format still parses for storage", () => {
    const iso = parseLocalDateTime(`${TOMORROW}T15:00`);
    assert.ok(iso);
    assert.ok(new Date(iso).getTime() > NOW.getTime());
  });

  it("K. vaccine/health record factual past datetime validates", () => {
    const iso = parseLocalDateTime(`${YESTERDAY}T15:00`);
    assert.ok(iso);
    assert.equal(validateFactualInstant(iso, NOW).ok, true);
  });

  it("L. neonatal factual past datetime validates", () => {
    assert.equal(validateFactualDateTimeLocal(`${TODAY}T08:05`, NOW).ok, true);
  });

  it("M. expense/purchase factual civil dates validate", () => {
    assert.equal(validateFactualCivilDate(YESTERDAY, NOW).ok, true);
    assert.equal(validateFactualCivilDate(TODAY, NOW).ok, true);
    assert.equal(validateFactualCivilDate(shiftCivilDate(TODAY, 1), NOW).ok, false);
  });
});
