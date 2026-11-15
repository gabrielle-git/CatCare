import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { groupAgendaReminders } from "./agenda-grouping";

type SampleReminder = {
  id: string;
  due_at: string;
};

function ids(items: readonly SampleReminder[]) {
  return items.map((item) => item.id);
}

describe("groupAgendaReminders (APP_TIMEZONE)", () => {
  it("classifies late, today, tomorrow and later around BRT midnight (21:00-23:59 BRT vs 00:00-00:59 BRT)", () => {
    // now = 2026-11-15T15:00:00-03:00 (2026-11-15T18:00:00Z)
    const now = new Date("2026-11-15T15:00:00-03:00");
    const reminders: SampleReminder[] = [
      { id: "late-1ms", due_at: "2026-11-15T14:59:59.999-03:00" },
      { id: "today-exact-now", due_at: "2026-11-15T15:00:00.000-03:00" },
      { id: "today-after-utc-midnight", due_at: "2026-11-15T21:00:00-03:00" }, // 2026-11-16T00:00:00Z
      { id: "today-end-of-day", due_at: "2026-11-15T23:59:59-03:00" }, // 2026-11-16T02:59:59Z
      { id: "tomorrow-start", due_at: "2026-11-16T00:00:00-03:00" }, // 2026-11-16T03:00:00Z
      { id: "tomorrow-late-night", due_at: "2026-11-16T23:59:59-03:00" }, // 2026-11-17T02:59:59Z
      { id: "later-start", due_at: "2026-11-17T00:00:00-03:00" }, // 2026-11-17T03:00:00Z
    ];

    const grouped = groupAgendaReminders(reminders, now);
    assert.deepEqual(ids(grouped.late), ["late-1ms"]);
    assert.deepEqual(ids(grouped.todayItems), [
      "today-exact-now",
      "today-after-utc-midnight",
      "today-end-of-day",
    ]);
    assert.deepEqual(ids(grouped.tomorrowItems), [
      "tomorrow-start",
      "tomorrow-late-night",
    ]);
    assert.deepEqual(ids(grouped.later), ["later-start"]);
  });

  it("keeps BRT calendar day when now is between 21:00 and 23:59 BRT (already next day in UTC)", () => {
    // now = 2026-11-15T22:30:00-03:00 (2026-11-16T01:30:00Z)
    const now = new Date("2026-11-15T22:30:00-03:00");
    const reminders: SampleReminder[] = [
      { id: "late-same-evening", due_at: "2026-11-15T22:00:00-03:00" },
      { id: "today-2350", due_at: "2026-11-15T23:50:00-03:00" },
      { id: "tomorrow-0005", due_at: "2026-11-16T00:05:00-03:00" },
      { id: "tomorrow-0800", due_at: "2026-11-16T08:00:00-03:00" },
      { id: "tomorrow-2330", due_at: "2026-11-16T23:30:00-03:00" },
      { id: "later-0001", due_at: "2026-11-17T00:01:00-03:00" },
    ];

    const grouped = groupAgendaReminders(reminders, now);
    assert.deepEqual(ids(grouped.late), ["late-same-evening"]);
    assert.deepEqual(ids(grouped.todayItems), ["today-2350"]);
    assert.deepEqual(ids(grouped.tomorrowItems), [
      "tomorrow-0005",
      "tomorrow-0800",
      "tomorrow-2330",
    ]);
    assert.deepEqual(ids(grouped.later), ["later-0001"]);
  });

  it("handles month-end, leap-year February and New Year transitions in APP_TIMEZONE", () => {
    // New Year's Eve at 23:45 BRT (already Jan 1 02:45 UTC)
    const newYearEveNow = new Date("2026-12-31T23:45:00-03:00");
    const newYearReminders: SampleReminder[] = [
      { id: "nye-late", due_at: "2026-12-31T23:00:00-03:00" },
      { id: "nye-today", due_at: "2026-12-31T23:59:00-03:00" },
      { id: "nyd-tomorrow-early", due_at: "2027-01-01T00:01:00-03:00" },
      { id: "nyd-tomorrow-late", due_at: "2027-01-01T23:55:00-03:00" },
      { id: "jan2-later", due_at: "2027-01-02T00:00:00-03:00" },
    ];

    const nyGrouped = groupAgendaReminders(newYearReminders, newYearEveNow);
    assert.deepEqual(ids(nyGrouped.late), ["nye-late"]);
    assert.deepEqual(ids(nyGrouped.todayItems), ["nye-today"]);
    assert.deepEqual(ids(nyGrouped.tomorrowItems), ["nyd-tomorrow-early", "nyd-tomorrow-late"]);
    assert.deepEqual(ids(nyGrouped.later), ["jan2-later"]);

    // Leap year Feb 28 -> Feb 29 -> Mar 1
    const leapFeb28Now = new Date("2028-02-28T22:00:00-03:00");
    const leapReminders: SampleReminder[] = [
      { id: "feb28-today", due_at: "2028-02-28T23:30:00-03:00" },
      { id: "feb29-tomorrow", due_at: "2028-02-29T08:00:00-03:00" },
      { id: "mar01-later", due_at: "2028-03-01T08:00:00-03:00" },
    ];

    const leapGrouped = groupAgendaReminders(leapReminders, leapFeb28Now);
    assert.deepEqual(ids(leapGrouped.todayItems), ["feb28-today"]);
    assert.deepEqual(ids(leapGrouped.tomorrowItems), ["feb29-tomorrow"]);
    assert.deepEqual(ids(leapGrouped.later), ["mar01-later"]);
  });

  it("is completely independent of the server/process timezone (TZ=UTC vs TZ=Asia/Tokyo vs TZ=America/Sao_Paulo)", () => {
    const script = `
      import { groupAgendaReminders } from "./src/lib/agenda-grouping";
      const now = new Date("2026-11-15T22:15:00-03:00").getTime();
      const reminders = [
        { id: "late", due_at: "2026-11-15T21:30:00-03:00" },
        { id: "today", due_at: "2026-11-15T23:45:00-03:00" },
        { id: "tomorrow", due_at: "2026-11-16T00:30:00-03:00" },
        { id: "tomorrow-night", due_at: "2026-11-16T22:30:00-03:00" },
        { id: "later", due_at: "2026-11-17T00:10:00-03:00" },
      ];
      const g = groupAgendaReminders(reminders, now);
      console.log(JSON.stringify({
        late: g.late.map((x) => x.id),
        today: g.todayItems.map((x) => x.id),
        tomorrow: g.tomorrowItems.map((x) => x.id),
        later: g.later.map((x) => x.id),
      }));
    `;

    const expected = {
      late: ["late"],
      today: ["today"],
      tomorrow: ["tomorrow", "tomorrow-night"],
      later: ["later"],
    };

    for (const tz of ["UTC", "America/Sao_Paulo", "Asia/Tokyo", "America/Los_Angeles"]) {
      const res = spawnSync(process.execPath, ["--import", "tsx", "--eval", script], {
        cwd: join(__dirname, "..", ".."),
        env: { ...process.env, TZ: tz },
        encoding: "utf8",
      });
      assert.equal(res.status, 0, `subprocess failed for TZ=${tz}: ${res.stderr}`);
      assert.deepEqual(JSON.parse(res.stdout.trim()), expected, `mismatch for TZ=${tz}`);
    }
  });

  it("ensures agenda/page.tsx delegates grouping to groupAgendaReminders without local setHours/setDate", () => {
    const pageSource = readFileSync(join(__dirname, "..", "app", "(app)", "agenda", "page.tsx"), "utf8");
    assert.match(pageSource, /groupAgendaReminders\(reminders,\s*now\)/);
    assert.doesNotMatch(pageSource, /\.setHours\(|\.setDate\(/);
  });
});
