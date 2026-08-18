"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
import { parsePetIds, resolveOptionalPetId } from "@/lib/pet-form";
import { createClient } from "@/lib/supabase/server";

const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const categories = new Set(["vaccine", "medication", "consultation", "weight", "feeding", "hygiene", "purchase", "other"]);

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { supabase, household };
}

export async function createReminder(formData: FormData) {
  const title = value(formData, "title");
  const category = value(formData, "category");
  const dueAt = value(formData, "due_at");
  if (!title || !categories.has(category) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dueAt)) redirect("/agenda/new?error=Confira%20o%20t%C3%ADtulo%2C%20a%20categoria%20e%20a%20data.");
  const recurrence = value(formData, "recurrence");
  const recurrenceRule = recurrence === "daily" ? "FREQ=DAILY" : recurrence === "weekly" ? "FREQ=WEEKLY" : recurrence === "monthly" ? "FREQ=MONTHLY" : null;
  const { supabase, household } = await authContext();
  const petIds = parsePetIds(formData);
  const targets = petIds.length === 0 ? [null] : petIds;
  const common = {
    household_id: household.id,
    title,
    category,
    due_at: `${dueAt}:00-03:00`,
    recurrence_rule: recurrenceRule,
    notes: value(formData, "notes") || null,
  };
  for (const petId of targets) {
    const { error } = await supabase.from("reminders").insert({ ...common, pet_id: petId });
    if (error) redirect(`/agenda/new?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/agenda");
  revalidatePath("/");
  redirect("/agenda?saved=1");
}

export async function completeReminder(reminderId: string) {
  const { supabase, household } = await authContext();
  await supabase.from("reminders").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", reminderId).eq("household_id", household.id);
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
  const { supabase, household } = await authContext();
  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const { error } = await supabase.from("reminders").update({
    pet_id: petId,
    title,
    category,
    due_at: `${dueAt}:00-03:00`,
    recurrence_rule: recurrenceRule,
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
