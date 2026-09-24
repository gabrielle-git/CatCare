import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const migrationPath = join(root, "supabase/migrations/0037_purchase_items_and_cart_economics.sql");
const commercePath = join(root, "supabase/migrations/0002_commerce.sql");
const shoppingActionsPath = join(root, "src/app/(app)/shopping/actions.ts");

describe("0037 purchase items cart economics migration contract", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const commerce = readFileSync(commercePath, "utf8");
  const migrations = readdirSync(join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql"));

  it("creates exactly the approved 0037 migration file and no 0038", () => {
    assert.equal(existsSync(migrationPath), true);
    assert.equal(migrations.includes("0037_purchase_items_and_cart_economics.sql"), true);
    assert.equal(migrations.some((name) => name.startsWith("0038_")), false);
  });

  it("adds V2 header finance columns with safe defaults and no hard final formula CHECK", () => {
    assert.match(sql, /shipping_cents/);
    assert.match(sql, /credits_applied_cents/);
    assert.match(sql, /discount_rate_bps/);
    assert.match(sql, /default 0/);
    assert.doesNotMatch(sql, /amount_cents\s*=\s*subtotal/i);
    assert.doesNotMatch(sql, /shipping_cents\s*\+\s*credits/i);
  });

  it("creates purchase_items / purchase_item_pets / purchase_attachments with line formula CHECK", () => {
    assert.match(sql, /create table if not exists public\.purchase_items/);
    assert.match(sql, /create table if not exists public\.purchase_item_pets/);
    assert.match(sql, /create table if not exists public\.purchase_attachments/);
    assert.match(sql, /purchase_items_line_subtotal_matches_qty_price/);
    assert.match(sql, /round\(quantity \* unit_price_cents\)/);
  });

  it("does not unique-constrain purchase_id + position on items", () => {
    const itemsBlock = sql.slice(
      sql.indexOf("create table if not exists public.purchase_items"),
      sql.indexOf("create table if not exists public.purchase_item_pets"),
    );
    assert.doesNotMatch(itemsBlock, /unique\s*\(\s*purchase_id\s*,\s*position\s*\)/i);
    assert.doesNotMatch(itemsBlock, /purchase_items_position_unique/i);
    assert.match(sql, /purchase_items_purchase_position_id_idx/);
    // Attachments may uniquely order files per purchase — that is intentional.
    assert.match(sql, /purchase_attachments_position_unique unique \(purchase_id, position\)/);
  });

  it("keeps legacy purchases.product_id CASCADE / NOT NULL untouched", () => {
    assert.doesNotMatch(sql, /alter\s+column\s+product_id/i);
    assert.doesNotMatch(sql, /drop\s+not\s+null/i);
    assert.doesNotMatch(sql, /purchases_product_id.*set null/i);
    assert.match(sql, /OUT OF SCOPE[\s\S]*purchases\.product_id NOT NULL \/ ON DELETE CASCADE/);
    // Item catalog pointer may SET NULL; header legacy FK must remain CASCADE (0002).
    assert.match(sql, /constraint purchase_items_product_fkey[\s\S]*?on delete set null/);
    assert.match(commerce, /product_id uuid not null references public\.products\(id\) on delete cascade/);
  });

  it("includes partial UNIQUE expense index and duplicate precheck abort", () => {
    assert.match(sql, /purchases_expense_id_uidx/);
    assert.match(sql, /where expense_id is not null/i);
    assert.match(sql, /duplicate non-null purchases\.expense_id/);
  });

  it("includes deterministic legacy backfill that aborts when non-representable", () => {
    assert.match(sql, /not exists \(\s*select 1 from public\.purchase_items/i);
    assert.match(sql, /coalesce\(r\.subtotal_cents, r\.amount_cents \+ coalesce\(r\.discount_cents, 0\)\)/);
    assert.match(sql, /0037 backfill blocked/);
    assert.match(sql, /gen_random_uuid\(\)/);
  });

  it("derives backfill unit_price by division, not generate_series enumeration", () => {
    const backfillStart = sql.indexOf("Deterministic legacy purchase");
    const backfillEnd = sql.indexOf("-- G/H already covered");
    assert.ok(backfillStart >= 0 && backfillEnd > backfillStart);
    const backfill = sql.slice(backfillStart, backfillEnd);
    assert.doesNotMatch(backfill, /generate_series/i);
    assert.match(backfill, /round\(merch::numeric\s*\/\s*r\.quantity\)::integer/);
    assert.match(backfill, /computed_subtotal\s*<>\s*merch/);
    assert.match(backfill, /0037 backfill blocked:[\s\S]*satisfying round\(qty\*unit\)=merchandise/);
  });

  it("enables RLS policies and same-household purchase FK", () => {
    assert.match(sql, /enable row level security/);
    assert.match(sql, /purchase_items_member_select/);
    assert.match(sql, /is_household_member\(household_id\)/);
    assert.match(sql, /can_edit_household\(household_id\)/);
    assert.match(sql, /purchase_items_purchase_household_fkey/);
    assert.match(sql, /purchases_id_household_key/);
  });

  it("documents product same-household via trigger because composite SET NULL would null household_id", () => {
    assert.match(sql, /purchase_items_assert_product_household/);
    assert.match(sql, /on delete set null/);
    assert.match(sql, /would also null household_id/);
  });

  it("documents that item product_id SET NULL does not override legacy header Product CASCADE debt", () => {
    assert.match(sql, /legacy purchases\.product_id remains ON DELETE CASCADE/i);
    assert.match(sql, /does NOT by itself make/i);
    assert.match(sql, /historical Purchases survive Product deletion/i);
    assert.match(commerce, /product_id uuid not null references public\.products\(id\) on delete cascade/);
  });

  it("leaves current shopping write path schema-compatible (no V2 cart writes yet)", () => {
    const actions = readFileSync(shoppingActionsPath, "utf8");
    assert.match(actions, /export async function createPurchase/);
    assert.match(actions, /export async function updatePurchase/);
    assert.match(actions, /export async function deletePurchase/);
    assert.match(actions, /export async function deleteProduct/);
    assert.doesNotMatch(actions, /shipping_cents/);
    assert.doesNotMatch(actions, /credits_applied_cents/);
    assert.doesNotMatch(actions, /discount_rate_bps/);

    const createIdx = actions.indexOf("export async function createPurchase");
    const updateIdx = actions.indexOf("export async function updatePurchase");
    const deletePurchaseIdx = actions.indexOf("export async function deletePurchase");
    const deleteProductIdx = actions.indexOf("export async function deleteProduct");
    assert.ok(createIdx >= 0 && updateIdx > createIdx && deletePurchaseIdx > updateIdx && deleteProductIdx > deletePurchaseIdx);

    const writeSurface = actions.slice(createIdx, deleteProductIdx);
    assert.doesNotMatch(writeSurface, /purchase_items/);
    assert.doesNotMatch(writeSurface, /\.from\(["']purchase_items["']\)\.(insert|upsert|update|delete)/);

    // App-prep history guard may READ purchase_items inside deleteProduct only.
    const deleteProductSurface = actions.slice(deleteProductIdx);
    assert.match(deleteProductSurface, /from\(["']purchase_items["']\)/);
    assert.doesNotMatch(deleteProductSurface, /\.from\(["']purchase_items["']\)\.(insert|upsert|update|delete)/);
  });
});
