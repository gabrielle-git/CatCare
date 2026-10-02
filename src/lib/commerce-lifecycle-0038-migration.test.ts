import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const migrationPath = join(root, "supabase/migrations/0038_commerce_product_archive_and_review_purchase_link.sql");
const commercePath = join(root, "supabase/migrations/0002_commerce.sql");
const shoppingActionsPath = join(root, "src/app/(app)/shopping/actions.ts");

describe("0038 commerce lifecycle schema foundation contract", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const commerce = readFileSync(commercePath, "utf8");
  const migrations = readdirSync(join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql"));
  const actions = readFileSync(shoppingActionsPath, "utf8");

  it("A: creates exactly the approved 0038 migration and no 0039/0040", () => {
    assert.equal(existsSync(migrationPath), true);
    assert.equal(migrations.includes("0038_commerce_product_archive_and_review_purchase_link.sql"), true);
    assert.equal(migrations.filter((name) => name.startsWith("0038_")).length, 1);
    assert.equal(migrations.some((name) => name.startsWith("0039_")), false);
    assert.equal(migrations.some((name) => name.startsWith("0040_")), false);
  });

  it("B: products.archived_at exists and is nullable", () => {
    assert.match(sql, /alter table public\.products[\s\S]*archived_at timestamptz null/i);
    assert.match(sql, /NULL = active/i);
  });

  it("C: active Product partial index exists", () => {
    assert.match(sql, /products_household_active_updated_idx/);
    assert.match(sql, /where archived_at is null/i);
    assert.match(sql, /household_id,\s*updated_at desc/i);
  });

  it("D: product_reviews.purchase_id exists and is nullable", () => {
    assert.match(sql, /alter table public\.product_reviews[\s\S]*purchase_id uuid null/i);
  });

  it("E: Purchase FK uses ON DELETE SET NULL", () => {
    assert.match(sql, /product_reviews_purchase_id_fkey/);
    assert.match(sql, /references public\.purchases \(id\)[\s\S]*on delete set null/i);
    assert.doesNotMatch(sql, /product_reviews_purchase_id_fkey[\s\S]*on delete cascade/i);
  });

  it("F: partial UNIQUE (purchase_id, product_id) WHERE purchase_id IS NOT NULL", () => {
    assert.match(sql, /product_reviews_purchase_product_uidx/);
    assert.match(sql, /unique index[\s\S]*\(purchase_id,\s*product_id\)[\s\S]*where purchase_id is not null/i);
  });

  it("G: standalone review with purchase_id NULL remains allowed (no NOT NULL / no forced link)", () => {
    assert.doesNotMatch(sql, /purchase_id uuid not null/i);
    assert.match(sql, /Standalone reviews remain valid|optional originating Purchase|purchase_id is null/i);
  });

  it("H: trigger validates same household", () => {
    assert.match(sql, /product_reviews_assert_purchase_context/);
    assert.match(sql, /must belong to the same household/);
    assert.match(sql, /errcode = '23514'/);
  });

  it("I: trigger validates Product membership", () => {
    assert.match(sql, /must belong to a purchase_items row|must match the linked legacy Purchase product_id/);
  });

  it("J: when purchase_items exist, header product_id is NOT used as fallback truth", () => {
    assert.match(sql, /do NOT fall back to header product_id/i);
    // Trigger branch: has_items → EXISTS purchase_items product match (no purchases.product_id compare in that branch)
    const fnStart = sql.indexOf("create or replace function public.product_reviews_assert_purchase_context");
    const fnEnd = sql.indexOf("$$;", fnStart + 1);
    const fn = sql.slice(fnStart, fnEnd);
    const itemsBranch = fn.slice(fn.indexOf("if has_items then"), fn.indexOf("else"));
    assert.match(itemsBranch, /purchase_items/);
    assert.doesNotMatch(itemsBranch, /purchase_product is distinct from new\.product_id/);
  });

  it("K: zero-item legacy Purchase uses header product_id as fallback truth", () => {
    assert.match(sql, /Legacy zero-item Purchase: header product_id is fallback truth/);
    assert.match(sql, /purchase_product is distinct from new\.product_id/);
  });

  it("L: backfill uses same Product semantics as trigger", () => {
    assert.match(sql, /Deterministic backfill of purchase_id/);
    assert.match(sql, /when exists \([\s\S]*purchase_items[\s\S]*then exists \([\s\S]*product_id = r\.product_id/);
    assert.match(sql, /else p\.product_id = r\.product_id/);
  });

  it("M: backfill requires exactly-one Purchase candidate AND uncontested (purchase_id, product_id)", () => {
    const backfill = sql.slice(sql.indexOf("Deterministic backfill"));
    assert.match(backfill, /single_candidate/);
    assert.match(backfill, /having count\(\*\) = 1/);
    assert.match(backfill, /uncontested/);
    assert.match(backfill, /target_claim_counts|claim_count = 1/);
    assert.match(backfill, /Fan-in ambiguity|uncontested/i);
  });

  it("N/O: zero-match, multi-Purchase ambiguity, and fan-in stay NULL (no arbitrary Review winner)", () => {
    const backfill = sql.slice(sql.indexOf("Deterministic backfill"));
    assert.match(backfill, /leave ALL NULL|uncontested/i);
    assert.doesNotMatch(backfill, /raise exception[\s\S]*ambiguous/i);
    assert.doesNotMatch(backfill, /order by[\s\S]*limit 1/i);
    assert.doesNotMatch(backfill, /min\(\s*review_id\s*\)/i);
    assert.doesNotMatch(backfill, /distinct on\s*\(/i);
    // Already-linked (purchase_id, product_id) must block another claim
    assert.match(backfill, /existing\.purchase_id = swp\.purchase_id[\s\S]*existing\.product_id = swp\.product_id/);
  });

  it("fan-in: competing Reviews for the same (purchase_id, product_id) are not linked", () => {
    const backfill = sql.slice(sql.indexOf("Deterministic backfill"));
    assert.match(backfill, /claim_count = 1/);
    assert.match(backfill, /Do NOT pick an arbitrary Review winner/i);
  });

  it("multi-Product same Purchase: uniqueness is per (purchase_id, product_id), not per Purchase alone", () => {
    assert.match(sql, /unique index[\s\S]*\(purchase_id,\s*product_id\)[\s\S]*where purchase_id is not null/i);
    // Backfill contests on (purchase_id, product_id), so different Products on one Purchase remain eligible
    const backfill = sql.slice(sql.indexOf("Deterministic backfill"));
    assert.match(backfill, /group by purchase_id,\s*product_id/);
  });

  it("P: timezone comparison explicitly uses America/Sao_Paulo", () => {
    assert.match(sql, /America\/Sao_Paulo/);
    assert.match(sql, /purchased_at at time zone 'America\/Sao_Paulo'/i);
    assert.match(sql, /reviewed_at at time zone 'America\/Sao_Paulo'/i);
  });

  it("Q: no 0039 / 0040 migration files", () => {
    assert.equal(migrations.some((name) => name.startsWith("0039_")), false);
    assert.equal(migrations.some((name) => name.startsWith("0040_")), false);
  });

  it("R: no purchases.product_id FK/nullability change", () => {
    assert.doesNotMatch(sql, /alter table public\.purchases[\s\S]*product_id/i);
    assert.doesNotMatch(sql, /purchases_product_id_fkey/);
    assert.match(commerce, /product_id uuid not null references public\.products\(id\) on delete cascade/);
  });

  it("S: no product_reviews.product_id FK change", () => {
    assert.doesNotMatch(sql, /product_reviews_product_id_fkey|alter[\s\S]*product_reviews[\s\S]*product_id[\s\S]*drop constraint/i);
    assert.match(commerce, /product_id uuid not null references public\.products\(id\) on delete cascade/);
  });

  it("T: no Auth / Storage changes", () => {
    assert.doesNotMatch(sql, /auth\.(users|schema)|storage\.(objects|buckets)/i);
    assert.doesNotMatch(sql, /create policy|alter policy/i);
  });

  it("trigger helper is revoked from app roles and uses search_path = public", () => {
    assert.match(sql, /set search_path = public/);
    assert.match(sql, /revoke all on function public\.product_reviews_assert_purchase_context\(\) from public/);
    assert.match(sql, /revoke all on function public\.product_reviews_assert_purchase_context\(\) from anon/);
    assert.match(sql, /revoke all on function public\.product_reviews_assert_purchase_context\(\) from authenticated/);
    assert.doesNotMatch(sql, /security definer/i);
  });

  it("legacy shopping write path remains schema-compatible without code changes", () => {
    assert.match(actions, /export async function createPurchase/);
    assert.match(actions, /ensurePurchaseReview/);
    assert.match(actions, /export async function createProductReview/);
    assert.doesNotMatch(actions, /archived_at/);
    // Review inserts must not yet require purchase_id (nullable schema keeps old app compatible).
    assert.doesNotMatch(actions, /from\(["']product_reviews["']\)\.insert\(\{[^}]*\bpurchase_id\b/);
  });
});
