import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  HOME_GREETING_PLACEHOLDER,
  formatHomeLongDate,
  getGreetingForHour,
  getHomeLocalClock,
  msUntilNextHomeBoundary,
} from "@/lib/home-greeting";

describe("getGreetingForHour boundaries", () => {
  it("maps night / morning / afternoon / evening edges", () => {
    assert.equal(getGreetingForHour(0), "Boa noite");
    assert.equal(getGreetingForHour(4), "Boa noite");
    assert.equal(getGreetingForHour(4.99), "Boa noite");
    assert.equal(getGreetingForHour(5), "Bom dia");
    assert.equal(getGreetingForHour(11), "Bom dia");
    assert.equal(getGreetingForHour(11.99), "Bom dia");
    assert.equal(getGreetingForHour(12), "Boa tarde");
    assert.equal(getGreetingForHour(17), "Boa tarde");
    assert.equal(getGreetingForHour(17.99), "Boa tarde");
    assert.equal(getGreetingForHour(18), "Boa noite");
    assert.equal(getGreetingForHour(23), "Boa noite");
    assert.equal(getGreetingForHour(23.99), "Boa noite");
  });

  it("covers required QA boundary table", () => {
    assert.equal(getGreetingForHour(4), "Boa noite"); // 04:59 trunc → 4
    assert.equal(getGreetingForHour(5), "Bom dia");
    assert.equal(getGreetingForHour(11), "Bom dia");
    assert.equal(getGreetingForHour(12), "Boa tarde");
    assert.equal(getGreetingForHour(17), "Boa tarde");
    assert.equal(getGreetingForHour(18), "Boa noite");
    assert.equal(getGreetingForHour(23), "Boa noite");
  });
});

describe("getHomeLocalClock same Date for greeting + date", () => {
  it("derives both fields from one local Date", () => {
    const now = new Date(2026, 8, 14, 23, 15, 0); // local Sep 14 23:15
    const clock = getHomeLocalClock(now);
    assert.equal(clock.greeting, "Boa noite");
    assert.equal(clock.dateLabel, formatHomeLongDate(now));
    assert.match(clock.dateLabel, /setembro/i);
    assert.match(clock.dateLabel, /14/);
  });

  it("formats pt-BR weekday + day + month without year", () => {
    const label = formatHomeLongDate(new Date(2026, 8, 14, 10, 0, 0));
    assert.doesNotMatch(label, /2026/);
    assert.match(label, /setembro/i);
  });

  it("midnight local advances the civil date label", () => {
    const before = getHomeLocalClock(new Date(2026, 8, 14, 23, 59, 0));
    const after = getHomeLocalClock(new Date(2026, 8, 15, 0, 0, 0));
    assert.equal(before.greeting, "Boa noite");
    assert.equal(after.greeting, "Boa noite");
    assert.notEqual(before.dateLabel, after.dateLabel);
    assert.match(after.dateLabel, /15/);
  });
});

describe("msUntilNextHomeBoundary", () => {
  it("schedules the next greeting/date boundary", () => {
    const at1759 = new Date(2026, 8, 14, 17, 59, 0);
    const wait = msUntilNextHomeBoundary(at1759);
    assert.ok(wait > 0 && wait <= 60_000, `expected ~1m, got ${wait}`);

    const at1801 = new Date(2026, 8, 14, 18, 1, 0);
    const untilMidnight = msUntilNextHomeBoundary(at1801);
    // next is local midnight
    assert.ok(untilMidnight > 5 * 60 * 60 * 1000);
  });
});

describe("home greeting wiring (source contracts)", () => {
  const root = process.cwd();
  const page = readFileSync(join(root, "src/app/(app)/page.tsx"), "utf8");
  const component = readFileSync(join(root, "src/components/local-home-greeting.tsx"), "utf8");
  const helper = readFileSync(join(root, "src/lib/home-greeting.ts"), "utf8");

  it("Home uses LocalHomeGreeting instead of server new Date().getHours()", () => {
    assert.match(page, /LocalHomeGreeting/);
    assert.doesNotMatch(page, /function greeting\(/);
    assert.doesNotMatch(page, /formatLongDate\(\)/);
    assert.doesNotMatch(page, /new Date\(\)\.getHours\(\)/);
  });

  it("client clock starts with deterministic placeholder then mounts local Date", () => {
    assert.match(component, /HOME_GREETING_PLACEHOLDER|"Olá"/);
    assert.match(component, /useEffect/);
    assert.match(component, /getHomeLocalClock/);
    assert.match(component, /msUntilNextHomeBoundary/);
    assert.equal(HOME_GREETING_PLACEHOLDER, "Olá");
  });

  it("does not hardcode America/Sao_Paulo for home greeting", () => {
    assert.doesNotMatch(helper, /America\/Sao_Paulo/);
    assert.doesNotMatch(component, /America\/Sao_Paulo/);
    assert.doesNotMatch(page, /America\/Sao_Paulo/);
  });
});
