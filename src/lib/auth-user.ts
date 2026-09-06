import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { timed } from "@/lib/perf";
import { createClient } from "@/lib/supabase/server";

/** Request-scoped getUser — one Auth round-trip per RSC/Server Action request. */
export const getAuthUser = cache(async (): Promise<User | null> => {
  return timed("auth.getUser", async () => {
    const supabase = await timed("createServerSupabaseClient", () => createClient());
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  });
});
