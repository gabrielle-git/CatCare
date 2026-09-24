import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXPORT_HOUSEHOLD_TABLES } from "@/lib/export-tables";

describe("export includes purchase V2 relational truth", () => {
  it("retains existing commerce/export tables", () => {
    for (const table of ["expenses", "products", "purchases", "product_reviews", "attachments"] as const) {
      assert.ok(EXPORT_HOUSEHOLD_TABLES.includes(table), `missing ${table}`);
    }
  });

  it("adds purchase_items / junctions and pet link tables", () => {
    for (const table of [
      "purchase_items",
      "purchase_item_pets",
      "purchase_attachments",
      "purchase_pets",
      "expense_pets",
      "review_pets",
    ] as const) {
      assert.ok(EXPORT_HOUSEHOLD_TABLES.includes(table), `missing ${table}`);
    }
  });
});
