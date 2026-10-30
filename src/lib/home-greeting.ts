/**
 * Home greeting/date helpers — hour/date come from the browser's local Date.
 * Do not hardcode a country-specific IANA zone here.
 */

export type HomeGreeting = "Bom dia" | "Boa tarde" | "Boa noite";

/** Neutral SSR/pre-hydration label (same on server and first client paint). */
export const HOME_GREETING_PLACEHOLDER = "Olá";

/**
 * Pure greeting from a local wall-clock hour (0–23).
 * 05–11 Bom dia · 12–17 Boa tarde · 18–04 Boa noite.
 */
export function getGreetingForHour(hour: number): HomeGreeting {
  if (!Number.isFinite(hour)) return "Boa noite";
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Long weekday+date in pt-BR using the Date's local calendar (no forced TZ). */
export function formatHomeLongDate(value: Date): string {
  const text = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type HomeLocalClock = {
  greeting: HomeGreeting;
  dateLabel: string;
};

/** Greeting + date from one local Date instance. */
export function getHomeLocalClock(now: Date): HomeLocalClock {
  return {
    greeting: getGreetingForHour(now.getHours()),
    dateLabel: formatHomeLongDate(now),
  };
}

/**
 * Milliseconds until the next local greeting/date boundary:
 * 05:00, 12:00, 18:00, or local midnight.
 */
export function msUntilNextHomeBoundary(now: Date): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const candidates = [
    new Date(y, m, d, 5, 0, 0, 0),
    new Date(y, m, d, 12, 0, 0, 0),
    new Date(y, m, d, 18, 0, 0, 0),
    new Date(y, m, d + 1, 0, 0, 0, 0),
  ];
  const t = now.getTime();
  for (const boundary of candidates) {
    const delta = boundary.getTime() - t;
    if (delta > 0) return delta;
  }
  return 60_000;
}
