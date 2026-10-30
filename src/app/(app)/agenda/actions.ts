"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/attachments";
import {
  foreignIntentErrorMessage,
  invalidIntentErrorMessage,
  isUniqueViolation,
  resolveHouseholdCreateOwnership,
} from "@/lib/create-idempotency";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
import { parsePetIds, resolveOptionalPetId } from "@/lib/pet-form";
import { recurrenceAnchorDayForSave } from "@/lib/reminder-recurrence";
import { createClient } from "@/lib/supabase/server";

const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const categories = new Set(["vaccine", "deworming", "medication", "consultation", "weight", "feeding", "hygiene", "purchase", "other"]);

export type CreateReminderResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { supabase, household };
}

function parseReminderTargets(formData: FormData, petIds: string[]) {
  const raw = value(formData, "reminder_ids_json");
  let map: Record<string, string> = {};
  try {
    map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    map = {};
  }
  const keys = petIds.length === 0 ? ["family"] : petIds;
  return keys.map((key) => {
    const reminderId = map[key];
    const petId = key === "family" ? null : key;
    return { key, petId, reminderId };
  });
}

/**
 * Manual reminder create only (not health_record-derived reminders).
 * Multi-pet: one stable reminder_id per selected pet (or family) for the form intent.
 */
export async function createReminder(formData: FormData): Promise<CreateReminderResult> {
  const title = value(formData, "title");
  const category = value(formData, "category");
  const dueAt = value(formData, "due_at");
  if (!title || !categories.has(category) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dueAt)) {
    return { ok: false, error: "Confira o título, a categoria e a data." };
  }
  const recurrence = value(formData, "recurrence");
  const recurrenceRule =
    recurrence === "daily" ? "FREQ=DAILY" : recurrence === "weekly" ? "FREQ=WEEKLY" : recurrence === "monthly" ? "FREQ=MONTHLY" : null;
  const { supabase, household } = await authContext();
  const petIds = parsePetIds(formData);
  const targets = parseReminderTargets(formData, petIds);
  if (targets.some((t) => !t.reminderId || !isUuid(t.reminderId))) {
    return { ok: false, error: invalidIntentErrorMessage() };
  }

  const common = {
    household_id: household.id,
    title,
    category,
    due_at: `${dueAt}:00-03:00`,
    recurrence_rule: recurrenceRule,
    notes: value(formData, "notes") || null,
  };

  for (const target of targets) {
    const reminderId = target.reminderId as string;
    const { data: existing } = await supabase
      .from("reminders")
      .select("id, household_id")
      .eq("id", reminderId)
      .maybeSingle();
    const ownership = resolveHouseholdCreateOwnership(reminderId, household.id, existing);
    if (!ownership.ok) {
      return {
        ok: false,
        error: ownership.reason === "foreign_household" ? foreignIntentErrorMessage() : invalidIntentErrorMessage(),
      };
    }
    if (ownership.status === "reuse") continue;

    const { error } = await supabase.from("reminders").insert({
      id: reminderId,
      series_id: reminderId,
      recurrence_anchor_day: recurrence === "monthly" ? Number(dueAt.slice(8, 10)) : null,
      ...common,
      pet_id: target.petId,
    });
    if (error) {
      if (isUniqueViolation(error)) {
        const { data: again } = await supabase.from("reminders").select("id, household_id").eq("id", reminderId).maybeSingle();
        const retry = resolveHouseholdCreateOwnership(reminderId, household.id, again);
        if (retry.ok && retry.status === "reuse") continue;
        return { ok: false, error: foreignIntentErrorMessage() };
      }
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/agenda");
  revalidatePath("/");
  return { ok: true, redirectTo: "/agenda?saved=1" };
}

export async function completeReminder(reminderId: string) {
  const { supabase } = await authContext();
  const { data, error } = await supabase.rpc("complete_reminder", { p_id: reminderId });
  const result = data as { ok?: boolean } | null;
  if (error || result?.ok !== true) {
    redirect("/agenda?error=N%C3%A3o%20foi%20poss%C3%ADvel%20concluir%20este%20lembrete.");
  }
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function updateReminder(reminderId: string, formData: FormData) {
  const title = value(formData, "title");
  const category = value(formData, "category");
  const dueAt = value(formData, "due_at");
  if (!title || !categories.has(category) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dueAt)) redirect(`/agenda/${reminderId}/edit?error=Confira%20o%20t%C3%ADtulo%2C%20a%20categoria%20e%20a%20data.`);
  const recurrence = value(formData, "recurrence");
  const recurrenceRule = recurrence === "daily" ? "FREQ=DAILY" : recurrence === "weekly" ? "FREQ=WEEKLY" : recurrence === "monthly" ? "FREQ=MONTHLY" : null;
  const recurrenceForm = recurrence === "daily" || recurrence === "weekly" || recurrence === "monthly" ? recurrence : "none";
  const { supabase, household } = await authContext();
  const { data: current, error: currentError } = await supabase
    .from("reminders")
    .select("due_at, recurrence_rule, recurrence_anchor_day")
    .eq("id", reminderId)
    .eq("household_id", household.id)
    .maybeSingle();
  if (currentError || !current) redirect(`/agenda/${reminderId}/edit?error=N%C3%A3o%20foi%20poss%C3%ADvel%20atualizar%20este%20lembrete.`);
  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const { error } = await supabase.from("reminders").update({
    pet_id: petId,
    title,
    category,
    due_at: `${dueAt}:00-03:00`,
    recurrence_rule: recurrenceRule,
    recurrence_anchor_day: recurrenceAnchorDayForSave({
      recurrence: recurrenceForm,
      submittedDue: dueAt,
      currentDueAt: current.due_at,
      currentRule: current.recurrence_rule,
      currentAnchor: current.recurrence_anchor_day,
      adoptDisplayedDay: formData.get("adopt_displayed_day") === "1",
    }),
    notes: value(formData, "notes") || null,
    updated_at: new Date().toISOString(),
  }).eq("id", reminderId).eq("household_id", household.id);
  if (error) redirect(`/agenda/${reminderId}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/agenda");
  revalidatePath("/");
  redirect("/agenda?updated=1");
}

export async function deleteReminder(reminderId: string) {
  const { supabase, household } = await authContext();
  const { error } = await supabase.from("reminders").delete().eq("id", reminderId).eq("household_id", household.id);
  if (error) redirect(`/agenda?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/agenda");
  revalidatePath("/");
  redirect("/agenda?deleted=1");
}
