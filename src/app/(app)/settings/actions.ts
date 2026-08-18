"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setActiveHousehold } from "@/lib/household-switch";
import { getMyRole, isOwner } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateDisplayName(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) redirect("/settings?error=Nome%20obrigat%C3%B3rio.");
  if (displayName.length > 60) redirect("/settings?error=Nome%20muito%20longo.");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { error } = await supabase.from("profiles").update({ display_name: displayName, updated_at: new Date().toISOString() }).eq("id", data.user.id);
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/settings");
  revalidatePath("/settings/members");
  redirect("/settings?saved=1");
}

export async function switchHousehold(householdId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  try {
    await setActiveHousehold(supabase, householdId);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Não foi possível trocar de família.";
    redirect(`/settings?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/settings/members");
  revalidatePath("/pets");
  redirect("/settings?switched=1");
}

async function activateHousehold(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string) {
  try {
    await setActiveHousehold(supabase, householdId);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Não foi possível usar esta família.";
    redirect(`/settings?error=${encodeURIComponent(message)}`);
  }
}

export async function leaveHousehold(householdId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  await activateHousehold(supabase, householdId);
  const role = await getMyRole(supabase);
  if (isOwner(role)) {
    redirect("/settings?error=" + encodeURIComponent("O dono precisa transferir a família antes de sair."));
  }

  const { error } = await supabase.rpc("leave_household");
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/settings/members");
  revalidatePath("/pets");
  redirect("/settings?left=1");
}

export async function deleteHousehold(householdId: string, formData: FormData) {
  const confirmName = String(formData.get("confirm_name") ?? "").trim();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  await activateHousehold(supabase, householdId);
  const role = await getMyRole(supabase);
  if (!isOwner(role)) {
    redirect("/settings?error=" + encodeURIComponent("Apenas o dono pode excluir a família."));
  }

  const { data: household, error: householdError } = await supabase
    .from("households")
    .select("name")
    .eq("id", householdId)
    .maybeSingle();
  if (householdError) redirect(`/settings?error=${encodeURIComponent(householdError.message)}`);
  if (!household || confirmName !== household.name.trim()) {
    redirect("/settings?error=" + encodeURIComponent("Digite o nome exato da família para confirmar a exclusão."));
  }

  const { error } = await supabase.rpc("delete_household");
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/settings/members");
  revalidatePath("/pets");
  redirect("/settings?deleted=1");
}
