import type { SupabaseClient } from "@supabase/supabase-js";
import type { HouseholdRole } from "@/types/database";

export type MyHouseholdRow = {
  household_id: string;
  name: string;
  role: HouseholdRole;
  is_active: boolean;
};

export async function listMyHouseholds(supabase: SupabaseClient): Promise<MyHouseholdRow[]> {
  const { data, error } = await supabase.rpc("list_my_households");
  if (error) throw error;
  return (data ?? []) as MyHouseholdRow[];
}

export async function setActiveHousehold(supabase: SupabaseClient, householdId: string) {
  const { error } = await supabase.rpc("set_active_household", { target_household_id: householdId });
  if (error) throw new Error(error.message);
}
