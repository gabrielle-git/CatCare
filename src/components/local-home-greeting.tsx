"use client";

import { useEffect, useState } from "react";
import {
  HOME_GREETING_PLACEHOLDER,
  getHomeLocalClock,
  msUntilNextHomeBoundary,
  type HomeGreeting,
} from "@/lib/home-greeting";

type LocalState =
  | { ready: false; greeting: typeof HOME_GREETING_PLACEHOLDER; dateLabel: string }
  | { ready: true; greeting: HomeGreeting; dateLabel: string };

const INITIAL: LocalState = {
  ready: false,
  greeting: HOME_GREETING_PLACEHOLDER,
  dateLabel: "",
};

/**
 * Home header clock: browser-local greeting + date from the same Date.
 * SSR and first paint stay on a deterministic placeholder to avoid hydration mismatch.
 */
export function LocalHomeGreeting() {
  const [clock, setClock] = useState<LocalState>(INITIAL);

  useEffect(() => {
    let timeoutId = 0;

    function tick() {
      const now = new Date();
      const next = getHomeLocalClock(now);
      setClock({ ready: true, greeting: next.greeting, dateLabel: next.dateLabel });
      const wait = Math.min(Math.max(msUntilNextHomeBoundary(now), 1_000), 60_000);
      timeoutId = window.setTimeout(tick, wait);
    }

    tick();
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="min-w-0">
      <p
        className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]"
        aria-live="polite"
        suppressHydrationWarning
      >
        {clock.dateLabel || "\u00a0"}
      </p>
      <h1
        className="mt-2 text-[1.65rem] font-bold leading-tight tracking-[-0.04em] sm:text-3xl md:text-4xl"
        aria-live="polite"
        suppressHydrationWarning
      >
        {clock.greeting}, família.
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">O que precisa de você agora — e o que aconteceu por aqui.</p>
    </div>
  );
}
