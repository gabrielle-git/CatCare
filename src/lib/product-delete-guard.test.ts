import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCT_DELETE_HISTORY_MESSAGE,
  productHasCommerceHistory,
} from "@/lib/product-delete-guard";

const root = join(process.cwd());

describe("product delete history guard", () => {
  it("A: header purchase history blocks delete", () => {
    assert.equal(productHasCommerceHistory({ headerPurchaseCount: 1, purchaseItemCount: 0, reviewCount: 0 }), true);
  });

  it("B: purchase_items-only history blocks delete", () => {
    assert.equal(productHasCommerceHistory({ headerPurchaseCount: 0, purchaseItemCount: 2, reviewCount: 0 }), true);
  });

  it("C: product_reviews-only history blocks delete", () => {
    assert.equal(productHasCommerceHistory({ headerPurchaseCount: 0, purchaseItemCount: 0, reviewCount: 1 }), true);
  });

  it("D: no purchase/item/review history allows delete", () => {
    assert.equal(productHasCommerceHistory({ headerPurchaseCount: 0, purchaseItemCount: 0, reviewCount: 0 }), false);
  });

  it("E: deleteProduct action scopes history checks to household and blocks before delete", () => {
    const actions = readFileSync(join(root, "src/app/(app)/shopping/actions.ts"), "utf8");
    assert.match(actions, /productHasCommerceHistory/);
    assert.match(actions, /PRODUCT_DELETE_HISTORY_MESSAGE/);
    assert.match(actions, /purchase_items[\s\S]*product_id[\s\S]*household_id/);
    assert.match(actions, /product_reviews[\s\S]*product_id[\s\S]*household_id/);
    // Guard must run before products.delete
    const guardIdx = actions.indexOf("productHasCommerceHistory");
    const deleteIdx = actions.indexOf('.from("products").delete()');
    assert.ok(guardIdx >= 0 && deleteIdx > guardIdx);
  });

  it("exposes clear pt-BR user message without FK jargon", () => {
    assert.match(PRODUCT_DELETE_HISTORY_MESSAGE, /histórico/i);
    assert.doesNotMatch(PRODUCT_DELETE_HISTORY_MESSAGE, /CASCADE|FK|foreign key/i);
  });
});
