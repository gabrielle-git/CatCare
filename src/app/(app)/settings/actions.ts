"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setActiveHousehold } from "@/lib/household-switch";
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
