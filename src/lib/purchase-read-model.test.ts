import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPurchaseReadModel,
  buildPurchaseReadModels,
  deriveLegacyUnitPriceCents,
  findLinkedReviewForPurchase,
  isMultiItemPurchase,
  latestSightingForProduct,
  merchandiseCents,
  purchaseDisplayTitle,
  type PurchaseItemRow,
  type PurchaseReadModel,
} from "@/lib/purchase-read-model";
import type { Product, ProductReview, Purchase } from "@/types/database";

const HOUSEHOLD = "11111111-1111-4111-8111-111111111111";
const PURCHASE_A = "22222222-2222-4222-8222-222222222222";
const PURCHASE_B = "33333333-3333-4333-8333-333333333333";
const PRODUCT_A = "44444444-4444-4444-8444-444444444444";
const PRODUCT_B = "55555555-5555-4555-8555-555555555555";
const ITEM_1 = "66666666-6666-4666-8666-666666666666";
const ITEM_2 = "77777777-7777-4777-8777-777777777777";
const PET_1 = "88888888-8888-4888-8888-888888888888";
const PET_2 = "99999999-9999-4999-8999-999999999999";

function basePurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: PURCHASE_A,
    household_id: HOUSEHOLD,
    product_id: PRODUCT_A,
    pet_id: PET_1,
    pet_ids: [PET_1],
    expense_id: null,
    store_name: "Pet Shop",
    channel: "physical_store",
    quantity: 1,
    amount_cents: 1975,
    subtotal_cents: 1975,
    discount_cents: 0,
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

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: PRODUCT_A,
    household_id: HOUSEHOLD,
    name: "Ração Alpha",
    brand: "Marca A",
    category: "dry_food",
    package_size: "1kg",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function item(overrides: Partial<PurchaseItemRow> = {}): PurchaseItemRow {
  return {
    id: ITEM_1,
    household_id: HOUSEHOLD,
    purchase_id: PURCHASE_A,
    product_id: PRODUCT_A,
    position: 0,
    product_name: "Snapshot Alpha",
    brand: "Snap Brand",
    category: "dry_food",
    package_size: "1kg",
    quantity: 2,
    unit_price_cents: 1000,
    line_subtotal_cents: 2000,
    notes: null,
    ...overrides,
  };
}

describe("purchase dual-read model", () => {
  it("A: persisted items win over header product/quantity", () => {
    const purchase = basePurchase({ product_id: PRODUCT_A, quantity: 99, amount_cents: 5000, subtotal_cents: 5000 });
    const products = new Map([[PRODUCT_A, product()], [PRODUCT_B, product({ id: PRODUCT_B, name: "Live B" })]]);
    const items = [
      item({ id: ITEM_1, product_id: PRODUCT_B, product_name: "Line B", quantity: 1, unit_price_cents: 1500, line_subtotal_cents: 1500, position: 0 }),
      item({ id: ITEM_2, product_id: PRODUCT_A, product_name: "Line A", quantity: 3, unit_price_cents: 500, line_subtotal_cents: 1500, position: 1 }),
    ];
    const model = buildPurchaseReadModel(purchase, items, new Map(), products);
    assert.equal(model.source, "items");
    assert.equal(model.lines.length, 2);
    assert.equal(model.lines[0].product_name, "Line B");
    assert.equal(model.lines[0].quantity, 1);
    assert.equal(model.product_id, PRODUCT_A); // header mirror unchanged
    assert.equal(model.quantity, 99);
    assert.equal(isMultiItemPurchase(model), true);
  });

  it("B: zero-item purchase yields exactly one virtual legacy line", () => {
    const purchase = basePurchase();
    const products = new Map([[PRODUCT_A, product()]]);
    const model = buildPurchaseReadModel(purchase, [], new Map(), products);
    assert.equal(model.source, "legacy");
    assert.equal(model.lines.length, 1);
    assert.equal(model.lines[0].source, "legacy");
    assert.equal(model.lines[0].id, null);
    assert.equal(model.lines[0].product_id, PRODUCT_A);
  });

  it("C: legacy exact unit representation derives unit price", () => {
    assert.equal(deriveLegacyUnitPriceCents(0.5, 100), 200);
    assert.equal(deriveLegacyUnitPriceCents(1, 1975), 1975);
    const purchase = basePurchase({ quantity: 0.5, amount_cents: 100, subtotal_cents: 100, discount_cents: 0 });
    const model = buildPurchaseReadModel(purchase, [], new Map(), new Map([[PRODUCT_A, product()]]));
    assert.equal(model.lines[0].unit_price_cents, 200);
    assert.equal(model.lines[0].line_subtotal_cents, 100);
  });

  it("D: legacy non-representable combination yields null unit price", () => {
    // qty 3, merchandise 100 → round(100/3)=33 → round(3*33)=99 ≠ 100
    assert.equal(deriveLegacyUnitPriceCents(3, 100), null);
    const purchase = basePurchase({ quantity: 3, amount_cents: 100, subtotal_cents: 100 });
    const model = buildPurchaseReadModel(purchase, [], new Map(), new Map([[PRODUCT_A, product()]]));
    assert.equal(model.lines[0].unit_price_cents, null);
    assert.equal(model.lines[0].line_subtotal_cents, 100);
  });

  it("E: item snapshots are not replaced by live Product rename", () => {
    const purchase = basePurchase();
    const live = product({ name: "Renamed Live", brand: "New Brand", category: "treat", package_size: "99kg" });
    const items = [item({ product_name: "Historical Name", brand: "Historical Brand", category: "litter", package_size: "4kg" })];
    const model = buildPurchaseReadModel(purchase, items, new Map(), new Map([[PRODUCT_A, live]]));
    assert.equal(model.lines[0].product_name, "Historical Name");
    assert.equal(model.lines[0].brand, "Historical Brand");
    assert.equal(model.lines[0].category, "litter");
    assert.equal(model.lines[0].package_size, "4kg");
  });

  it("F: explicit item pets are authoritative", () => {
    const purchase = basePurchase({ pet_ids: [PET_1] });
    const items = [item()];
    const itemPets = new Map([[ITEM_1, [PET_2]]]);
    const model = buildPurchaseReadModel(purchase, items, itemPets, new Map([[PRODUCT_A, product()]]));
    assert.deepEqual(model.lines[0].pet_ids, [PET_2]);
    assert.deepEqual(model.lines[0].effective_pet_ids, [PET_2]);
  });

  it("G: zero item pets inherit purchase pets", () => {
    const purchase = basePurchase({ pet_ids: [PET_1, PET_2] });
    const items = [item()];
    const model = buildPurchaseReadModel(purchase, items, new Map(), new Map([[PRODUCT_A, product()]]));
    assert.deepEqual(model.lines[0].pet_ids, []);
    assert.deepEqual(model.lines[0].effective_pet_ids, [PET_1, PET_2].sort());
  });

  it("H: multi-item cart does not use header amount/header quantity as unit price", () => {
    const purchase = basePurchase({ quantity: 1, amount_cents: 9000, subtotal_cents: 9000 });
    const items = [
      item({ id: ITEM_1, quantity: 2, unit_price_cents: 2000, line_subtotal_cents: 4000, position: 0 }),
      item({ id: ITEM_2, product_id: PRODUCT_B, product_name: "B", quantity: 1, unit_price_cents: 5000, line_subtotal_cents: 5000, position: 1 }),
    ];
    const model = buildPurchaseReadModel(purchase, items, new Map(), new Map());
    const bogusHeaderUnit = purchase.amount_cents / purchase.quantity;
    assert.notEqual(model.lines[0].unit_price_cents, bogusHeaderUnit);
    assert.equal(model.lines[0].unit_price_cents, 2000);
    assert.equal(purchaseDisplayTitle(model), "Compra · 2 itens");
  });

  it("I: batch mapping preserves correct Purchase association", () => {
    const a = basePurchase({ id: PURCHASE_A, purchased_at: "2026-09-21T12:00:00-03:00" });
    const b = basePurchase({ id: PURCHASE_B, product_id: PRODUCT_B, purchased_at: "2026-09-10T12:00:00-03:00" });
    const items = [
      item({ id: ITEM_1, purchase_id: PURCHASE_A, product_id: PRODUCT_A, product_name: "Only A" }),
      item({ id: ITEM_2, purchase_id: PURCHASE_B, product_id: PRODUCT_B, product_name: "Only B", quantity: 1, unit_price_cents: 100, line_subtotal_cents: 100 }),
    ];
    const models = buildPurchaseReadModels([a, b], items, new Map(), new Map());
    assert.equal(models.length, 2);
    assert.equal(models[0].id, PURCHASE_A);
    assert.equal(models[0].lines[0].product_name, "Only A");
    assert.equal(models[1].id, PURCHASE_B);
    assert.equal(models[1].lines[0].product_name, "Only B");
    const sighting = latestSightingForProduct(models, PRODUCT_A);
    assert.equal(sighting?.purchase.id, PURCHASE_A);
    assert.equal(sighting?.line.product_name, "Only A");
  });

  it("merchandise prefers subtotal_cents over amount+discount", () => {
    assert.equal(merchandiseCents({ subtotal_cents: 2000, amount_cents: 1500, discount_cents: 100 }), 2000);
    assert.equal(merchandiseCents({ subtotal_cents: null, amount_cents: 1500, discount_cents: 100 }), 1600);
  });

  it("legacy virtual line uses live product fallback fields", () => {
    const purchase = basePurchase();
    const model = buildPurchaseReadModel(purchase, [], new Map(), new Map([[PRODUCT_A, product({ name: "Live Name", brand: "Live Brand" })]]));
    assert.equal(model.lines[0].product_name, "Live Name");
    assert.equal(model.lines[0].brand, "Live Brand");
    assert.deepEqual(model.lines[0].effective_pet_ids, [PET_1]);
  });
});

describe("purchase read model type contracts", () => {
  it("PurchaseReadModel remains distinct from bare Purchase shape via source/lines", () => {
    const model: PurchaseReadModel = buildPurchaseReadModel(basePurchase(), [], new Map(), new Map([[PRODUCT_A, product()]]));
    assert.ok("source" in model);
    assert.ok(Array.isArray(model.lines));
  });
});

const REVIEW_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function review(overrides: Partial<ProductReview> = {}): ProductReview {
  return {
    id: REVIEW_A,
    household_id: HOUSEHOLD,
    product_id: PRODUCT_A,
    pet_id: null,
    quality_score: 5,
    acceptance_score: 5,
    cost_benefit_score: 4,
    would_buy_again: true,
    notes: null,
    reviewed_at: "2026-09-20T12:00:00-03:00",
    created_at: "2026-09-20T12:00:00-03:00",
    updated_at: "2026-09-20T12:00:00-03:00",
    ...overrides,
  };
}

describe("findLinkedReviewForPurchase", () => {
  it("A: one-line Purchase + matching review → linked review found", () => {
    const model = buildPurchaseReadModel(basePurchase(), [], new Map(), new Map([[PRODUCT_A, product()]]));
    assert.equal(model.lines.length, 1);
    const linked = findLinkedReviewForPurchase(model, [review()]);
    assert.equal(linked?.id, REVIEW_A);
  });

  it("B: one-line Purchase + different product → no linked review", () => {
    const model = buildPurchaseReadModel(basePurchase(), [], new Map(), new Map([[PRODUCT_A, product()]]));
    const linked = findLinkedReviewForPurchase(model, [review({ product_id: PRODUCT_B })]);
    assert.equal(linked, null);
  });

  it("C: two-line Purchase where header product_id matches a review → NO linked review", () => {
    const purchase = basePurchase({ product_id: PRODUCT_A });
    const items = [
      item({ id: ITEM_1, product_id: PRODUCT_A, product_name: "A", position: 0 }),
      item({ id: ITEM_2, product_id: PRODUCT_B, product_name: "B", quantity: 1, unit_price_cents: 100, line_subtotal_cents: 100, position: 1 }),
    ];
    const model = buildPurchaseReadModel(purchase, items, new Map(), new Map());
    assert.equal(model.lines.length, 2);
    assert.equal(model.product_id, PRODUCT_A);
    const linked = findLinkedReviewForPurchase(model, [review({ product_id: PRODUCT_A })]);
    assert.equal(linked, null);
  });

  it("D: two lines with the same product_id → still NO purchase-level linked review", () => {
    const purchase = basePurchase({ product_id: PRODUCT_A });
    const items = [
      item({ id: ITEM_1, product_id: PRODUCT_A, product_name: "A1", position: 0 }),
      item({ id: ITEM_2, product_id: PRODUCT_A, product_name: "A2", quantity: 1, unit_price_cents: 100, line_subtotal_cents: 100, position: 1 }),
    ];
    const model = buildPurchaseReadModel(purchase, items, new Map(), new Map());
    assert.equal(model.lines.length, 2);
    const distinct = new Set(model.lines.map((line) => line.product_id));
    assert.equal(distinct.size, 1);
    const linked = findLinkedReviewForPurchase(model, [review({ product_id: PRODUCT_A })]);
    assert.equal(linked, null);
  });

  it("E: one-line with null product_id → no linked review", () => {
    const purchase = basePurchase();
    const items = [item({ product_id: null, product_name: "Orphan snapshot" })];
    const model = buildPurchaseReadModel(purchase, items, new Map(), new Map());
    assert.equal(model.lines.length, 1);
    assert.equal(model.lines[0].product_id, null);
    const linked = findLinkedReviewForPurchase(model, [review({ product_id: PRODUCT_A })]);
    assert.equal(linked, null);
  });
});
