import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-user";
import { createClient } from "@/lib/supabase/server";
import type { HouseholdRole } from "@/types/database";

export type HouseholdMemberRow = {
  user_id: string;
  display_name: string;
  profile_name: string;
  private_alias: string | null;
  role: HouseholdRole;
  joined_at: string;
};

const roleLabels: Record<HouseholdRole, string> = {
  owner: "Dono",
  caregiver: "Cuidador",
  viewer: "Visitante (só leitura)",
};

export function roleLabel(role: HouseholdRole) {
  return roleLabels[role];
}

export function canEdit(role: HouseholdRole | null) {
  return role === "owner" || role === "caregiver";
}

export function isOwner(role: HouseholdRole | null) {
  return role === "owner";
}

/** One role lookup per request — avoids repeated my_household_role RPCs in layout + page + actions. */
const loadMyRole = cache(async (): Promise<HouseholdRole | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const client = await createClient();
  const { data, error } = await client.rpc("my_household_role");
  // Fail closed: never escalate to owner on RPC/network failure.
  if (error || !data) return null;
  return data as HouseholdRole;
});

export async function getMyRole(_supabase?: SupabaseClient): Promise<HouseholdRole | null> {
  return loadMyRole();
}

export async function listHouseholdRoster(supabase?: SupabaseClient): Promise<HouseholdMemberRow[]> {
  const client = supabase ?? await createClient();
  const { data, error } = await client.rpc("household_roster");
  if (error) throw error;
  return (data ?? []) as HouseholdMemberRow[];
}

export async function assertCanEdit(supabase?: SupabaseClient) {
  const role = await getMyRole(supabase);
  if (!canEdit(role)) throw new Error("Visitantes só podem visualizar.");
}

export async function assertOwner(supabase?: SupabaseClient) {
  const role = await getMyRole(supabase);
  if (!isOwner(role)) throw new Error("Apenas o dono pode fazer isso.");
}

export async function requireEditPage(redirectTo = "/") {
  const supabase = await createClient();
  const role = await getMyRole(supabase);
  if (!canEdit(role)) {
    const { redirect } = await import("next/navigation");
    redirect(`${redirectTo}?error=${encodeURIComponent("Visitantes só podem visualizar.")}`);
  }
  return supabase;
}
