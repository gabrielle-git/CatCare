import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  nextReminderDue,
  recurrenceAnchorDayForSave,
  saoPauloWallClock,
} from "./reminder-recurrence";

const at = (iso: string) => new Date(iso);
const wall = (iso: string) => {
  const clock = saoPauloWallClock(at(iso));
  return `${clock.year}-${String(clock.month).padStart(2, "0")}-${String(clock.day).padStart(2, "0")}T${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`;
};

describe("reminder recurrence calendar", () => {
  it("keeps the scheduled clock and advances one interval when completed early", () => {
    const daily = nextReminderDue(at("2026-10-30T08:00:00-03:00"), "FREQ=DAILY", null, at("2026-10-30T07:00:00-03:00"));
    assert.equal(wall(daily.toISOString()), "2026-10-31T08:00");
    const weekly = nextReminderDue(at("2026-10-26T21:30:00-03:00"), "FREQ=WEEKLY", null, at("2026-10-26T21:00:00-03:00"));
    assert.equal(wall(weekly.toISOString()), "2026-11-02T21:30");
    const monthly = nextReminderDue(at("2026-10-31T09:15:00-03:00"), "FREQ=MONTHLY", 31, at("2026-10-31T09:00:00-03:00"));
    assert.equal(wall(monthly.toISOString()), "2026-11-30T09:15");
  });

  it("jumps an overdue series to the next future slot without filling the gap", () => {
    const daily = nextReminderDue(at("2014-01-01T08:00:00-03:00"), "FREQ=DAILY", null, at("2026-10-30T15:00:00-03:00"));
    assert.equal(wall(daily.toISOString()), "2026-10-31T08:00");
    const weekly = nextReminderDue(at("2014-01-01T08:00:00-03:00"), "FREQ=WEEKLY", null, at("2026-10-30T07:00:00-03:00"));
    assert.equal(weekly.getTime() > at("2026-10-30T07:00:00-03:00").getTime(), true);
    const weeklyClock = saoPauloWallClock(weekly);
    const weeklyDay = new Date(Date.UTC(weeklyClock.year, weeklyClock.month - 1, weeklyClock.day)).getUTCDay();
    const originDay = new Date(Date.UTC(2014, 0, 1)).getUTCDay();
    assert.equal(weeklyDay, originDay);
    assert.equal(weeklyClock.hour, 8);
    const monthly = nextReminderDue(at("2024-01-31T22:40:00-03:00"), "FREQ=MONTHLY", 31, at("2026-10-30T23:00:00-03:00"));
    assert.equal(wall(monthly.toISOString()), "2026-10-31T22:40");
  });

  it("clamps a missing monthly day and returns to the original day", () => {
    const february = nextReminderDue(at("2025-01-31T23:50:00-03:00"), "FREQ=MONTHLY", 31, at("2025-01-31T23:55:00-03:00"));
    assert.equal(wall(february.toISOString()), "2025-02-28T23:50");
    const march = nextReminderDue(february, "FREQ=MONTHLY", 31, at("2025-02-28T23:55:00-03:00"));
    assert.equal(wall(march.toISOString()), "2025-03-31T23:50");
    const leap = nextReminderDue(at("2024-01-31T00:10:00-03:00"), "FREQ=MONTHLY", 31, at("2024-01-31T00:20:00-03:00"));
    assert.equal(wall(leap.toISOString()), "2024-02-29T00:10");
    const afterLeap = nextReminderDue(leap, "FREQ=MONTHLY", 31, at("2024-02-29T00:20:00-03:00"));
    assert.equal(wall(afterLeap.toISOString()), "2024-03-31T00:10");
  });

  it("uses the due day when an old monthly reminder has no stored anchor", () => {
    const next = nextReminderDue(at("2026-01-31T12:00:00-03:00"), "FREQ=MONTHLY", null, at("2026-01-31T12:05:00-03:00"));
    assert.equal(wall(next.toISOString()), "2026-02-28T12:00");
  });

  it("rejects an unknown rule", () => {
    assert.throws(() => nextReminderDue(at("2026-10-30T08:00:00-03:00"), "FREQ=YEARLY", null, at("2026-10-30T09:00:00-03:00")));
  });

  it("keeps a clamped monthly anchor when the displayed day is unchanged", () => {
    assert.equal(recurrenceAnchorDayForSave({
      recurrence: "monthly",
      submittedDue: "2025-02-28T23:50",
      currentDueAt: "2025-02-28T23:50:00-03:00",
      currentRule: "FREQ=MONTHLY",
      currentAnchor: 31,
    }), 31);
    assert.equal(recurrenceAnchorDayForSave({
      recurrence: "monthly",
      submittedDue: "2025-03-15T23:50",
      currentDueAt: "2025-02-28T23:50:00-03:00",
      currentRule: "FREQ=MONTHLY",
      currentAnchor: 31,
    }), 15);
    assert.equal(recurrenceAnchorDayForSave({
      recurrence: "daily",
      submittedDue: "2025-02-28T23:50",
      currentDueAt: "2025-02-28T23:50:00-03:00",
      currentRule: "FREQ=MONTHLY",
      currentAnchor: 31,
    }), null);
  });
});

describe("0040 recurring reminder migration contract", () => {
  const root = process.cwd();
  const sql = readFileSync(join(root, "supabase/migrations/0040_recurring_reminder_completion.sql"), "utf8");
  const actions = readFileSync(join(root, "src/app/(app)/agenda/actions.ts"), "utf8");
  const healthCreate = readFileSync(join(root, "src/app/(app)/records/new/actions.ts"), "utf8");
  const migrations = readdirSync(join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql"));

  it("is the only 0040 file and does not rewrite history or spawn rows", () => {
    assert.deepEqual(migrations.filter((name) => name.startsWith("0040_")), ["0040_recurring_reminder_completion.sql"]);
    assert.match(sql, /add column if not exists series_id uuid/);
    assert.match(sql, /add column if not exists recurrence_anchor_day smallint/);
    assert.match(sql, /recurrence_anchor_day between 1 and 31/);
    assert.match(sql, /set series_id = id/);
    assert.match(sql, /America\/Sao_Paulo/);
    assert.match(sql, /interval '3 hours'/);
    const preamble = sql.slice(0, sql.indexOf("create or replace function public.complete_reminder"));
    assert.doesNotMatch(preamble, /insert into public\.reminders/i);
    assert.doesNotMatch(preamble, /set due_at/i);
    assert.doesNotMatch(preamble, /set status/i);
    assert.doesNotMatch(sql, /delete from public\.reminders/i);
  });

  it("completes and inserts inside one invoker function, with one pending row per series", () => {
    assert.match(sql, /security invoker/);
    assert.match(sql, /for update/);
    assert.match(sql, /reminders_one_open_occurrence_per_series/);
    assert.match(sql, /where status = 'pending' and recurrence_rule is not null/);
    assert.match(sql, /grant execute on function public\.complete_reminder\(uuid\) to authenticated/);
    assert.match(sql, /revoke all on function public\.complete_reminder\(uuid\) from anon/);
    assert.match(sql, /health_record_id/);
    assert.match(sql, /already_done/);
    assert.doesNotMatch(sql, /security definer/i);
  });

  it("wires completion through the database function and leaves health reminders non-recurring", () => {
    assert.match(actions, /rpc\("complete_reminder"/);
    assert.match(actions, /series_id: reminderId/);
    assert.doesNotMatch(actions, /status: "done"/);
    const reminderInsert = healthCreate.slice(healthCreate.indexOf('from("reminders").insert'));
    assert.doesNotMatch(reminderInsert, /recurrence_rule/);
    assert.doesNotMatch(reminderInsert, /complete_reminder/);
  });
});
