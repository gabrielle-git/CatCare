import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-user";
import { ensureHousehold } from "@/lib/households";
import { timed, perfLog } from "@/lib/perf";
import { canEdit, getMyRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { Household, HouseholdRole } from "@/types/database";

export { getAuthUser };

/**
 * Request-scoped authenticated context (React cache).
 * Dedupes user + household + role within ONE RSC or Server Action request only —
 * never across users or requests.
 */
export type AuthenticatedContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  household: Household;
  role: HouseholdRole | null;
  editable: boolean;
};

export const getAuthenticatedContext = cache(async (): Promise<AuthenticatedContext | null> => {
  return timed("getAuthenticatedContext", async () => {
    const supabase = await timed("createServerSupabaseClient", () => createClient());
    const user = await getAuthUser();
    if (!user) {
      perfLog("getAuthenticatedContext", "no-user");
      return null;
    }

    const [household, role] = await Promise.all([
      ensureHousehold(supabase, user.id),
      getMyRole(supabase),
    ]);

    return {
      supabase,
      user,
      household,
      role,
      editable: canEdit(role),
    };
  });
});
