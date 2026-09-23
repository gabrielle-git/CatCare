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
import {
  planCompoundPurchaseCreate,
  shouldCompensateDeleteExpense,
} from "@/lib/purchase-create-idempotency";
import {
  PRODUCT_DELETE_HISTORY_MESSAGE,
  productHasCommerceHistory,
} from "@/lib/product-delete-guard";
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

type PurchaseAuth = Awaited<ReturnType<typeof authContext>>;

async function ensurePurchaseReview(args: {
  supabase: PurchaseAuth["supabase"];
  householdId: string;
  reviewId: string;
  productId: string;
  petId: string | null;
  petIds: string[];
  scores: number[];
  wouldBuyAgain: boolean;
  notes: string | null;
  reviewedAt: string;
}): Promise<CreatePurchaseResult | null> {
  const { data: existingReview } = await args.supabase
    .from("product_reviews")
    .select("id, household_id")
    .eq("id", args.reviewId)
    .maybeSingle();
  const reviewOwnership = resolveHouseholdCreateOwnership(args.reviewId, args.householdId, existingReview);
  if (!reviewOwnership.ok) {
    return {
      ok: false,
      error: reviewOwnership.reason === "foreign_household" ? foreignIntentErrorMessage() : invalidIntentErrorMessage(),
    };
  }
  if (reviewOwnership.status === "create") {
    const { error: reviewError } = await args.supabase.from("product_reviews").insert({
      id: args.reviewId,
      household_id: args.householdId,
      product_id: args.productId,
      pet_id: args.petId,
      quality_score: args.scores[0],
      acceptance_score: args.scores[1],
      cost_benefit_score: args.scores[2],
      would_buy_again: args.wouldBuyAgain,
      notes: args.notes,
      reviewed_at: args.reviewedAt,
    });
    if (reviewError && !isUniqueViolation(reviewError)) {
      return { ok: false, error: reviewError.message };
    }
  }
  await syncEntityPets(args.supabase, "review_pets", args.householdId, args.reviewId, args.petIds);
  return null;
}

/**
 * Idempotent purchase create: one intent → stable purchase_id + expense_id
 * (+ product_id when creating a new product, review_id when scoring).
 * Order: auth → purchase ownership → product → expense create/reuse → purchase → optional review.
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

  const [{ data: existingPurchase }, { data: existingExpense }] = await Promise.all([
    supabase.from("purchases").select("id, household_id, expense_id").eq("id", purchaseId).maybeSingle(),
    supabase.from("expenses").select("id, household_id").eq("id", expenseId).maybeSingle(),
  ]);

  const purchasePlan = planCompoundPurchaseCreate(
    purchaseId,
    expenseId,
    household.id,
    existingPurchase,
    existingExpense,
  );
  if (!purchasePlan.ok) {
    return {
      ok: false,
      error: purchasePlan.reason === "foreign_household" ? foreignIntentErrorMessage() : invalidIntentErrorMessage(),
    };
  }

  const scores = ["quality_score", "acceptance_score", "cost_benefit_score"].map((name) => Number(value(formData, name)));
  const hasAnyScore = scores.some((score) => Number.isFinite(score) && score > 0);
  const hasAllScores = scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5);
  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const reviewId = value(formData, "review_id");

  const selectedProductId = value(formData, "product_id");
  let product: Product | null = null;

  async function loadProductLinkedToPurchase(): Promise<Product | null> {
    const linked = await supabase
      .from("purchases")
      .select("product_id")
      .eq("id", purchaseId)
      .eq("household_id", household.id)
      .maybeSingle();
    if (!linked.data?.product_id) return null;
    const result = await supabase
      .from("products")
      .select("*")
      .eq("id", linked.data.product_id)
      .eq("household_id", household.id)
      .maybeSingle();
    return (result.data as Product | null) ?? null;
  }

  async function resolveOrCreateNewProduct(): Promise<CreatePurchaseResult | null> {
    const newProductId = value(formData, "new_product_id");
    if (!isUuid(newProductId)) return { ok: false, error: invalidIntentErrorMessage() };
    const name = value(formData, "product_name");
    const category = value(formData, "category") as ProductCategory;
    if (!name || !productCategories.has(category)) {
      return { ok: false, error: "Dê um nome e uma categoria ao novo produto." };
    }

    const { data: existingProduct } = await supabase.from("products").select("*").eq("id", newProductId).maybeSingle();
    const productOwnership = resolveHouseholdCreateOwnership(newProductId, household.id, existingProduct);
    if (!productOwnership.ok) {
      return {
        ok: false,
        error: productOwnership.reason === "foreign_household" ? foreignIntentErrorMessage() : invalidIntentErrorMessage(),
      };
    }
    if (productOwnership.status === "reuse") {
      product = existingProduct as Product;
      return null;
    }

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
        if (retry.ok && retry.status === "reuse") {
          product = again as Product;
          return null;
        }
        return { ok: false, error: foreignIntentErrorMessage() };
      }
      return { ok: false, error: result.error.message };
    }
    product = result.data as Product;
    return null;
  }

  // Purchase already complete: still close optional review gap from a prior partial.
  if (purchasePlan.purchase === "reuse") {
    if (hasAnyScore && !hasAllScores) {
      return finishPurchase(`/shopping?saved=1&review=partial&purchase=${purchaseId}`);
    }
    if (hasAllScores && purchasePlan.ensureReviewIfScored) {
      if (!isUuid(reviewId)) return { ok: false, error: invalidIntentErrorMessage() };
      product = await loadProductLinkedToPurchase();
      if (!product) return { ok: false, error: "Produto não encontrado." };
      const reviewError = await ensurePurchaseReview({
        supabase,
        householdId: household.id,
        reviewId,
        productId: product.id,
        petId,
        petIds,
        scores,
        wouldBuyAgain: formData.get("would_buy_again") === "on",
        notes: value(formData, "review_notes") || null,
        reviewedAt: `${purchasedOn}T12:00:00-03:00`,
      });
      if (reviewError) return reviewError;
      return finishPurchase("/shopping?saved=1");
    }
    return finishPurchase(`/shopping?saved=1&review=pending&purchase=${purchaseId}`);
  }

  if (selectedProductId) {
    if (!isUuid(selectedProductId)) return { ok: false, error: "Produto inválido." };
    const result = await supabase.from("products").select("*").eq("id", selectedProductId).eq("household_id", household.id).maybeSingle();
    if (result.error) return { ok: false, error: result.error.message };
    product = result.data as Product | null;
  } else {
    const created = await resolveOrCreateNewProduct();
    if (created) return created;
  }

  if (!product) return { ok: false, error: "Produto não encontrado." };

  const description = [product.brand, product.name].filter(Boolean).join(" • ");
  const expenseNotes = `Compra em ${storeName}`;
  let expenseInsertedThisAttempt = false;

  if (purchasePlan.expense === "create") {
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
        // 23505 reuse — do NOT mark as inserted this attempt (must not compensate-delete).
      } else {
        return { ok: false, error: expenseError.message };
      }
    } else {
      expenseInsertedThisAttempt = true;
    }
  }

  try {
    await validateEntityPets(supabase, household.id, petIds);
    await syncEntityPets(supabase, "expense_pets", household.id, expenseId, petIds);
  } catch (petError) {
    if (shouldCompensateDeleteExpense(expenseInsertedThisAttempt)) {
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
        if (hasAllScores) {
          if (!isUuid(reviewId)) return { ok: false, error: invalidIntentErrorMessage() };
          const reviewError = await ensurePurchaseReview({
            supabase,
            householdId: household.id,
            reviewId,
            productId: product.id,
            petId,
            petIds,
            scores,
            wouldBuyAgain: formData.get("would_buy_again") === "on",
            notes: value(formData, "review_notes") || null,
            reviewedAt: `${purchasedOn}T12:00:00-03:00`,
          });
          if (reviewError) return reviewError;
          return finishPurchase("/shopping?saved=1");
        }
        return finishPurchase(`/shopping?saved=1&review=pending&purchase=${purchaseId}`);
      }
      return { ok: false, error: foreignIntentErrorMessage() };
    }
    if (shouldCompensateDeleteExpense(expenseInsertedThisAttempt)) {
      await supabase.from("expenses").delete().eq("id", expenseId).eq("household_id", household.id);
    }
    return { ok: false, error: purchaseError.message };
  }

  await syncEntityPets(supabase, "purchase_pets", household.id, purchaseId, petIds);

  if (hasAnyScore && !hasAllScores) {
    return finishPurchase(`/shopping?saved=1&review=partial&purchase=${purchaseId}`);
  }

  if (hasAllScores) {
    if (!isUuid(reviewId)) return { ok: false, error: invalidIntentErrorMessage() };
    const reviewError = await ensurePurchaseReview({
      supabase,
      householdId: household.id,
      reviewId,
      productId: product.id,
      petId,
      petIds,
      scores,
      wouldBuyAgain: formData.get("would_buy_again") === "on",
      notes: value(formData, "review_notes") || null,
      reviewedAt: `${purchasedOn}T12:00:00-03:00`,
    });
    if (reviewError) return reviewError;
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
  const [headerPurchases, itemRefs, reviewRefs] = await Promise.all([
    supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("household_id", household.id),
    supabase
      .from("purchase_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("household_id", household.id),
    supabase
      .from("product_reviews")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("household_id", household.id),
  ]);
  if (headerPurchases.error) redirect(`/shopping?error=${encodeURIComponent(headerPurchases.error.message)}`);
  if (itemRefs.error) redirect(`/shopping?error=${encodeURIComponent(itemRefs.error.message)}`);
  if (reviewRefs.error) redirect(`/shopping?error=${encodeURIComponent(reviewRefs.error.message)}`);
  if (
    productHasCommerceHistory({
      headerPurchaseCount: headerPurchases.count ?? 0,
      purchaseItemCount: itemRefs.count ?? 0,
      reviewCount: reviewRefs.count ?? 0,
    })
  ) {
    redirect(`/shopping?error=${encodeURIComponent(PRODUCT_DELETE_HISTORY_MESSAGE)}`);
  }
  const { error } = await supabase.from("products").delete().eq("id", productId).eq("household_id", household.id);
  if (error) redirect(`/shopping?error=${encodeURIComponent(error.message)}`);
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
