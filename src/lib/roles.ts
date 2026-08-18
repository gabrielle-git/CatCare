import type { SupabaseClient } from "@supabase/supabase-js";
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

export async function getMyRole(supabase?: SupabaseClient): Promise<HouseholdRole | null> {
  const client = supabase ?? await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await client.rpc("my_household_role");
  if (error || !data) return "owner";
  return data as HouseholdRole;
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

export async function requireEditPage(redirectTo = "/") {
  const supabase = await createClient();
  const role = await getMyRole(supabase);
  if (!canEdit(role)) {
    const { redirect } = await import("next/navigation");
    redirect(`${redirectTo}?error=${encodeURIComponent("Visitantes só podem visualizar.")}`);
  }
  return supabase;
}
