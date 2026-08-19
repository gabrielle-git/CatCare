"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncEntityPets, validateEntityPets } from "@/lib/entity-pets";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
import { parsePetIds, resolveOptionalPetId, sharedFromPetIds } from "@/lib/pet-form";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory, Product, ProductCategory, PurchaseChannel } from "@/types/database";

const productCategories = new Set<ProductCategory>(["dry_food", "wet_food", "litter", "treat", "hygiene", "medicine", "accessory", "other"]);
const purchaseChannels = new Set<PurchaseChannel>(["physical_store", "online_store", "marketplace", "delivery", "veterinary", "other"]);
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function moneyToCents(raw: string) {
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
}

function expenseCategory(category: ProductCategory): ExpenseCategory {
  if (category === "dry_food" || category === "wet_food" || category === "treat") return "food";
  if (category === "litter" || category === "hygiene") return "hygiene";
  if (category === "medicine") return "medication";
  if (category === "accessory") return "accessory";
  return "other";
}

export async function createPurchase(formData: FormData) {
  const amountCents = moneyToCents(value(formData, "amount"));
  const quantity = Number(value(formData, "quantity"));
  const storeName = value(formData, "store_name");
  const purchasedOn = value(formData, "purchased_on");
  const channel = value(formData, "channel") as PurchaseChannel;
  if (!Number.isFinite(amountCents) || amountCents < 0 || !Number.isFinite(quantity) || quantity <= 0 || !storeName || !purchasedOn || !purchaseChannels.has(channel)) redirect("/shopping/new?error=Confira%20os%20dados%20da%20compra.");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  const selectedProductId = value(formData, "product_id");
  let product: Product | null = null;

  if (selectedProductId) {
    const result = await supabase.from("products").select("*").eq("id", selectedProductId).eq("household_id", household.id).maybeSingle();
    if (result.error) redirect(`/shopping/new?error=${encodeURIComponent(result.error.message)}`);
    product = result.data as Product | null;
  } else {
    const name = value(formData, "product_name");
    const category = value(formData, "category") as ProductCategory;
    if (!name || !productCategories.has(category)) redirect("/shopping/new?error=D%C3%AA%20um%20nome%20e%20uma%20categoria%20ao%20novo%20produto.");
    const result = await supabase.from("products").insert({ household_id: household.id, name, brand: value(formData, "brand") || null, category, package_size: value(formData, "package_size") || null, notes: value(formData, "product_notes") || null }).select("*").single();
    if (result.error) redirect(`/shopping/new?error=${encodeURIComponent(result.error.message)}`);
    product = result.data as Product;
  }
  if (!product) redirect("/shopping/new?error=Produto%20n%C3%A3o%20encontrado.");

  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const description = [product.brand, product.name].filter(Boolean).join(" • ");
  const expenseNotes = `Compra em ${storeName}`;
  const expenseResult = await supabase.from("expenses").insert({ household_id: household.id, pet_id: petId, category: expenseCategory(product.category), description, amount_cents: amountCents, occurred_at: `${purchasedOn}T12:00:00-03:00`, shared: sharedFromPetIds(petIds), notes: expenseNotes }).select("id").single();
  if (expenseResult.error) redirect(`/shopping/new?error=${encodeURIComponent(expenseResult.error.message)}`);
  try {
    await validateEntityPets(supabase, household.id, petIds);
    await syncEntityPets(supabase, "expense_pets", household.id, expenseResult.data.id, petIds);
  } catch (petError) {
    await supabase.from("expenses").delete().eq("id", expenseResult.data.id).eq("household_id", household.id);
    redirect(`/shopping/new?error=${encodeURIComponent(petError instanceof Error ? petError.message : "Não foi possível vincular os pets.")}`);
  }

  const purchaseResult = await supabase.from("purchases").insert({ household_id: household.id, product_id: product.id, pet_id: petId, expense_id: expenseResult.data.id, store_name: storeName, channel, quantity, amount_cents: amountCents, purchased_at: `${purchasedOn}T12:00:00-03:00`, product_url: value(formData, "product_url") || null, notes: value(formData, "purchase_notes") || null }).select("id").single();
  if (purchaseResult.error) {
    await supabase.from("expenses").delete().eq("id", expenseResult.data.id).eq("household_id", household.id);
    redirect(`/shopping/new?error=${encodeURIComponent(purchaseResult.error.message)}`);
  }
  await syncEntityPets(supabase, "purchase_pets", household.id, purchaseResult.data.id, petIds);

  const scores = ["quality_score", "acceptance_score", "cost_benefit_score"].map((name) => Number(value(formData, name)));
  const hasAnyScore = scores.some((score) => Number.isFinite(score) && score > 0);
  const hasAllScores = scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5);
  if (hasAnyScore && !hasAllScores) redirect("/shopping?saved=1&review=partial");
  if (hasAllScores) {
    const reviewResult = await supabase.from("product_reviews").insert({ household_id: household.id, product_id: product.id, pet_id: petId, quality_score: scores[0], acceptance_score: scores[1], cost_benefit_score: scores[2], would_buy_again: formData.get("would_buy_again") === "on", notes: value(formData, "review_notes") || null, reviewed_at: `${purchasedOn}T12:00:00-03:00` }).select("id").single();
    if (reviewResult.data) await syncEntityPets(supabase, "review_pets", household.id, reviewResult.data.id, petIds);
  }

  revalidatePath("/shopping");
  revalidatePath("/expenses");
  redirect("/shopping?saved=1");
}

async function authContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await assertCanEdit(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { supabase, household };
}

export async function updatePurchase(purchaseId: string, formData: FormData) {
  const amountCents = moneyToCents(value(formData, "amount"));
  const quantity = Number(value(formData, "quantity"));
  const storeName = value(formData, "store_name");
  const purchasedOn = value(formData, "purchased_on");
  const channel = value(formData, "channel") as PurchaseChannel;
  if (!Number.isFinite(amountCents) || amountCents < 0 || !Number.isFinite(quantity) || quantity <= 0 || !storeName || !purchasedOn || !purchaseChannels.has(channel)) redirect(`/shopping/purchases/${purchaseId}/edit?error=Confira%20os%20dados%20da%20compra.`);

  const { supabase, household } = await authContext();
  const existing = await supabase.from("purchases").select("expense_id, product_id").eq("id", purchaseId).eq("household_id", household.id).maybeSingle();
  if (!existing.data) redirect("/shopping");

  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const { error } = await supabase.from("purchases").update({
    pet_id: petId,
    store_name: storeName,
    channel,
    quantity,
    amount_cents: amountCents,
    purchased_at: `${purchasedOn}T12:00:00-03:00`,
    product_url: value(formData, "product_url") || null,
    notes: value(formData, "purchase_notes") || null,
  }).eq("id", purchaseId).eq("household_id", household.id);
  if (error) redirect(`/shopping/purchases/${purchaseId}/edit?error=${encodeURIComponent(error.message)}`);

  try {
    await validateEntityPets(supabase, household.id, petIds);
    await syncEntityPets(supabase, "purchase_pets", household.id, purchaseId, petIds);
  } catch (petError) {
    redirect(`/shopping/purchases/${purchaseId}/edit?error=${encodeURIComponent(petError instanceof Error ? petError.message : "Não foi possível vincular os pets.")}`);
  }

  if (existing.data.expense_id) {
    const product = await supabase.from("products").select("brand, name, category").eq("id", existing.data.product_id).maybeSingle();
    const description = product.data ? [product.data.brand, product.data.name].filter(Boolean).join(" • ") : "Compra";
    await supabase.from("expenses").update({
      pet_id: petId,
      category: product.data ? expenseCategory(product.data.category as ProductCategory) : "other",
      description,
      amount_cents: amountCents,
      occurred_at: `${purchasedOn}T12:00:00-03:00`,
      shared: sharedFromPetIds(petIds),
      notes: `Compra em ${storeName}`,
    }).eq("id", existing.data.expense_id).eq("household_id", household.id);
    await syncEntityPets(supabase, "expense_pets", household.id, existing.data.expense_id, petIds);
  }

  revalidatePath("/shopping");
  revalidatePath("/expenses");
  redirect("/shopping?updated=1");
}

export async function deletePurchase(purchaseId: string) {
  const { supabase, household } = await authContext();
  const existing = await supabase.from("purchases").select("expense_id").eq("id", purchaseId).eq("household_id", household.id).maybeSingle();
  const { error } = await supabase.from("purchases").delete().eq("id", purchaseId).eq("household_id", household.id);
  if (error) redirect(`/shopping?error=${encodeURIComponent(error.message)}`);
  if (existing.data?.expense_id) await supabase.from("expenses").delete().eq("id", existing.data.expense_id).eq("household_id", household.id);
  revalidatePath("/shopping");
  revalidatePath("/expenses");
  redirect("/shopping?deleted=1");
}

export async function updateProduct(productId: string, formData: FormData) {
  const name = value(formData, "product_name");
  const category = value(formData, "category") as ProductCategory;
  if (!name || !productCategories.has(category)) redirect(`/shopping/products/${productId}/edit?error=Confira%20nome%20e%20categoria.`);
  const { supabase, household } = await authContext();
  const { error } = await supabase.from("products").update({
    name,
    brand: value(formData, "brand") || null,
    category,
    package_size: value(formData, "package_size") || null,
    notes: value(formData, "product_notes") || null,
    updated_at: new Date().toISOString(),
  }).eq("id", productId).eq("household_id", household.id);
  if (error) redirect(`/shopping/products/${productId}/edit?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/shopping");
  redirect("/shopping?updated=1");
}

export async function deleteProduct(productId: string) {
  const { supabase, household } = await authContext();
  const purchases = await supabase.from("purchases").select("expense_id").eq("product_id", productId).eq("household_id", household.id);
  const expenseIds = (purchases.data ?? []).map((row) => row.expense_id).filter(Boolean) as string[];
  const { error } = await supabase.from("products").delete().eq("id", productId).eq("household_id", household.id);
  if (error) redirect(`/shopping?error=${encodeURIComponent(error.message)}`);
  if (expenseIds.length) await supabase.from("expenses").delete().in("id", expenseIds).eq("household_id", household.id);
  revalidatePath("/shopping");
  revalidatePath("/expenses");
  redirect("/shopping?deleted=1");
}

export async function updateProductReview(reviewId: string, formData: FormData) {
  const scores = ["quality_score", "acceptance_score", "cost_benefit_score"].map((name) => Number(value(formData, name)));
  if (!scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5)) redirect(`/shopping/reviews/${reviewId}/edit?error=Informe%20as%20tr%C3%AAs%20notas%20de%201%20a%205.`);
  const { supabase, household } = await authContext();
  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const { error } = await supabase.from("product_reviews").update({
    pet_id: petId,
    quality_score: scores[0],
    acceptance_score: scores[1],
    cost_benefit_score: scores[2],
    would_buy_again: formData.get("would_buy_again") === "on",
    notes: value(formData, "review_notes") || null,
    updated_at: new Date().toISOString(),
  }).eq("id", reviewId).eq("household_id", household.id);
  if (error) redirect(`/shopping/reviews/${reviewId}/edit?error=${encodeURIComponent(error.message)}`);
  try {
    await validateEntityPets(supabase, household.id, petIds);
    await syncEntityPets(supabase, "review_pets", household.id, reviewId, petIds);
  } catch (petError) {
    redirect(`/shopping/reviews/${reviewId}/edit?error=${encodeURIComponent(petError instanceof Error ? petError.message : "Não foi possível vincular os pets.")}`);
  }
  revalidatePath("/shopping");
  redirect("/shopping?updated=1");
}

export async function deleteProductReview(reviewId: string) {
  const { supabase, household } = await authContext();
  const { error } = await supabase.from("product_reviews").delete().eq("id", reviewId).eq("household_id", household.id);
  if (error) redirect(`/shopping?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/shopping");
  redirect("/shopping?deleted=1");
}
