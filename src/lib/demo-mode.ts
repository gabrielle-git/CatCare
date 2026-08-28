import { cookies } from "next/headers";
import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Cookie that unlocks browsing with mock data without login (even when Supabase is configured). */
export const DEMO_COOKIE = "catcare_demo";

/** Cookie that holds a one-shot invite URL when e-mail send fails (never put token in the URL). */
export const INVITE_MANUAL_COOKIE = "catcare_invite_manual";

export function demoCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}

/**
 * Live app (real Supabase data) vs demonstração (mock-data).
 * Logged-in users always use live data — demo cookie is only for guests.
 */
export const isLiveData = cache(async () => {
  if (!hasSupabaseEnv()) return false;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) return true;

  const jar = await cookies();
  return jar.get(DEMO_COOKIE)?.value !== "1";
});

export async function isDemoMode() {
  return !(await isLiveData());
}
