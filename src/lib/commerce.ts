import type { SupabaseClient } from "@supabase/supabase-js";
import type { Expense, Product, ProductReview, Purchase, Reminder } from "@/types/database";

export async function getExpense(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("expenses").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  return data as Expense | null;
}

export async function getPurchase(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("purchases").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  return data as Purchase | null;
}

export async function getProduct(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  return data as Product | null;
}

export async function getProductReview(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("product_reviews").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  return data as ProductReview | null;
}

export async function getReminder(supabase: SupabaseClient, householdId: string, id: string) {
  const { data, error } = await supabase.from("reminders").select("*").eq("id", id).eq("household_id", householdId).maybeSingle();
  if (error) throw error;
  return data as Reminder | null;
}

export async function listExpenses(supabase: SupabaseClient, householdId: string, limit = 120): Promise<Expense[]> {
  const { data, error } = await supabase.from("expenses").select("*").eq("household_id", householdId).order("occurred_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as Expense[];
}

export async function listCommerce(supabase: SupabaseClient, householdId: string) {
  const [products, purchases, reviews] = await Promise.all([
    supabase.from("products").select("*").eq("household_id", householdId).order("updated_at", { ascending: false }),
    supabase.from("purchases").select("*").eq("household_id", householdId).order("purchased_at", { ascending: false }).limit(120),
    supabase.from("product_reviews").select("*").eq("household_id", householdId).order("reviewed_at", { ascending: false }).limit(200),
  ]);
  if (products.error) throw products.error;
  if (purchases.error) throw purchases.error;
  if (reviews.error) throw reviews.error;
  return {
    products: (products.data ?? []) as Product[],
    purchases: (purchases.data ?? []) as Purchase[],
    reviews: (reviews.data ?? []) as ProductReview[],
  };
}
