"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { acceptInvite } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

function fail(token: string, cause: unknown): never {
  const message =
    cause instanceof Error
      ? cause.message
      : cause && typeof cause === "object" && "message" in cause
        ? String((cause as { message: unknown }).message)
        : "Não foi possível aceitar o convite.";
  redirect(`/invite/${token}?error=${encodeURIComponent(message)}`);
}

export async function acceptInviteAction(token: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  try {
    await acceptInvite(token, supabase);
  } catch (cause) {
    fail(token, cause);
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings/members");
  redirect("/?joined=1");
}
