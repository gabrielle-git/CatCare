/**
 * TEMPORARY diagnostics for PR #19 — remove after root-cause is proven.
 * Logs only durations/labels; never tokens, cookies, emails, or clinical content.
 */
import { cache } from "react";

export const getPerfTraceId = cache(() => {
  const rand = Math.random().toString(36).slice(2, 8);
  return rand;
});

export function perfLog(label: string, detail?: string) {
  const trace = getPerfTraceId();
  console.log(`[CATCARE_PERF][trace ${trace}][${label}]${detail ? ` ${detail}` : ""}`);
}

export async function timed<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
  const trace = getPerfTraceId();
  const start = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - start);
    console.log(`[CATCARE_PERF][trace ${trace}][${label}] ${ms}ms`);
    return result;
  } catch (error) {
    const ms = Math.round(performance.now() - start);
    console.log(`[CATCARE_PERF][trace ${trace}][${label}] FAIL ${ms}ms`);
    throw error;
  }
}

/** Sync mark for revalidatePath / redirect prep (not awaited work). */
export function timedSync(label: string, fn: () => void) {
  const trace = getPerfTraceId();
  const start = performance.now();
  fn();
  const ms = Math.round(performance.now() - start);
  console.log(`[CATCARE_PERF][trace ${trace}][${label}] ${ms}ms`);
}
