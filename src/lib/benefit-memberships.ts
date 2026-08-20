import type { SupabaseClient } from "@supabase/supabase-js";
import type { BenefitMembership, BenefitMembershipKind } from "@/types/database";

export const BENEFIT_MEMBERSHIP_KINDS: BenefitMembershipKind[] = ["petlove_club", "other"];

export const BENEFIT_MEMBERSHIP_LABELS: Record<BenefitMembershipKind, string> = {
  petlove_club: "Clube Petlove",
  petz_club: "Clube Petz",
  other: "Outro clube",
};

export const BENEFIT_MEMBERSHIP_HINTS: Partial<Record<BenefitMembershipKind, string>> = {
  petlove_club: "Descontos em produtos e frete na Petlove.",
  other: "Ex.: Clube Petz, assinatura de areia, cashback de loja…",
};

export function membershipLabel(membership: Pick<BenefitMembership, "kind" | "custom_name">) {
  if (membership.kind === "other" && membership.custom_name) return membership.custom_name;
  return BENEFIT_MEMBERSHIP_LABELS[membership.kind];
}

export async function listBenefitMemberships(supabase: SupabaseClient, householdId: string): Promise<BenefitMembership[]> {
  const { data, error } = await supabase
    .from("benefit_memberships")
    .select("*")
    .eq("household_id", householdId)
    .order("kind", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BenefitMembership[];
}

export async function getBenefitMembershipByKind(
  supabase: SupabaseClient,
  householdId: string,
  kind: BenefitMembershipKind,
): Promise<BenefitMembership | null> {
  const { data, error } = await supabase
    .from("benefit_memberships")
    .select("*")
    .eq("household_id", householdId)
    .eq("kind", kind)
    .maybeSingle();
  if (error) throw error;
  return data as BenefitMembership | null;
}

export function splitMemberships(existing: BenefitMembership[]) {
  return {
    petlove: existing.find((item) => item.kind === "petlove_club") ?? null,
    others: existing.filter((item) => item.kind === "other"),
  };
}

export async function listActiveMembershipsForShopping(supabase: SupabaseClient, householdId: string) {
  const all = await listBenefitMemberships(supabase, householdId);
  return all.filter((item) => item.active);
}
