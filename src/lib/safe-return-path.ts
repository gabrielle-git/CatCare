/**
 * Sanitizes post-action return paths so redirects stay inside the app.
 * Accepts internal paths with optional query/hash; rejects open redirects.
 */

function isSafeInternalPath(raw: string): boolean {
  if (!raw.startsWith("/")) return false;
  if (raw.startsWith("//")) return false;
  if (raw.includes("\\")) return false;
  if (raw.includes("..")) return false;

  const lower = raw.toLowerCase();
  if (lower.includes("://")) return false;
  if (lower.startsWith("/http:") || lower.startsWith("/https:")) return false;

  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.includes("..") || decoded.includes("\\")) return false;
    if (decoded.toLowerCase().includes("://")) return false;
    if (decoded.startsWith("//")) return false;
  } catch {
    return false;
  }

  return true;
}

/** Returns the path when it is a safe internal route; otherwise null. */
export function resolveReturnTo(raw: string | null | undefined): string | null {
  const candidate = String(raw ?? "").trim();
  if (!candidate) return null;
  return isSafeInternalPath(candidate) ? candidate : null;
}

/** Returns a safe internal path or the (also sanitized) fallback. Ultimate fallback is `/`. */
export function safeReturnPath(raw: string | null | undefined, fallback: string): string {
  const resolved = resolveReturnTo(raw);
  if (resolved) return resolved;

  const safeFallback = resolveReturnTo(fallback);
  return safeFallback ?? "/";
}

/** Appends or replaces a query param on a path that may already include a query string. */
export function redirectPathWithParam(path: string, key: string, value: string) {
  const safe = safeReturnPath(path, "/");
  const url = new URL(safe, "http://local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}
