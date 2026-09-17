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
import { syncEntityPets, validateEntityPets } from "@/lib/entity-pets";
import { validateFactualCivilDate } from "@/lib/factual-datetime";
import { ensureHousehold } from "@/lib/households";
import { assertCanEdit } from "@/lib/roles";
import { parsePetIds, resolveOptionalPetId, sharedFromPetIds } from "@/lib/pet-form";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory, Product, ProductCategory, PurchaseChannel } from "@/types/database";

const productCategories = new Set<ProductCategory>(["dry_food", "wet_food", "litter", "treat", "hygiene", "medicine", "accessory", "other"]);
const purchaseChannels = new Set<PurchaseChannel>(["physical_store", "online_store", "marketplace", "delivery", "veterinary", "other"]);
const value = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export type CreatePurchaseResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

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

function resolvePurchaseAmounts(formData: FormData) {
  const paid = moneyToCents(value(formData, "amount"));
  const discountRaw = value(formData, "discount");
  const discountCents = discountRaw ? moneyToCents(discountRaw) : 0;
  const subtotalRaw = value(formData, "subtotal");

  if (subtotalRaw) {
    const subtotal = moneyToCents(subtotalRaw);
    if (!Number.isFinite(subtotal) || subtotal < 0) return null;
    if (discountRaw && (!Number.isFinite(discountCents) || discountCents < 0)) return null;
    const amount = subtotal - (discountCents || 0);
    if (amount < 0) return null;
    return { amount_cents: amount, subtotal_cents: subtotal, discount_cents: discountCents || 0 };
  }

  if (!Number.isFinite(paid) || paid < 0) return null;
  if (discountRaw && (!Number.isFinite(discountCents) || discountCents < 0)) return null;
  return {
    amount_cents: paid,
    subtotal_cents: discountCents ? paid + discountCents : null,
    discount_cents: discountCents || 0,
  };
}

function purchaseExtras(formData: FormData) {
  const membershipId = value(formData, "membership_id");
  return {
    coupon_code: value(formData, "coupon_code") || null,
    membership_id: membershipId || null,
  };
}

function finishPurchase(redirectTo: string): CreatePurchaseResult {
  revalidatePath("/shopping");
  revalidatePath("/expenses");
  return { ok: true, redirectTo };
}

/**
 * Idempotent purchase create: one intent → stable purchase_id + expense_id
 * (+ product_id when creating a new product, review_id when scoring).
 * Retry must never create N expenses for the same purchase intent.
 */
export async function createPurchase(formData: FormData): Promise<CreatePurchaseResult> {
  const pricing = resolvePurchaseAmounts(formData);
  const quantity = Number(value(formData, "quantity"));
  const storeName = value(formData, "store_name");
  const purchasedOn = value(formData, "purchased_on");
  const channel = value(formData, "channel") as PurchaseChannel;
  if (!pricing || !Number.isFinite(quantity) || quantity <= 0 || !storeName || !purchasedOn || !purchaseChannels.has(channel)) {
    return { ok: false, error: "Confira os dados da compra." };
  }
  const purchasedCheck = validateFactualCivilDate(purchasedOn);
  if (!purchasedCheck.ok) return { ok: false, error: purchasedCheck.message };

  const purchaseId = value(formData, "purchase_id");
  const expenseId = value(formData, "expense_id");
  if (!isUuid(purchaseId) || !isUuid(expenseId)) {
    return { ok: false, error: invalidIntentErrorMessage() };
  }

  const { amount_cents: amountCents, subtotal_cents: subtotalCents, discount_cents: discountCents } = pricing;
  const extras = purchaseExtras(formData);
  const { supabase, household } = await authContext();

  const { data: existingPurchase } = await supabase
    .from("purchases")
    .select("id, household_id, expense_id")
    .eq("id", purchaseId)
    .maybeSingle();

  const purchaseOwnership = resolveHouseholdCreateOwnership(purchaseId, household.id, existingPurchase);
  if (!purchaseOwnership.ok) {
    return {
      ok: false,
      error: purchaseOwnership.reason === "foreign_household" ? foreignIntentErrorMessage() : invalidIntentErrorMessage(),
    };
  }

  const scores = ["quality_score", "acceptance_score", "cost_benefit_score"].map((name) => Number(value(formData, name)));
  const hasAnyScore = scores.some((score) => Number.isFinite(score) && score > 0);
  const hasAllScores = scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5);

  if (purchaseOwnership.status === "reuse") {
    if (hasAnyScore && !hasAllScores) {
      return finishPurchase(`/shopping?saved=1&review=partial&purchase=${purchaseId}`);
    }
    return finishPurchase(hasAllScores ? "/shopping?saved=1" : `/shopping?saved=1&review=pending&purchase=${purchaseId}`);
  }

  const selectedProductId = value(formData, "product_id");
  let product: Product | null = null;

  if (selectedProductId) {
    if (!isUuid(selectedProductId)) return { ok: false, error: "Produto inválido." };
    const result = await supabase.from("products").select("*").eq("id", selectedProductId).eq("household_id", household.id).maybeSingle();
    if (result.error) return { ok: false, error: result.error.message };
    product = result.data as Product | null;
  } else {
    const newProductId = value(formData, "new_product_id");
    if (!isUuid(newProductId)) return { ok: false, error: invalidIntentErrorMessage() };
    const name = value(formData, "product_name");
    const category = value(formData, "category") as ProductCategory;
    if (!name || !productCategories.has(category)) {
      return { ok: false, error: "Dê um nome e uma categoria ao novo produto." };
    }

    const { data: existingProduct } = await supabase
      .from("products")
      .select("*")
      .eq("id", newProductId)
      .maybeSingle();
    const productOwnership = resolveHouseholdCreateOwnership(newProductId, household.id, existingProduct);
    if (!productOwnership.ok) {
      return {
        ok: false,
        error: productOwnership.reason === "foreign_household" ? foreignIntentErrorMessage() : invalidIntentErrorMessage(),
      };
    }
    if (productOwnership.status === "reuse") {
      product = existingProduct as Product;
    } else {
      const result = await supabase
        .from("products")
        .insert({
          id: newProductId,
          household_id: household.id,
          name,
          brand: value(formData, "brand") || null,
          category,
          package_size: value(formData, "package_size") || null,
          notes: value(formData, "product_notes") || null,
        })
        .select("*")
        .single();
      if (result.error) {
        if (isUniqueViolation(result.error)) {
          const { data: again } = await supabase.from("products").select("*").eq("id", newProductId).maybeSingle();
          const retry = resolveHouseholdCreateOwnership(newProductId, household.id, again);
          if (retry.ok && retry.status === "reuse") product = again as Product;
          else return { ok: false, error: foreignIntentErrorMessage() };
        } else {
          return { ok: false, error: result.error.message };
        }
      } else {
        product = result.data as Product;
      }
    }
  }
  if (!product) return { ok: false, error: "Produto não encontrado." };

  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const description = [product.brand, product.name].filter(Boolean).join(" • ");
  const expenseNotes = `Compra em ${storeName}`;

  const { data: existingExpense } = await supabase
    .from("expenses")
    .select("id, household_id")
    .eq("id", expenseId)
    .maybeSingle();
  const expenseOwnership = resolveHouseholdCreateOwnership(expenseId, household.id, existingExpense);
  if (!expenseOwnership.ok) {
    return {
      ok: false,
      error: expenseOwnership.reason === "foreign_household" ? foreignIntentErrorMessage() : invalidIntentErrorMessage(),
    };
  }

  if (expenseOwnership.status === "create") {
    const { error: expenseError } = await supabase.from("expenses").insert({
      id: expenseId,
      household_id: household.id,
      pet_id: petId,
      category: expenseCategory(product.category),
      description,
      amount_cents: amountCents,
      occurred_at: `${purchasedOn}T12:00:00-03:00`,
      shared: sharedFromPetIds(petIds),
      notes: expenseNotes,
    });
    if (expenseError) {
      if (isUniqueViolation(expenseError)) {
        const { data: again } = await supabase.from("expenses").select("id, household_id").eq("id", expenseId).maybeSingle();
        const retry = resolveHouseholdCreateOwnership(expenseId, household.id, again);
        if (!retry.ok || retry.status !== "reuse") return { ok: false, error: foreignIntentErrorMessage() };
      } else {
        return { ok: false, error: expenseError.message };
      }
    }
  }

  try {
    await validateEntityPets(supabase, household.id, petIds);
    await syncEntityPets(supabase, "expense_pets", household.id, expenseId, petIds);
  } catch (petError) {
    if (expenseOwnership.status === "create") {
      await supabase.from("expenses").delete().eq("id", expenseId).eq("household_id", household.id);
    }
    return { ok: false, error: petError instanceof Error ? petError.message : "Não foi possível vincular os pets." };
  }

  const { error: purchaseError } = await supabase.from("purchases").insert({
    id: purchaseId,
    household_id: household.id,
    product_id: product.id,
    pet_id: petId,
    expense_id: expenseId,
    store_name: storeName,
    channel,
    quantity,
    amount_cents: amountCents,
    subtotal_cents: subtotalCents,
    discount_cents: discountCents,
    coupon_code: extras.coupon_code,
    membership_id: extras.membership_id,
    petlove_club: false,
    purchased_at: `${purchasedOn}T12:00:00-03:00`,
    product_url: value(formData, "product_url") || null,
    notes: value(formData, "purchase_notes") || null,
  });

  if (purchaseError) {
    if (isUniqueViolation(purchaseError)) {
      const { data: again } = await supabase.from("purchases").select("id, household_id").eq("id", purchaseId).maybeSingle();
      const retry = resolveHouseholdCreateOwnership(purchaseId, household.id, again);
      if (retry.ok && retry.status === "reuse") {
        if (hasAnyScore && !hasAllScores) return finishPurchase(`/shopping?saved=1&review=partial&purchase=${purchaseId}`);
        return finishPurchase(hasAllScores ? "/shopping?saved=1" : `/shopping?saved=1&review=pending&purchase=${purchaseId}`);
      }
      return { ok: false, error: foreignIntentErrorMessage() };
    }
    if (expenseOwnership.status === "create") {
      await supabase.from("expenses").delete().eq("id", expenseId).eq("household_id", household.id);
    }
    return { ok: false, error: purchaseError.message };
  }

  await syncEntityPets(supabase, "purchase_pets", household.id, purchaseId, petIds);

  if (hasAnyScore && !hasAllScores) {
    return finishPurchase(`/shopping?saved=1&review=partial&purchase=${purchaseId}`);
  }

  if (hasAllScores) {
    const reviewId = value(formData, "review_id");
    if (!isUuid(reviewId)) return { ok: false, error: invalidIntentErrorMessage() };

    const { data: existingReview } = await supabase
      .from("product_reviews")
      .select("id, household_id")
      .eq("id", reviewId)
      .maybeSingle();
    const reviewOwnership = resolveHouseholdCreateOwnership(reviewId, household.id, existingReview);
    if (!reviewOwnership.ok) {
      return {
        ok: false,
        error: reviewOwnership.reason === "foreign_household" ? foreignIntentErrorMessage() : invalidIntentErrorMessage(),
      };
    }
    if (reviewOwnership.status === "create") {
      const { error: reviewError } = await supabase.from("product_reviews").insert({
        id: reviewId,
        household_id: household.id,
        product_id: product.id,
        pet_id: petId,
        quality_score: scores[0],
        acceptance_score: scores[1],
        cost_benefit_score: scores[2],
        would_buy_again: formData.get("would_buy_again") === "on",
        notes: value(formData, "review_notes") || null,
        reviewed_at: `${purchasedOn}T12:00:00-03:00`,
      });
      if (reviewError && !isUniqueViolation(reviewError)) {
        return { ok: false, error: reviewError.message };
      }
    }
    await syncEntityPets(supabase, "review_pets", household.id, reviewId, petIds);
    return finishPurchase("/shopping?saved=1");
  }

  return finishPurchase(`/shopping?saved=1&review=pending&purchase=${purchaseId}`);
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
  const pricing = resolvePurchaseAmounts(formData);
  const quantity = Number(value(formData, "quantity"));
  const storeName = value(formData, "store_name");
  const purchasedOn = value(formData, "purchased_on");
  const channel = value(formData, "channel") as PurchaseChannel;
  if (!pricing || !Number.isFinite(quantity) || quantity <= 0 || !storeName || !purchasedOn || !purchaseChannels.has(channel)) redirect(`/shopping/purchases/${purchaseId}/edit?error=Confira%20os%20dados%20da%20compra.`);
  const purchasedCheck = validateFactualCivilDate(purchasedOn);
  if (!purchasedCheck.ok) redirect(`/shopping/purchases/${purchaseId}/edit?error=${encodeURIComponent(purchasedCheck.message)}`);
  const { amount_cents: amountCents, subtotal_cents: subtotalCents, discount_cents: discountCents } = pricing;
  const extras = purchaseExtras(formData);

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
    subtotal_cents: subtotalCents,
    discount_cents: discountCents,
    coupon_code: extras.coupon_code,
    membership_id: extras.membership_id,
    petlove_club: false,
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

export async function createProductReview(purchaseId: string, formData: FormData) {
  const scores = ["quality_score", "acceptance_score", "cost_benefit_score"].map((name) => Number(value(formData, name)));
  if (!scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5)) {
    redirect(`/shopping/reviews/new?purchase=${purchaseId}&error=Informe%20as%20tr%C3%AAs%20notas%20de%201%20a%205.`);
  }

  const { supabase, household } = await authContext();
  const { data: purchaseRow, error: purchaseError } = await supabase
    .from("purchases")
    .select("*")
    .eq("id", purchaseId)
    .eq("household_id", household.id)
    .maybeSingle();
  if (purchaseError) redirect(`/shopping/reviews/new?purchase=${purchaseId}&error=${encodeURIComponent(purchaseError.message)}`);
  if (!purchaseRow) redirect("/shopping?error=Compra%20n%C3%A3o%20encontrada.");

  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const purchaseDay = String(purchaseRow.purchased_at).slice(0, 10);
  const reviewResult = await supabase.from("product_reviews").insert({
    household_id: household.id,
    product_id: purchaseRow.product_id,
    pet_id: petId,
    quality_score: scores[0],
    acceptance_score: scores[1],
    cost_benefit_score: scores[2],
    would_buy_again: formData.get("would_buy_again") === "on",
    notes: value(formData, "review_notes") || null,
    reviewed_at: `${purchaseDay}T12:00:00-03:00`,
  }).select("id").single();
  if (reviewResult.error) redirect(`/shopping/reviews/new?purchase=${purchaseId}&error=${encodeURIComponent(reviewResult.error.message)}`);

  try {
    await validateEntityPets(supabase, household.id, petIds);
    if (reviewResult.data) await syncEntityPets(supabase, "review_pets", household.id, reviewResult.data.id, petIds);
  } catch (petError) {
    if (reviewResult.data) await supabase.from("product_reviews").delete().eq("id", reviewResult.data.id).eq("household_id", household.id);
    redirect(`/shopping/reviews/new?purchase=${purchaseId}&error=${encodeURIComponent(petError instanceof Error ? petError.message : "Não foi possível vincular os pets.")}`);
  }

  revalidatePath("/shopping");
  redirect("/shopping?saved=1&review=done");
}
