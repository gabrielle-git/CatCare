import type { SupabaseClient } from "@supabase/supabase-js";
import type { Household } from "@/types/database";

const BOOTSTRAP_HINT = "Rode o arquivo supabase/migrations/0005_household_bootstrap.sql no SQL Editor do Supabase e recarregue.";

function asHousehold(value: unknown): Household | null {
  if (Array.isArray(value)) return asHousehold(value[0]);
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Household>;
  if (!row.id || !row.name || !row.owner_id || !row.created_at) return null;
  return row as Household;
}

export async function ensureHousehold(supabase: SupabaseClient, userId: string): Promise<Household> {
  const { data: bootstrapped, error: rpcError } = await supabase.rpc("ensure_my_household");
  const fromRpc = asHousehold(bootstrapped);
  if (fromRpc) return fromRpc;

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id, households(id, name, owner_id, created_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  const existing = asHousehold(membership?.households);
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("households")
    .insert({ owner_id: userId, name: "Nossa família" })
    .select("id, name, owner_id, created_at")
    .single();

  if (!error) {
    const inserted = asHousehold(created);
    if (inserted) return inserted;
  }

  const detail = rpcError?.message || error?.message || "new row violates row-level security policy";
  throw new Error(`Não foi possível criar a família (${detail}). ${BOOTSTRAP_HINT}`);
}
