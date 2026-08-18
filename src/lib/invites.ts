import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { HouseholdRole } from "@/types/database";

export type PendingInvite = {
  id: string;
  email: string;
  role: HouseholdRole;
  expires_at: string;
  created_at: string;
};

export async function listPendingInvites(supabase?: SupabaseClient): Promise<PendingInvite[]> {
  const client = supabase ?? await createClient();
  const { data, error } = await client.rpc("list_household_invites");
  if (error) throw error;
  return (data ?? []) as PendingInvite[];
}

export async function acceptInvite(token: string, supabase?: SupabaseClient): Promise<string> {
  const client = supabase ?? await createClient();
  const { data, error } = await client.rpc("accept_household_invite", { invite_token: token });
  if (error) throw new Error(error.message);
  return data as string;
}

export function invitePath(token: string) {
  return `/invite/${token}`;
}

export function isSafeNextPath(path: string | null | undefined) {
  return Boolean(path && path.startsWith("/invite/") && !path.includes(".."));
}
