import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  PRODUCT_ARCHIVED_FOR_PURCHASE_MESSAGE,
  PRODUCT_NOT_FOUND_MESSAGE,
  activeProducts,
  isProductActive,
  productLifecycleOptions,
  productSelectableForNewPurchase,
  splitProductsByLifecycle,
} from "@/lib/product-lifecycle";
import {
  buildProductReviewInsert,
  existingReviewEditPath,
  isPurchaseContextViolation,
  latestProductReview,
  planPurchaseReviewCreate,
} from "@/lib/product-review-link";
import {
  buildPurchaseReadModel,
  findLinkedReviewForPurchase,
  findReviewForPurchaseProduct,
  resolvePurchaseReviewProductId,
  type PurchaseItemRow,
} from "@/lib/purchase-read-model";
import {
  BEST_VALUE_MIN_SCORE,
  bestValueRecommendation,
  qualifiedProductRecommendations,
} from "@/lib/recommendations";
import type { Product, ProductReview, Purchase } from "@/types/database";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const HOUSEHOLD = "11111111-1111-4111-8111-111111111111";
const OTHER_HOUSEHOLD = "12121212-1212-4121-8121-121212121212";
const PURCHASE_A = "22222222-2222-4222-8222-222222222222";
const PURCHASE_B = "33333333-3333-4333-8333-333333333333";
const PRODUCT_A = "44444444-4444-4444-8444-444444444444";
const PRODUCT_B = "55555555-5555-4555-8555-555555555555";
const PRODUCT_C = "56565656-5656-4565-8565-565656565656";
const ITEM_1 = "66666666-6666-4666-8666-666666666666";
const ITEM_2 = "77777777-7777-4777-8777-777777777777";
const REVIEW_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REVIEW_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: PRODUCT_A,
    household_id: HOUSEHOLD,
    name: "Ração Alpha",
    brand: "Marca A",
    category: "dry_food",
    package_size: "1kg",
    notes: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: PURCHASE_A,
    household_id: HOUSEHOLD,
    product_id: PRODUCT_A,
    pet_id: null,
    pet_ids: [],
    expense_id: null,
    store_name: "Pet Shop",
    channel: "physical_store",
    quantity: 1,
    amount_cents: 5000,
    subtotal_cents: 5000,
    discount_cents: 0,
    shipping_cents: 0,
    credits_applied_cents: 0,
    discount_rate_bps: null,
    coupon_code: null,
    petlove_club: false,
    membership_id: null,
    purchased_at: "2026-09-20T12:00:00-03:00",
    product_url: null,
    notes: null,
    created_at: "2026-09-20T12:00:00-03:00",
    ...overrides,
  };
}

function item(overrides: Partial<PurchaseItemRow> = {}): PurchaseItemRow {
  return {
    id: ITEM_1,
    household_id: HOUSEHOLD,
    purchase_id: PURCHASE_A,
    product_id: PRODUCT_A,
    product_name: "Ração Alpha",
    brand: "Marca A",
    category: "dry_food",
    package_size: "1kg",
    quantity: 1,
    unit_price_cents: 5000,
    line_subtotal_cents: 5000,
    position: 0,
    notes: null,
    created_at: "2026-09-20T12:00:00-03:00",
    ...overrides,
  } as PurchaseItemRow;
}

function review(overrides: Partial<ProductReview> = {}): ProductReview {
  return {
    id: REVIEW_A,
    household_id: HOUSEHOLD,
    product_id: PRODUCT_A,
    purchase_id: PURCHASE_A,
    pet_id: null,
    quality_score: 5,
    acceptance_score: 5,
    cost_benefit_score: 5,
    would_buy_again: true,
    notes: null,
    reviewed_at: "2026-09-21T12:00:00-03:00",
    created_at: "2026-09-21T12:00:00-03:00",
    updated_at: "2026-09-21T12:00:00-03:00",
    ...overrides,
  };
}

const ARCHIVED_AT = "2026-09-25T10:00:00Z";

describe("commerce lifecycle app — Product lifecycle", () => {
  it("A: archived Products are excluded from the active catalog and the new-Purchase picker", () => {
    const active = product();
    const archived = product({ id: PRODUCT_B, name: "Areia Beta", archived_at: ARCHIVED_AT });
    const split = splitProductsByLifecycle([active, archived]);
    assert.deepEqual(split.active.map((item) => item.id), [PRODUCT_A]);
    assert.deepEqual(split.archived.map((item) => item.id), [PRODUCT_B]);
    assert.deepEqual(activeProducts([active, archived]).map((item) => item.id), [PRODUCT_A]);

    const commerce = read("src/lib/commerce.ts");
    assert.match(commerce, /catalogProducts: active/);
    assert.match(read("src/app/(app)/shopping/new/page.tsx"), /catalogProducts: products/);
    assert.match(read("src/app/(app)/shopping/page.tsx"), /catalogProducts: products/);
  });

  it("B: archived Products stay resolvable for history (Purchase lines, getProduct, no global filter)", () => {
    const archived = product({ archived_at: ARCHIVED_AT, name: "Ração Antiga" });
    const model = buildPurchaseReadModel(purchase(), [], new Map(), new Map([[PRODUCT_A, archived]]));
    assert.equal(model.lines[0].product_name, "Ração Antiga");

    const commerce = read("src/lib/commerce.ts");
    // No global archived filter anywhere in the loader layer.
    assert.doesNotMatch(commerce, /\.is\(\s*["']archived_at["']\s*,\s*null\s*\)/);
    // Purchase read models resolve against the FULL Product map.
    assert.match(commerce, /toPurchaseReadModels\(supabase, householdId, purchasesWithPets, productRows\)/);
    const getProductBody = commerce.slice(commerce.indexOf("export async function getProduct"), commerce.indexOf("export async function loadProductHistoryRefs"));
    assert.doesNotMatch(getProductBody, /archived_at/);
  });

  it("C: an archived Product is rejected server-side for a NEW Purchase (structured, no reactivation)", () => {
    const archived = product({ archived_at: ARCHIVED_AT });
    assert.deepEqual(productSelectableForNewPurchase(archived, HOUSEHOLD), { ok: false, error: PRODUCT_ARCHIVED_FOR_PURCHASE_MESSAGE });
    assert.deepEqual(productSelectableForNewPurchase(product(), OTHER_HOUSEHOLD), { ok: false, error: PRODUCT_NOT_FOUND_MESSAGE });
    assert.deepEqual(productSelectableForNewPurchase(null, HOUSEHOLD), { ok: false, error: PRODUCT_NOT_FOUND_MESSAGE });
    assert.equal(productSelectableForNewPurchase(product(), HOUSEHOLD).ok, true);

    const actions = read("src/app/(app)/shopping/actions.ts");
    const create = actions.slice(actions.indexOf("export async function createPurchase"), actions.indexOf("export async function updatePurchase"));
    const guardIdx = create.indexOf("productSelectableForNewPurchase(product, household.id)");
    const insertIdx = create.indexOf('from("purchases").insert');
    assert.ok(guardIdx >= 0 && insertIdx > guardIdx, "guard must run before the Purchase insert");
    assert.match(create, /if \(!selectable\.ok\) return \{ ok: false, error: selectable\.error \}/);
    // The guard never flips archived_at back.
    assert.doesNotMatch(create, /archived_at/);
    // Historical Purchase edit is not guarded by lifecycle.
    const update = actions.slice(actions.indexOf("export async function updatePurchase"), actions.indexOf("export async function deletePurchase"));
    assert.doesNotMatch(update, /productSelectableForNewPurchase|archived_at/);
  });

  it("D: restore returns the Product to the catalog", () => {
    const archived = product({ archived_at: ARCHIVED_AT });
    assert.equal(productLifecycleOptions({ archived: true, hasHistory: true }).canRestore, true);
    const restored = { ...archived, archived_at: null };
    assert.equal(isProductActive(restored), true);
    assert.deepEqual(activeProducts([restored]).map((item) => item.id), [PRODUCT_A]);

    const actions = read("src/app/(app)/shopping/actions.ts");
    const restore = actions.slice(actions.indexOf("export async function restoreProduct"), actions.indexOf("export async function updateProductReview"));
    assert.match(restore, /update\(\{ archived_at: null,/);
    assert.match(restore, /\.eq\("household_id", household\.id\)/);
    assert.match(restore, /revalidateProductLifecycle\(productId\)/);
  });

  it("E: a Product with history takes the archive path, not destructive delete", () => {
    assert.deepEqual(productLifecycleOptions({ archived: false, hasHistory: true }), { canHardDelete: false, canArchive: true, canRestore: false });
    assert.deepEqual(productLifecycleOptions({ archived: false, hasHistory: false }), { canHardDelete: true, canArchive: true, canRestore: false });

    const actions = read("src/app/(app)/shopping/actions.ts");
    const archive = actions.slice(actions.indexOf("export async function archiveProduct"), actions.indexOf("export async function restoreProduct"));
    assert.match(archive, /update\(\{ archived_at: now, updated_at: now \}\)/);
    // Archive never deletes or touches Purchases, items, Reviews or Expenses.
    assert.doesNotMatch(archive, /\.delete\(\)|from\("(purchases|purchase_items|product_reviews|expenses)"\)/);
    const revalidate = actions.slice(actions.indexOf("function revalidateProductLifecycle"), actions.indexOf("export async function archiveProduct"));
    for (const path of ["/shopping", "/shopping/new", "/assistant"]) assert.ok(revalidate.includes(`revalidatePath("${path}")`), path);

    const page = read("src/app/(app)/shopping/page.tsx");
    assert.match(page, /hasHistory\s*\?\s*<form action=\{archiveProduct\.bind/);
    assert.match(page, /Apagar definitivamente/);
    assert.match(page, /Restaurar produto/);
    const edit = read("src/app/(app)/shopping/products/[id]/edit/page.tsx");
    assert.match(edit, /lifecycle\.canHardDelete &&/);
    assert.match(edit, /lifecycle\.canArchive && hasHistory &&/);
    assert.match(edit, /lifecycle\.canRestore &&/);
    // Product edit stays catalog-only: no payment, price, date or Health fields.
    assert.doesNotMatch(edit, /name="(amount|price|unit_price|purchased_on|payment|health)[^"]*"/);
  });
});

describe("commerce lifecycle app — Review ↔ Purchase linkage", () => {
  it("F: a new Purchase Review writes purchase_id", () => {
    const row = buildProductReviewInsert({
      householdId: HOUSEHOLD,
      productId: PRODUCT_A,
      purchaseId: PURCHASE_A,
      petId: null,
      scores: [5, 4, 4],
      wouldBuyAgain: true,
      notes: null,
      reviewedAt: "2026-09-20T12:00:00-03:00",
    });
    assert.equal(row.purchase_id, PURCHASE_A);
    assert.equal(row.product_id, PRODUCT_A);
    assert.equal("id" in row, false);

    const model = buildPurchaseReadModel(purchase(), [], new Map(), new Map([[PRODUCT_A, product()]]));
    assert.deepEqual(resolvePurchaseReviewProductId(model), { ok: true, productId: PRODUCT_A });

    const actions = read("src/app/(app)/shopping/actions.ts");
    assert.match(actions, /buildProductReviewInsert\(\{[\s\S]*?purchaseId: args\.purchaseId/);
    assert.match(actions, /buildProductReviewInsert\(\{[\s\S]*?purchaseId: purchase\.id/);
    assert.equal((actions.match(/purchaseId,\r?\n\s+reviewId,/g) ?? []).length, 3, "all inline ensurePurchaseReview callers pass purchaseId");
  });

  it("G: a standalone Review keeps purchase_id NULL and never links to a Purchase", () => {
    const row = buildProductReviewInsert({
      id: REVIEW_B,
      householdId: HOUSEHOLD,
      productId: PRODUCT_A,
      purchaseId: null,
      petId: null,
      scores: [4, 4, 4],
      wouldBuyAgain: true,
      notes: null,
      reviewedAt: "2026-09-20T12:00:00-03:00",
    });
    assert.equal(row.purchase_id, null);
    const model = buildPurchaseReadModel(purchase(), [], new Map(), new Map([[PRODUCT_A, product()]]));
    // Same Product, same day — the removed soft match would have linked it.
    assert.equal(findLinkedReviewForPurchase(model, [review({ purchase_id: null, reviewed_at: model.purchased_at })]), null);
  });

  it("H: duplicate Purchase + Product resolves the existing Review instead of inserting", () => {
    assert.deepEqual(planPurchaseReviewCreate({ id: REVIEW_A }), { action: "edit_existing", reviewId: REVIEW_A });
    assert.deepEqual(planPurchaseReviewCreate(null), { action: "create" });
    assert.equal(existingReviewEditPath(REVIEW_A), `/shopping/reviews/${REVIEW_A}/edit?existing=1`);
    assert.equal(isPurchaseContextViolation({ code: "23514" }), true);
    assert.equal(isPurchaseContextViolation({ code: "23505" }), false);

    const actions = read("src/app/(app)/shopping/actions.ts");
    const ensure = actions.slice(actions.indexOf("async function ensurePurchaseReview"), actions.indexOf("export async function createPurchase"));
    assert.ok(ensure.indexOf("findPurchaseProductReviewId") < ensure.indexOf('from("product_reviews").insert'));
    assert.match(ensure, /isPurchaseContextViolation\(reviewError\)/);
    assert.match(ensure, /isUniqueViolation\(reviewError\)/);

    const create = actions.slice(actions.indexOf("export async function createProductReview"));
    assert.ok(create.indexOf("planPurchaseReviewCreate") < create.indexOf('from("product_reviews").insert'));
    // Concurrent double submit: 23505 from the partial unique index re-resolves the winner.
    assert.match(create, /isUniqueViolation\(reviewResult\.error\)[\s\S]*?redirect\(existingReviewEditPath\(winnerId\)\)/);
    assert.match(create, /isPurchaseContextViolation\(reviewResult\.error\)/);

    const newPage = read("src/app/(app)/shopping/reviews/new/page.tsx");
    assert.match(newPage, /if \(existingReviewId\) redirect\(existingReviewEditPath\(existingReviewId\)\)/);
  });

  it("I: exact Review lookup survives a Purchase date change", () => {
    const linked = review({ reviewed_at: "2026-09-21T12:00:00-03:00" });
    const moved = buildPurchaseReadModel(purchase({ purchased_at: "2026-03-02T12:00:00-03:00" }), [], new Map(), new Map([[PRODUCT_A, product()]]));
    assert.equal(findLinkedReviewForPurchase(moved, [linked])?.id, REVIEW_A);
    assert.equal(findReviewForPurchaseProduct(PURCHASE_A, PRODUCT_A, [linked])?.id, REVIEW_A);
    // Multi-line cart: the exact line Product still resolves by purchase_id + product_id.
    const cart = buildPurchaseReadModel(
      purchase({ purchased_at: "2026-01-05T12:00:00-03:00" }),
      [item(), item({ id: ITEM_2, product_id: PRODUCT_B, product_name: "Areia Beta", position: 1 })],
      new Map(),
      new Map(),
    );
    assert.deepEqual(resolvePurchaseReviewProductId(cart, PRODUCT_B), { ok: true, productId: PRODUCT_B });
    assert.equal(resolvePurchaseReviewProductId(cart).ok, false);
    assert.equal(resolvePurchaseReviewProductId(cart, PRODUCT_C).ok, false);
    assert.equal(findReviewForPurchaseProduct(PURCHASE_A, PRODUCT_B, [review({ id: REVIEW_B, product_id: PRODUCT_B })])?.id, REVIEW_B);
  });

  it("J: deleting a Purchase leaves the Review alive with purchase_id NULL", () => {
    const sql = read("supabase/migrations/0038_commerce_product_archive_and_review_purchase_link.sql");
    assert.match(sql, /foreign key \(purchase_id\)[\s\S]*?on delete set null/);
    const actions = read("src/app/(app)/shopping/actions.ts");
    const del = actions.slice(actions.indexOf("export async function deletePurchase"), actions.indexOf("export async function updateProduct"));
    assert.doesNotMatch(del, /from\("product_reviews"\)/);
    assert.match(del, /revalidatePath\("\/assistant"\)/);
    // After SET NULL the Review is standalone: unlinked from any Purchase, still counted for the Product.
    const orphaned = review({ purchase_id: null });
    const model = buildPurchaseReadModel(purchase({ id: PURCHASE_B }), [], new Map(), new Map([[PRODUCT_A, product()]]));
    assert.equal(findLinkedReviewForPurchase(model, [orphaned]), null);
    assert.equal(qualifiedProductRecommendations([product()], [], [orphaned]).length, 1);
  });

  it("latest Review CTA resolves the truly latest Review by date", () => {
    const older = review({ id: REVIEW_A, reviewed_at: "2026-09-01T12:00:00-03:00" });
    const newer = review({ id: REVIEW_B, reviewed_at: "2026-09-10T15:00:00+00:00" });
    assert.equal(latestProductReview(PRODUCT_A, [older, newer])?.id, REVIEW_B);
    assert.equal(latestProductReview(PRODUCT_B, [older, newer]), null);
  });
});

describe("commerce lifecycle app — ranking and recommendations", () => {
  const food = product();
  const litter = product({ id: PRODUCT_B, name: "Areia Beta", category: "litter" });

  it("K: a weak Review does not win best value even with a high cost-benefit score", () => {
    const weak = review({ product_id: PRODUCT_A, quality_score: 2, acceptance_score: 2, cost_benefit_score: 5 });
    const solid = review({ id: REVIEW_B, product_id: PRODUCT_B, purchase_id: PURCHASE_B, quality_score: 4, acceptance_score: 4, cost_benefit_score: 4 });
    const qualified = qualifiedProductRecommendations([food, litter], [], [weak, solid]);
    assert.deepEqual(qualified.map((item) => item.product.id), [PRODUCT_B]);
    assert.equal(bestValueRecommendation(qualified)?.product.id, PRODUCT_B);
    assert.equal(bestValueRecommendation(qualifiedProductRecommendations([food], [], [weak])), null);
  });

  it("L: would_buy_again=false does not qualify, even at 5/5/5", () => {
    const noRebuy = review({ would_buy_again: false });
    assert.deepEqual(qualifiedProductRecommendations([food], [], [noRebuy]), []);
  });

  it("M: cost-benefit below 4 never wins best value, even when the Product qualifies", () => {
    const pricey = review({ quality_score: 5, acceptance_score: 5, cost_benefit_score: 3 });
    const qualified = qualifiedProductRecommendations([food], [], [pricey]);
    assert.equal(qualified.length, 1);
    assert.ok(qualified[0].value < BEST_VALUE_MIN_SCORE);
    assert.equal(bestValueRecommendation(qualified), null);
  });

  it("N: with no qualified Product the page shows «Avalie para descobrir» (no fallback winner)", () => {
    assert.equal(bestValueRecommendation([]), null);
    const page = read("src/app/(app)/shopping/page.tsx");
    assert.match(page, /const bestValue = bestValueRecommendation\(qualified\);/);
    assert.doesNotMatch(page, /bestValueRecommendation\([^)]*\)\s*\?\?/);
    assert.match(page, /bestValue \? bestValue\.product\.name : "Avalie para descobrir"/);
  });

  it("O: archived Products are excluded from rankings", () => {
    const archivedStar = product({ archived_at: ARCHIVED_AT });
    const qualified = qualifiedProductRecommendations([archivedStar], [], [review()]);
    assert.deepEqual(qualified, []);
    assert.equal(bestValueRecommendation(qualified), null);
  });

  it("P: Shopping and Assistant share the same qualification helper", () => {
    const shopping = read("src/app/(app)/shopping/page.tsx");
    const assistant = read("src/app/(app)/assistant/page.tsx");
    assert.match(shopping, /qualifiedProductRecommendations\(products, purchases, reviews\)/);
    assert.match(assistant, /qualifiedProductRecommendations\(catalogProducts, purchases, reviews\)/);
    for (const source of [shopping, assistant]) {
      assert.doesNotMatch(source, /rankProductRecommendations|worthRepeatingRecommendations/);
      assert.match(source, /bestFoodRecommendation\(qualified\)/);
      assert.match(source, /bestLitterRecommendation\(qualified\)/);
    }
    assert.match(assistant, /const best = qualified\[0\] \?\? null;/);
  });

  it("Q: Review edits recompute the ranking on every read (no cache, simple average)", () => {
    const strong = review();
    assert.equal(qualifiedProductRecommendations([food], [], [strong]).length, 1);
    assert.equal(qualifiedProductRecommendations([food], [], [{ ...strong, quality_score: 3, acceptance_score: 3, cost_benefit_score: 3 }]).length, 0);
    assert.equal(qualifiedProductRecommendations([food], [], [{ ...strong, would_buy_again: false }]).length, 0);
    // Simple average across reviews (no recency weight): 5 and 3 → 4 qualifies.
    const older = review({ quality_score: 5, acceptance_score: 5, cost_benefit_score: 5, reviewed_at: "2025-01-01T12:00:00-03:00" });
    const newer = review({ id: REVIEW_B, purchase_id: PURCHASE_B, quality_score: 3, acceptance_score: 3, cost_benefit_score: 3, would_buy_again: false });
    const [averaged] = qualifiedProductRecommendations([food], [], [older, newer]);
    assert.equal(averaged.quality, 4);
    assert.equal(averaged.value, 4);

    const actions = read("src/app/(app)/shopping/actions.ts");
    const surfaces = actions.slice(actions.indexOf("function revalidateReviewSurfaces"), actions.indexOf("type PurchaseAuth"));
    assert.match(surfaces, /revalidatePath\("\/shopping"\)[\s\S]*revalidatePath\("\/assistant"\)/);
    for (const fn of ["export async function updateProductReview", "export async function deleteProductReview", "export async function createProductReview"]) {
      const body = actions.slice(actions.indexOf(fn));
      const end = body.search(/\r?\n\}\r?\n/);
      assert.ok(end > 0, fn);
      assert.match(body.slice(0, end), /revalidateReviewSurfaces\(\)/, fn);
    }
  });
});
