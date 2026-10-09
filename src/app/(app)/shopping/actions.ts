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
import { findPurchaseProductReviewId, getProduct, getPurchase, loadProductHistoryRefs } from "@/lib/commerce";
import { syncEntityPets, validateEntityPets } from "@/lib/entity-pets";
import { civilDateInAppTz, validateFactualCivilDate } from "@/lib/factual-datetime";
import { ensureHousehold } from "@/lib/households";
import { REVIEW_NOT_FOUND_MESSAGE, updateHouseholdRow, updateProductReviewWithPets } from "@/lib/household-row-update";
import {
  planCompoundPurchaseCreate,
  planPurchaseInsertCollision,
  shouldCompensateDeleteExpense,
} from "@/lib/purchase-create-idempotency";
import { productHasCommerceHistory, type ProductHistoryRefs } from "@/lib/product-delete-guard";
import { createOrReuseCatalogProduct, parseProductCatalogFields, productCreatedRedirect } from "@/lib/product-catalog";
import { PRODUCT_NOT_FOUND_MESSAGE, isProductArchived, productSelectableForNewPurchase } from "@/lib/product-lifecycle";
import { PRODUCT_ARCHIVED_REVIEW_MESSAGE, productStandaloneReviewPath } from "@/lib/product-review-entry";
import {
  REVIEW_PURCHASE_CONTEXT_MESSAGE,
  buildProductReviewInsert,
  existingReviewEditPath,
  isPurchaseContextViolation,
  planPurchaseReviewCreate,
} from "@/lib/product-review-link";
import { resolvePurchaseReviewProductId } from "@/lib/purchase-read-model";
import { assertCanEdit } from "@/lib/roles";
import { parsePetIds, resolveOptionalPetId, sharedFromPetIds } from "@/lib/pet-form";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseCategory, Product, ProductCategory, PurchaseChannel } from "@/types/database";

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
  revalidatePath("/assistant");
  return { ok: true, redirectTo };
}

function revalidateReviewSurfaces() {
  revalidatePath("/shopping");
  revalidatePath("/assistant");
}

type PurchaseAuth = Awaited<ReturnType<typeof authContext>>;

/**
 * Inline review written with the Purchase: always linked through purchase_id.
 * If another Review already owns this Purchase + Product, it is kept untouched (no duplicate).
 */
async function ensurePurchaseReview(args: {
  supabase: PurchaseAuth["supabase"];
  householdId: string;
  purchaseId: string;
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
    let linkedReviewId: string | null;
    try {
      linkedReviewId = await findPurchaseProductReviewId(args.supabase, args.householdId, args.purchaseId, args.productId);
    } catch (lookupError) {
      return { ok: false, error: lookupError instanceof Error ? lookupError.message : "Não foi possível conferir a avaliação." };
    }
    if (planPurchaseReviewCreate(linkedReviewId ? { id: linkedReviewId } : null).action === "edit_existing") return null;

    const { error: reviewError } = await args.supabase.from("product_reviews").insert(buildProductReviewInsert({
      id: args.reviewId,
      householdId: args.householdId,
      productId: args.productId,
      purchaseId: args.purchaseId,
      petId: args.petId,
      scores: args.scores,
      wouldBuyAgain: args.wouldBuyAgain,
      notes: args.notes,
      reviewedAt: args.reviewedAt,
    }));
    if (reviewError) {
      if (isPurchaseContextViolation(reviewError)) return { ok: false, error: REVIEW_PURCHASE_CONTEXT_MESSAGE };
      if (!isUniqueViolation(reviewError)) return { ok: false, error: reviewError.message };
      // 23505: either our own retry (same review id) or another Review owns Purchase + Product.
      const { data: ownRow } = await args.supabase.from("product_reviews").select("id").eq("id", args.reviewId).eq("household_id", args.householdId).maybeSingle();
      if (!ownRow) return null;
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
    const parsed = parseProductCatalogFields((name) => value(formData, name));
    if (!parsed.ok) return parsed;
    const created = await createOrReuseCatalogProduct(supabase, household.id, newProductId, parsed.fields);
    if (!created.ok) return created;
    product = created.product;
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
        purchaseId,
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

  // NEW Purchase only: stale client state must not buy an archived Product (no silent restore).
  const selectable = productSelectableForNewPurchase(product, household.id);
  if (!selectable.ok) return { ok: false, error: selectable.error };
  product = selectable.product;

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
      const collision = planPurchaseInsertCollision(retry, expenseInsertedThisAttempt);
      if (collision.action === "reuse") {
        if (hasAnyScore && !hasAllScores) return finishPurchase(`/shopping?saved=1&review=partial&purchase=${purchaseId}`);
        if (hasAllScores) {
          if (!isUuid(reviewId)) return { ok: false, error: invalidIntentErrorMessage() };
          const reviewError = await ensurePurchaseReview({
            supabase,
            householdId: household.id,
            purchaseId,
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
      if (collision.compensateExpense) {
        await supabase.from("expenses").delete().eq("id", expenseId).eq("household_id", household.id);
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
      purchaseId,
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
  revalidatePath("/assistant");
  redirect("/shopping?updated=1");
}

export async function deletePurchase(purchaseId: string) {
  const { supabase, household } = await authContext();
  const existing = await supabase.from("purchases").select("expense_id").eq("id", purchaseId).eq("household_id", household.id).maybeSingle();
  const { error } = await supabase.from("purchases").delete().eq("id", purchaseId).eq("household_id", household.id);
  if (error) redirect(`/shopping?error=${encodeURIComponent(error.message)}`);
  if (existing.data?.expense_id) await supabase.from("expenses").delete().eq("id", existing.data.expense_id).eq("household_id", household.id);
  // Linked Reviews survive: the DB sets product_reviews.purchase_id to NULL (0038 FK).
  revalidatePath("/shopping");
  revalidatePath("/expenses");
  revalidatePath("/assistant");
  redirect("/shopping?deleted=1");
}

export async function updateProduct(productId: string, formData: FormData) {
  const parsed = parseProductCatalogFields((name) => value(formData, name));
  if (!parsed.ok) redirect(`/shopping/products/${productId}/edit?error=Confira%20nome%20e%20categoria.`);
  const { supabase, household } = await authContext();
  const updated = await updateHouseholdRow(supabase, "products", productId, household.id, {
    ...parsed.fields,
    updated_at: new Date().toISOString(),
  });
  if (!updated.ok) {
    if (updated.reason === "not_found") redirect(`/shopping?error=${encodeURIComponent(PRODUCT_NOT_FOUND_MESSAGE)}`);
    redirect(`/shopping/products/${productId}/edit?error=${encodeURIComponent(updated.message)}`);
  }
  revalidatePath("/shopping");
  revalidatePath("/shopping/new");
  revalidatePath("/assistant");
  redirect("/shopping?updated=1");
}

export async function deleteProduct(productId: string) {
  const { supabase, household } = await authContext();
  let refs: ProductHistoryRefs;
  try {
    refs = await loadProductHistoryRefs(supabase, household.id, productId);
  } catch (refsError) {
    redirect(`/shopping?error=${encodeURIComponent(refsError instanceof Error ? refsError.message : "Não foi possível conferir o histórico do produto.")}`);
  }
  if (productHasCommerceHistory(refs)) {
    // History blocks destructive delete; the edit screen offers "Arquivar produto" instead.
    redirect(`/shopping/products/${productId}/edit?blocked=history`);
  }
  const { error } = await supabase.from("products").delete().eq("id", productId).eq("household_id", household.id);
  if (error) redirect(`/shopping?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/shopping");
  revalidatePath("/shopping/new");
  revalidatePath("/assistant");
  revalidatePath("/expenses");
  redirect("/shopping?deleted=1");
}

function revalidateProductLifecycle(productId: string) {
  revalidatePath("/shopping");
  revalidatePath("/shopping/new");
  revalidatePath("/assistant");
  revalidatePath(`/shopping/products/${productId}/edit`);
}

/** Archive: archived_at = now. Never deletes and never touches Purchases, items, Reviews or Expenses. */
export async function archiveProduct(productId: string) {
  if (!isUuid(productId)) redirect(`/shopping?error=${encodeURIComponent(PRODUCT_NOT_FOUND_MESSAGE)}`);
  const { supabase, household } = await authContext();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("products")
    .update({ archived_at: now, updated_at: now })
    .eq("id", productId)
    .eq("household_id", household.id)
    .is("archived_at", null)
    .select("id");
  if (error) redirect(`/shopping/products/${productId}/edit?error=${encodeURIComponent(error.message)}`);
  if (!data?.length && !(await getProduct(supabase, household.id, productId))) {
    redirect(`/shopping?error=${encodeURIComponent(PRODUCT_NOT_FOUND_MESSAGE)}`);
  }
  revalidateProductLifecycle(productId);
  redirect("/shopping?archived=1");
}

/** Restore: archived_at = NULL on the same row — back in catalog, picker and recommendations. */
export async function restoreProduct(productId: string) {
  if (!isUuid(productId)) redirect(`/shopping?error=${encodeURIComponent(PRODUCT_NOT_FOUND_MESSAGE)}`);
  const { supabase, household } = await authContext();
  const { data, error } = await supabase
    .from("products")
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("household_id", household.id)
    .not("archived_at", "is", null)
    .select("id");
  if (error) redirect(`/shopping/products/${productId}/edit?error=${encodeURIComponent(error.message)}`);
  if (!data?.length && !(await getProduct(supabase, household.id, productId))) {
    redirect(`/shopping?error=${encodeURIComponent(PRODUCT_NOT_FOUND_MESSAGE)}`);
  }
  revalidateProductLifecycle(productId);
  redirect("/shopping?restored=1");
}

export async function updateProductReview(reviewId: string, formData: FormData) {
  const scores = ["quality_score", "acceptance_score", "cost_benefit_score"].map((name) => Number(value(formData, name)));
  if (!scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5)) redirect(`/shopping/reviews/${reviewId}/edit?error=Informe%20as%20tr%C3%AAs%20notas%20de%201%20a%205.`);
  const { supabase, household } = await authContext();
  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const updated = await updateProductReviewWithPets(supabase, household.id, reviewId, {
    pet_id: petId,
    quality_score: scores[0],
    acceptance_score: scores[1],
    cost_benefit_score: scores[2],
    would_buy_again: formData.get("would_buy_again") === "on",
    notes: value(formData, "review_notes") || null,
    updated_at: new Date().toISOString(),
  }, petIds);
  if (!updated.ok) {
    if (updated.reason === "not_found") redirect(`/shopping?error=${encodeURIComponent(REVIEW_NOT_FOUND_MESSAGE)}`);
    redirect(`/shopping/reviews/${reviewId}/edit?error=${encodeURIComponent(updated.message)}`);
  }
  revalidateReviewSurfaces();
  redirect("/shopping?updated=1");
}

export async function deleteProductReview(reviewId: string) {
  const { supabase, household } = await authContext();
  const { error } = await supabase.from("product_reviews").delete().eq("id", reviewId).eq("household_id", household.id);
  if (error) redirect(`/shopping?error=${encodeURIComponent(error.message)}`);
  revalidateReviewSurfaces();
  redirect("/shopping?deleted=1");
}

/**
 * Deferred review from a Purchase. Idempotent per (purchase_id, product_id): an existing Review
 * is opened for exact edit instead of inserting a duplicate (also on a concurrent double submit,
 * where the 0038 partial unique index rejects the second insert).
 */
export async function createProductReview(purchaseId: string, formData: FormData) {
  const requestedProductId = value(formData, "product_id") || null;
  const retryPath = `/shopping/reviews/new?purchase=${purchaseId}${requestedProductId ? `&product=${requestedProductId}` : ""}`;
  const scores = ["quality_score", "acceptance_score", "cost_benefit_score"].map((name) => Number(value(formData, name)));
  if (!scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5)) {
    redirect(`${retryPath}&error=Informe%20as%20tr%C3%AAs%20notas%20de%201%20a%205.`);
  }
  if (!isUuid(purchaseId) || (requestedProductId && !isUuid(requestedProductId))) redirect("/shopping?error=Compra%20n%C3%A3o%20encontrada.");

  const { supabase, household } = await authContext();
  let purchase: Awaited<ReturnType<typeof getPurchase>>;
  try {
    purchase = await getPurchase(supabase, household.id, purchaseId);
  } catch (purchaseError) {
    redirect(`${retryPath}&error=${encodeURIComponent(purchaseError instanceof Error ? purchaseError.message : "Não foi possível carregar a compra.")}`);
  }
  if (!purchase) redirect("/shopping?error=Compra%20n%C3%A3o%20encontrada.");

  const target = resolvePurchaseReviewProductId(purchase, requestedProductId);
  if (!target.ok) redirect(`${retryPath}&error=${encodeURIComponent(target.error)}`);

  let existingReviewId: string | null;
  try {
    existingReviewId = await findPurchaseProductReviewId(supabase, household.id, purchase.id, target.productId);
  } catch (lookupError) {
    redirect(`${retryPath}&error=${encodeURIComponent(lookupError instanceof Error ? lookupError.message : "Não foi possível conferir a avaliação.")}`);
  }
  const plan = planPurchaseReviewCreate(existingReviewId ? { id: existingReviewId } : null);
  if (plan.action === "edit_existing") redirect(existingReviewEditPath(plan.reviewId));

  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const purchaseDay = civilDateInAppTz(new Date(purchase.purchased_at));
  const reviewResult = await supabase.from("product_reviews").insert(buildProductReviewInsert({
    householdId: household.id,
    productId: target.productId,
    purchaseId: purchase.id,
    petId,
    scores,
    wouldBuyAgain: formData.get("would_buy_again") === "on",
    notes: value(formData, "review_notes") || null,
    reviewedAt: `${purchaseDay}T12:00:00-03:00`,
  })).select("id").single();
  if (reviewResult.error) {
    if (isUniqueViolation(reviewResult.error)) {
      const winnerId = await findPurchaseProductReviewId(supabase, household.id, purchase.id, target.productId).catch(() => null);
      if (winnerId) redirect(existingReviewEditPath(winnerId));
    }
    if (isPurchaseContextViolation(reviewResult.error)) redirect(`${retryPath}&error=${encodeURIComponent(REVIEW_PURCHASE_CONTEXT_MESSAGE)}`);
    redirect(`${retryPath}&error=${encodeURIComponent(reviewResult.error.message)}`);
  }

  try {
    await validateEntityPets(supabase, household.id, petIds);
    await syncEntityPets(supabase, "review_pets", household.id, reviewResult.data.id, petIds);
  } catch (petError) {
    await supabase.from("product_reviews").delete().eq("id", reviewResult.data.id).eq("household_id", household.id);
    redirect(`${retryPath}&error=${encodeURIComponent(petError instanceof Error ? petError.message : "Não foi possível vincular os pets.")}`);
  }

  revalidateReviewSurfaces();
  redirect("/shopping?review=done");
}

export type CreateProductResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

/** Catalog-only create: one form mount = one product_id intent. No Purchase, Expense or Review. */
export async function createProduct(formData: FormData): Promise<CreateProductResult> {
  const productId = value(formData, "product_id");
  if (!isUuid(productId)) return { ok: false, error: invalidIntentErrorMessage() };
  const parsed = parseProductCatalogFields((name) => value(formData, name));
  if (!parsed.ok) return parsed;
  const { supabase, household } = await authContext();
  const created = await createOrReuseCatalogProduct(supabase, household.id, productId, parsed.fields);
  if (!created.ok) return created;
  revalidatePath("/shopping");
  revalidatePath("/shopping/new");
  revalidatePath("/assistant");
  return { ok: true, redirectTo: productCreatedRedirect(created.product.id) };
}

/**
 * Product-level Review with no Purchase origin (purchase_id NULL). One page render = one
 * review_id intent, so a double submit reuses the row instead of inserting a second Review.
 */
export async function createStandaloneProductReview(productId: string, formData: FormData) {
  const retryPath = productStandaloneReviewPath(productId);
  const scores = ["quality_score", "acceptance_score", "cost_benefit_score"].map((name) => Number(value(formData, name)));
  if (!scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5)) {
    redirect(`${retryPath}&error=Informe%20as%20tr%C3%AAs%20notas%20de%201%20a%205.`);
  }
  if (!isUuid(productId)) redirect(`/shopping?error=${encodeURIComponent(PRODUCT_NOT_FOUND_MESSAGE)}`);
  const reviewId = value(formData, "review_id");
  if (!isUuid(reviewId)) redirect(`${retryPath}&error=${encodeURIComponent(invalidIntentErrorMessage())}`);

  const { supabase, household } = await authContext();
  const { data: existingReview } = await supabase.from("product_reviews").select("id, household_id").eq("id", reviewId).maybeSingle();
  const ownership = resolveHouseholdCreateOwnership(reviewId, household.id, existingReview);
  if (!ownership.ok) {
    redirect(`${retryPath}&error=${encodeURIComponent(ownership.reason === "foreign_household" ? foreignIntentErrorMessage() : invalidIntentErrorMessage())}`);
  }
  if (ownership.status === "reuse") {
    revalidateReviewSurfaces();
    redirect("/shopping?review=done");
  }

  let product: Awaited<ReturnType<typeof getProduct>>;
  try {
    product = await getProduct(supabase, household.id, productId);
  } catch (productError) {
    redirect(`${retryPath}&error=${encodeURIComponent(productError instanceof Error ? productError.message : "Não foi possível carregar o produto.")}`);
  }
  if (!product) redirect(`/shopping?error=${encodeURIComponent(PRODUCT_NOT_FOUND_MESSAGE)}`);
  if (isProductArchived(product)) redirect(`/shopping/products/${productId}/edit?error=${encodeURIComponent(PRODUCT_ARCHIVED_REVIEW_MESSAGE)}`);

  const petIds = parsePetIds(formData);
  const petId = resolveOptionalPetId(petIds);
  const { error: insertError } = await supabase.from("product_reviews").insert(buildProductReviewInsert({
    id: reviewId,
    householdId: household.id,
    productId: product.id,
    purchaseId: null,
    petId,
    scores,
    wouldBuyAgain: formData.get("would_buy_again") === "on",
    notes: value(formData, "review_notes") || null,
    reviewedAt: `${civilDateInAppTz()}T12:00:00-03:00`,
  }));
  if (insertError) {
    if (!isUniqueViolation(insertError)) redirect(`${retryPath}&error=${encodeURIComponent(insertError.message)}`);
    const { data: ownRow } = await supabase.from("product_reviews").select("id").eq("id", reviewId).eq("household_id", household.id).maybeSingle();
    if (!ownRow) redirect(`${retryPath}&error=${encodeURIComponent(foreignIntentErrorMessage())}`);
    revalidateReviewSurfaces();
    redirect("/shopping?review=done");
  }

  try {
    await validateEntityPets(supabase, household.id, petIds);
    await syncEntityPets(supabase, "review_pets", household.id, reviewId, petIds);
  } catch (petError) {
    await supabase.from("product_reviews").delete().eq("id", reviewId).eq("household_id", household.id);
    redirect(`${retryPath}&error=${encodeURIComponent(petError instanceof Error ? petError.message : "Não foi possível vincular os pets.")}`);
  }

  revalidateReviewSurfaces();
  revalidatePath(`/shopping/products/${productId}/edit`);
  redirect("/shopping?review=done");
}
