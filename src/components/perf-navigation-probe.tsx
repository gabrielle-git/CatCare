"use client";

/**
 * TEMPORARY client diagnostics for PR #19.
 * Console-only: click/submit → pathname change timing.
 */
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type Pending = {
  kind: "nav" | "submit";
  from: string;
  startedAt: number;
};

declare global {
  interface Window {
    __catcarePerfPending?: Pending | null;
  }
}

function log(message: string) {
  console.log(`[CATCARE_CLIENT_PERF] ${message}`);
}

export function PerfNavigationProbe() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor?.href) return;
      try {
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const from = window.location.pathname + window.location.search;
        const to = url.pathname + url.search;
        if (to === from) return;
        window.__catcarePerfPending = { kind: "nav", from, startedAt: performance.now() };
        log(`nav click ${from} -> ${to} (waiting)`);
      } catch {
        /* ignore */
      }
    };

    const onSubmit = () => {
      const from = window.location.pathname + window.location.search;
      window.__catcarePerfPending = { kind: "submit", from, startedAt: performance.now() };
      log(`submit on ${from} (waiting for pathname change)`);
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  useEffect(() => {
    const pending = window.__catcarePerfPending;
    const current = typeof window !== "undefined" ? window.location.pathname + window.location.search : pathname;
    if (!pending) {
      prevPath.current = pathname;
      return;
    }
    if (current === pending.from) {
      prevPath.current = pathname;
      return;
    }
    const ms = Math.round(performance.now() - pending.startedAt);
    if (pending.kind === "nav") {
      log(`navigation ${pending.from} -> ${current} = ${ms}ms`);
    } else {
      log(`submit ${pending.from} -> pathname changed ${current} = ${ms}ms`);
    }
    window.__catcarePerfPending = null;
    prevPath.current = pathname;
  }, [pathname]);

  return null;
}
