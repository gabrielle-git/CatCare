"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildInviteUrl, isLocalAppUrl } from "@/lib/app-url";
import { sendInviteEmail } from "@/lib/email/send-invite";
import { ensureHousehold } from "@/lib/households";
import { getMyRole, isOwner } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { HouseholdRole } from "@/types/database";

function fail(message: string): never {
  redirect(`/settings/members?error=${encodeURIComponent(message)}`);
}

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, userId: data.user.id };
}

export async function setMemberRole(userId: string, formData: FormData) {
  const role = String(formData.get("role") ?? "") as HouseholdRole;
  if (role !== "caregiver" && role !== "viewer") fail("Escolha um papel válido.");
  const { supabase } = await authContext();
  const { error } = await supabase.rpc("set_member_role", { target_user_id: userId, new_role: role });
  if (error) fail(error.message);
  revalidatePath("/settings/members");
  revalidatePath("/settings");
  redirect("/settings/members?updated=1");
}

export async function removeMember(userId: string) {
  const { supabase, userId: currentUserId } = await authContext();
  if (userId === currentUserId) fail("Você não pode remover a si mesma desta forma.");
  const { error } = await supabase.rpc("remove_household_member", { target_user_id: userId });
  if (error) fail(error.message);
  revalidatePath("/settings/members");
  revalidatePath("/settings");
  redirect("/settings/members?removed=1");
}

export async function sendInvite(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as HouseholdRole;
  if (!email) fail("Informe o e-mail de quem você quer convidar.");
  if (role !== "caregiver" && role !== "viewer") fail("Escolha um papel válido.");

  const { supabase, userId } = await authContext();
  const household = await ensureHousehold(supabase, userId);
  const { data: token, error } = await supabase.rpc("create_household_invite", { invitee_email: email, invite_role: role });
  if (error) fail(error.message);
  if (!token) fail("Não foi possível gerar o convite.");

  const inviteUrl = buildInviteUrl(String(token));
  if (isLocalAppUrl()) {
    fail("Configure NEXT_PUBLIC_APP_URL com a URL da Vercel (ex.: https://cat-care-xi.vercel.app) antes de enviar convites por e-mail.");
  }
  const mail = await sendInviteEmail({ to: email, inviteUrl, householdName: household.name, role });

  revalidatePath("/settings/members");
  revalidatePath("/settings");

  if (mail.sent) {
    redirect("/settings/members?invited=1");
  }
  redirect(`/settings/members?invited=1&manual=${encodeURIComponent(inviteUrl)}`);
}

export async function revokeInvite(inviteId: string) {
  const { supabase } = await authContext();
  const { error } = await supabase.rpc("revoke_household_invite", { invite_id: inviteId });
  if (error) fail(error.message);
  revalidatePath("/settings/members");
  redirect("/settings/members?revoked=1");
}

export async function renameHousehold(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail("Informe um nome para a família.");
  const { supabase } = await authContext();
  const { error } = await supabase.rpc("update_household_name", { new_name: name });
  if (error) fail(error.message);
  revalidatePath("/settings/members");
  revalidatePath("/settings");
  redirect("/settings/members?renamed=1");
}

export async function setMemberAlias(userId: string, formData: FormData) {
  const alias = String(formData.get("alias") ?? "").trim();
  const { supabase, userId: currentUserId } = await authContext();
  if (userId === currentUserId) fail("Use Configurações → Conta para mudar seu próprio nome.");
  const { error } = await supabase.rpc("set_member_alias", { target_user_id: userId, alias_text: alias });
  if (error) fail(error.message);
  revalidatePath("/settings/members");
  redirect("/settings/members?alias=1");
}

export async function transferOwnership(userId: string) {
  const { supabase, userId: currentUserId } = await authContext();
  if (userId === currentUserId) fail("Você já é o dono desta família.");
  const role = await getMyRole(supabase);
  if (!isOwner(role)) fail("Apenas o dono pode transferir a família.");
  const { error } = await supabase.rpc("transfer_ownership", { target_user_id: userId });
  if (error) fail(error.message);
  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/settings/members");
  redirect("/settings/members?transferred=1");
}
