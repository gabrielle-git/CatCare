import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NEW_PRODUCT_FIELDS_MESSAGE,
  buildProductCatalogInsert,
  createOrReuseCatalogProduct,
  parseProductCatalogFields,
  productCreatedRedirect,
  type ProductCatalogFields,
} from "@/lib/product-catalog";
import { isProductActive, productIdsWithHistory, productLifecycleOptions } from "@/lib/product-lifecycle";
import {
  productPurchaseReviewPath,
  productReviewCandidates,
  productReviewEntryPoints,
  productStandaloneReviewPath,
  resolveProductReviewOrigin,
} from "@/lib/product-review-entry";
import { buildPurchaseReadModel, findLinkedReviewForPurchase, type PurchaseItemRow } from "@/lib/purchase-read-model";
import type { Product, ProductReview, Purchase } from "@/types/database";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const HOUSEHOLD = "11111111-1111-4111-8111-111111111111";
const OTHER_HOUSEHOLD = "12121212-1212-4121-8121-121212121212";
const PURCHASE_A = "22222222-2222-4222-8222-222222222222";
const PURCHASE_B = "33333333-3333-4333-8333-333333333333";
const PURCHASE_C = "34343434-3434-4343-8343-343434343434";
const PRODUCT_A = "44444444-4444-4444-8444-444444444444";
const PRODUCT_B = "55555555-5555-4555-8555-555555555555";
const ITEM_1 = "66666666-6666-4666-8666-666666666666";
const ITEM_2 = "77777777-7777-4777-8777-777777777777";
const REVIEW_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const ACTIONS = "src/app/(app)/shopping/actions.ts";
const SHOPPING = "src/app/(app)/shopping/page.tsx";
const PRODUCT_EDIT = "src/app/(app)/shopping/products/[id]/edit/page.tsx";
const PRODUCT_NEW = "src/app/(app)/shopping/products/new/page.tsx";
const REVIEW_NEW = "src/app/(app)/shopping/reviews/new/page.tsx";

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
    ...overrides,
  };
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

const legacy = (overrides: Partial<Purchase> = {}) =>
  buildPurchaseReadModel(purchase(overrides), [], new Map(), new Map([[PRODUCT_A, product()], [PRODUCT_B, product({ id: PRODUCT_B, name: "Areia Beta" })]]));

/** Records every table touched; emulates the products PK and the archived_at NULL default. */
function recordingClient(seed: Record<string, unknown>[] = [], options: { raceOnInsert?: Record<string, unknown> } = {}) {
  const rows = [...seed];
  const touched: { table: string; op: string; payload?: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder = {
        select() {
          touched.push({ table, op: "select" });
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        async maybeSingle() {
          const found = rows.find((row) => Object.entries(filters).every(([key, value]) => row[key] === value));
          return { data: found ?? null, error: null };
        },
        insert(payload: Record<string, unknown>) {
          touched.push({ table, op: "insert", payload });
          return {
            select: () => ({
              single: async () => {
                if (options.raceOnInsert) {
                  rows.push(options.raceOnInsert);
                  return { data: null, error: { code: "23505", message: "duplicate key" } };
                }
                const row = { archived_at: null, created_at: "2026-10-06T00:00:00Z", updated_at: "2026-10-06T00:00:00Z", ...payload };
                rows.push(row);
                return { data: row, error: null };
              },
            }),
          };
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, rows, touched };
}

const fields: ProductCatalogFields = { name: "Areia Nova", brand: "Marca Z", category: "litter", package_size: "4kg", notes: "sem perfume" };

describe("Product-only creation (catalog, no transaction)", () => {
  it("A: creates exactly one Product row in the household", async () => {
    const { client, rows } = recordingClient();
    const result = await createOrReuseCatalogProduct(client, HOUSEHOLD, PRODUCT_B, fields);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.status, "created");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].household_id, HOUSEHOLD);
    assert.equal(rows[0].name, "Areia Nova");
  });

  it("B/C/D: touches only `products` — no Purchase, no Expense, no Review", async () => {
    const { client, touched } = recordingClient();
    await createOrReuseCatalogProduct(client, HOUSEHOLD, PRODUCT_B, fields);
    assert.deepEqual([...new Set(touched.map((call) => call.table))], ["products"]);

    const actions = read(ACTIONS);
    const create = actions.slice(actions.indexOf("export async function createProduct("), actions.indexOf("export async function createStandaloneProductReview"));
    assert.match(create, /createOrReuseCatalogProduct\(supabase, household\.id, productId, parsed\.fields\)/);
    assert.doesNotMatch(create, /from\("(purchases|purchase_items|expenses|product_reviews)"\)/);
    assert.equal(productCreatedRedirect(PRODUCT_B), `/shopping?productCreated=${PRODUCT_B}`);
    const catalog = read("src/lib/product-catalog.ts");
    assert.doesNotMatch(catalog, /from\("(purchases|purchase_items|expenses|product_reviews)"\)/);
  });

  it("E: the new Product is active (archived_at left to the NULL default)", async () => {
    const insert = buildProductCatalogInsert(PRODUCT_B, HOUSEHOLD, fields);
    assert.equal("archived_at" in insert, false);
    assert.deepEqual(Object.keys(insert).sort(), ["brand", "category", "household_id", "id", "name", "notes", "package_size"]);
    const { client } = recordingClient();
    const result = await createOrReuseCatalogProduct(client, HOUSEHOLD, PRODUCT_B, fields);
    assert.ok(result.ok && isProductActive(result.product));
  });

  it("double submit / race reuses the same Product id; foreign ids are refused", async () => {
    const first = recordingClient();
    await createOrReuseCatalogProduct(first.client, HOUSEHOLD, PRODUCT_B, fields);
    const again = await createOrReuseCatalogProduct(first.client, HOUSEHOLD, PRODUCT_B, fields);
    assert.equal(again.ok && again.status, "reused");
    assert.equal(first.touched.filter((call) => call.op === "insert").length, 1);

    const raced = recordingClient([], { raceOnInsert: { ...product({ id: PRODUCT_B }) } });
    const raceResult = await createOrReuseCatalogProduct(raced.client, HOUSEHOLD, PRODUCT_B, fields);
    assert.equal(raceResult.ok && raceResult.status, "reused");

    const foreign = recordingClient([{ ...product({ id: PRODUCT_B, household_id: OTHER_HOUSEHOLD }) }]);
    const foreignResult = await createOrReuseCatalogProduct(foreign.client, HOUSEHOLD, PRODUCT_B, fields);
    assert.equal(foreignResult.ok, false);
    assert.equal(foreign.touched.some((call) => call.op === "insert"), false);
  });

  it("shares one validation for Product create, inline Purchase create and Product edit", () => {
    const form = new Map([["product_name", " "], ["category", "litter"]]);
    assert.deepEqual(parseProductCatalogFields((name) => (form.get(name) ?? "").trim()), { ok: false, error: NEW_PRODUCT_FIELDS_MESSAGE });
    assert.equal(parseProductCatalogFields((name) => ({ product_name: "X", category: "bogus" })[name] ?? "").ok, false);
    const ok = parseProductCatalogFields((name) => ({ product_name: "X", category: "treat" })[name] ?? "");
    assert.deepEqual(ok, { ok: true, fields: { name: "X", brand: null, category: "treat", package_size: null, notes: null } });

    const actions = read(ACTIONS);
    assert.equal((actions.match(/parseProductCatalogFields\(\(name\) => value\(formData, name\)\)/g) ?? []).length, 3);
    assert.doesNotMatch(actions, /productCategories/);
  });

  it("Product create screen has catalog fields only (no date, price, store, payment, Health)", () => {
    const form = read("src/components/create-product-form.tsx");
    for (const name of ["product_name", "brand", "category", "package_size", "product_notes"]) assert.match(form, new RegExp(`name="${name}"`));
    assert.doesNotMatch(form, /name="(amount|subtotal|discount|quantity|store_name|channel|purchased_on|payment[^"]*|health[^"]*|membership_id|coupon_code)"/);
    assert.match(form, /useState\(\(\) => crypto\.randomUUID\(\)\)/);
    assert.match(read(PRODUCT_NEW), /<CreateProductForm action=\{createProduct\}/);
    assert.match(read(PRODUCT_NEW), /Produto é o item que você acompanha\. Compras registram quando, onde e por quanto ele foi comprado\./);
  });
});

describe("Shopping entry points", () => {
  it("F: Shopping exposes both «Registrar compra» and «Cadastrar produto» for editable users", () => {
    const page = read(SHOPPING);
    const header = page.slice(page.indexOf("<header"), page.indexOf("</header>"));
    assert.match(header, /\{editable && <div[\s\S]*href="\/shopping\/new"[\s\S]*Registrar compra[\s\S]*href="\/shopping\/products\/new"[\s\S]*Cadastrar produto/);
    assert.match(header, /Produto é o item que você acompanha\. Compras registram quando, onde e por quanto ele foi comprado/);
  });

  it("G: the Purchase form still supports inline new Product and links to Product-only create", () => {
    const form = read("src/components/create-purchase-form.tsx");
    assert.match(form, /name="new_product_id"/);
    assert.match(form, /name="product_name"/);
    assert.match(form, /Escolha um produto já cadastrado ou cadastre um novo nesta compra\./);
    assert.match(form, /href="\/shopping\/products\/new"[\s\S]*?Quero apenas cadastrar um produto/);
    const actions = read(ACTIONS);
    const create = actions.slice(actions.indexOf("export async function createPurchase"), actions.indexOf("async function authContext"));
    assert.match(create, /createOrReuseCatalogProduct\(supabase, household\.id, newProductId, parsed\.fields\)/);
  });

  it("H: an active Product with zero Reviews exposes «Avaliar»", () => {
    const entry = productReviewEntryPoints({ productId: PRODUCT_A, archived: false, latestReviewId: null });
    assert.deepEqual(entry, { create: `/shopping/reviews/new?product=${PRODUCT_A}`, editLatest: null });
    const page = read(SHOPPING);
    assert.match(page, /reviewCount === 0 && editable && reviewEntry\.create && \([\s\S]*?<Star size=\{12\} \/> Avaliar<\/Link>/);
  });

  it("I: a Product with Reviews keeps «Editar última avaliação»", () => {
    const entry = productReviewEntryPoints({ productId: PRODUCT_A, archived: false, latestReviewId: REVIEW_A });
    assert.equal(entry.editLatest, `/shopping/reviews/${REVIEW_A}/edit`);
    assert.match(read(SHOPPING), /editable && reviewEntry\.editLatest && <Link href=\{reviewEntry\.editLatest\}[\s\S]*?Editar última avaliação/);
  });

  it("S: the recent-Purchase card keeps its own Avaliar / Editar avaliação", () => {
    const page = read(SHOPPING);
    assert.match(page, /const linkedReview = findLinkedReviewForPurchase\(purchase, reviews\);/);
    assert.match(page, /!linkedReview && purchase\.lines\.length === 1 && <Link href=\{`\/shopping\/reviews\/new\?purchase=\$\{purchase\.id\}`\}/);
    assert.match(page, /linkedReview && <Link href=\{`\/shopping\/reviews\/\$\{linkedReview\.id\}\/edit`\}[\s\S]*?Editar avaliação/);
  });
});

describe("Review from Product — Purchase origin resolution", () => {
  it("J: zero candidate Purchases → standalone Review", () => {
    assert.deepEqual(resolveProductReviewOrigin(PRODUCT_A, [], []), { kind: "standalone" });
    assert.deepEqual(resolveProductReviewOrigin(PRODUCT_A, [legacy({ product_id: PRODUCT_B })], []), { kind: "standalone" });
  });

  it("K: exactly one unreviewed candidate → that Purchase", () => {
    const origin = resolveProductReviewOrigin(PRODUCT_A, [legacy(), legacy({ id: PURCHASE_B, product_id: PRODUCT_B })], []);
    assert.equal(origin.kind, "single");
    assert.equal(origin.kind === "single" && origin.candidate.purchase.id, PURCHASE_A);
    assert.equal(productPurchaseReviewPath(PURCHASE_A, PRODUCT_A), `/shopping/reviews/new?purchase=${PURCHASE_A}&product=${PRODUCT_A}&from=product`);
  });

  it("L: several candidates → the user chooses (no arbitrary origin)", () => {
    const origin = resolveProductReviewOrigin(PRODUCT_A, [
      legacy({ id: PURCHASE_A, purchased_at: "2026-08-01T12:00:00-03:00" }),
      legacy({ id: PURCHASE_B, purchased_at: "2026-09-01T12:00:00-03:00" }),
    ], []);
    assert.equal(origin.kind, "choose");
    assert.deepEqual(origin.kind === "choose" && origin.candidates.map((candidate) => candidate.purchase.id), [PURCHASE_B, PURCHASE_A]);
    const page = read(REVIEW_NEW);
    assert.match(page, /Qual compra você quer avaliar\?/);
    assert.match(page, /Avaliação geral do produto/);
    assert.match(page, /href=\{productStandaloneReviewPath\(productId\)\}/);
    // Only the single-candidate case forwards automatically.
    assert.equal((page.match(/redirect\(productPurchaseReviewPath\(/g) ?? []).length, 1);
    assert.match(page, /if \(!standalone && origin\.kind === "single"\) \{/);
  });

  it("M: an already-reviewed Purchase + Product pair is excluded", () => {
    const purchases = [legacy({ id: PURCHASE_A }), legacy({ id: PURCHASE_B })];
    const reviewed = [review({ purchase_id: PURCHASE_A, product_id: PRODUCT_A })];
    assert.deepEqual(productReviewCandidates(PRODUCT_A, purchases, reviewed).map((c) => c.purchase.id), [PURCHASE_B]);
    assert.equal(resolveProductReviewOrigin(PRODUCT_A, purchases, reviewed).kind, "single");
    const allReviewed = [...reviewed, review({ purchase_id: PURCHASE_B })];
    assert.deepEqual(resolveProductReviewOrigin(PRODUCT_A, purchases, allReviewed), { kind: "standalone" });
    // A Review of ANOTHER product in the same Purchase does not exclude this Product.
    assert.equal(productReviewCandidates(PRODUCT_A, purchases, [review({ product_id: PRODUCT_B })]).length, 2);
  });

  it("N: multi-item membership uses line truth, not the header product_id", () => {
    // Persisted cart: header mirrors PRODUCT_A, but its lines are B only.
    const mirrorOnly = buildPurchaseReadModel(purchase({ id: PURCHASE_C }), [item({ purchase_id: PURCHASE_C, product_id: PRODUCT_B, product_name: "Areia Beta" })], new Map(), new Map());
    // Persisted cart that contains A on its second line while the header points at B.
    const cart = buildPurchaseReadModel(
      purchase({ id: PURCHASE_B, product_id: PRODUCT_B }),
      [item({ id: ITEM_1, purchase_id: PURCHASE_B, product_id: PRODUCT_B, product_name: "Areia Beta" }), item({ id: ITEM_2, purchase_id: PURCHASE_B, product_id: PRODUCT_A, position: 1, line_subtotal_cents: 3200 })],
      new Map(),
      new Map(),
    );
    const candidates = productReviewCandidates(PRODUCT_A, [mirrorOnly, cart], []);
    assert.deepEqual(candidates.map((c) => c.purchase.id), [PURCHASE_B]);
    assert.equal(candidates[0].line.line_subtotal_cents, 3200);

    const commerce = read("src/lib/commerce.ts");
    const loader = commerce.slice(commerce.indexOf("export async function loadProductReviewContext"), commerce.indexOf("export async function loadProductReviewSummary"));
    assert.match(loader, /from\("purchase_items"\)\.select\("purchase_id"\)\.eq\("household_id", householdId\)\.eq\("product_id", productId\)/);
    assert.match(loader, /purchases: purchasesContainingProduct\(models, productId\)/);
  });

  it("T: no Product/date soft match — a same-day standalone Review links nothing", () => {
    const sameDay = review({ purchase_id: null, reviewed_at: "2026-09-20T12:00:00-03:00" });
    assert.equal(productReviewCandidates(PRODUCT_A, [legacy()], [sameDay]).length, 1);
    assert.equal(findLinkedReviewForPurchase(legacy(), [sameDay]), null);
    assert.doesNotMatch(read("src/lib/product-review-entry.ts").replace(/\/\*[\s\S]*?\*\//g, ""), /reviewed_at|civilDate/);
  });
});

describe("Standalone Review", () => {
  it("writes purchase_id NULL with a stable review_id intent (double submit → no duplicate)", () => {
    const actions = read(ACTIONS);
    const body = actions.slice(actions.indexOf("export async function createStandaloneProductReview"));
    assert.match(body, /purchaseId: null,/);
    assert.match(body, /id: reviewId,/);
    assert.ok(body.indexOf("resolveHouseholdCreateOwnership(reviewId, household.id, existingReview)") < body.indexOf('from("product_reviews").insert'));
    assert.match(body, /isUniqueViolation\(insertError\)[\s\S]*?\.eq\("id", reviewId\)\.eq\("household_id", household\.id\)/);
    assert.match(body, /revalidateReviewSurfaces\(\)/);
    assert.match(read(REVIEW_NEW), /<input type="hidden" name="review_id" value=\{crypto\.randomUUID\(\)\} \/>/);
    assert.equal(productStandaloneReviewPath(PRODUCT_A), `/shopping/reviews/new?product=${PRODUCT_A}&origin=standalone`);
  });

  it("R: a standalone Review makes the Product count as history, blocking hard delete", () => {
    const rows = [{ id: PRODUCT_A, purchases: [{ count: 0 }], purchase_items: [{ count: 0 }], product_reviews: [{ count: 1 }] }];
    const hasHistory = productIdsWithHistory(rows).includes(PRODUCT_A);
    assert.equal(hasHistory, true);
    assert.deepEqual(productLifecycleOptions({ archived: false, hasHistory }), { canHardDelete: false, canArchive: true, canRestore: false });
    const commerce = read("src/lib/commerce.ts");
    const refs = commerce.slice(commerce.indexOf("export async function loadProductHistoryRefs"), commerce.indexOf("/** Exact Review linked"));
    const reviewCount = refs.split(/\r?\n/).find((line) => line.includes('from("product_reviews")')) ?? "";
    assert.match(reviewCount, /\.eq\("product_id", productId\)/);
    assert.doesNotMatch(reviewCount, /purchase_id/);
  });
});

describe("Product edit — separate Reviews section", () => {
  const edit = () => read(PRODUCT_EDIT);
  const saveForm = (source: string) => source.slice(source.indexOf("<form action={save}"), source.indexOf("</form>", source.indexOf("<form action={save}")));

  it("O: Product edit exposes a separate «Avaliações» section after the Product form", () => {
    const source = edit();
    const formEnd = source.indexOf("</form>", source.indexOf("<form action={save}"));
    const section = source.indexOf(">Avaliações</h2>");
    assert.ok(section > formEnd, "Reviews section must come after (outside) the Product form");
    assert.match(source, /loadProductReviewSummary\(supabase, household\.id, id\)/);
    assert.match(source, /reviewSummary\.count === 0 \? "Avaliar produto" : "Avaliar novamente"/);
    assert.match(source, /Editar última avaliação/);
  });

  it("P: no Review fields inside «Salvar produto»", () => {
    const form = saveForm(edit());
    assert.match(form, /Salvar produto/);
    assert.doesNotMatch(form, /StarRating|quality_score|acceptance_score|cost_benefit_score|would_buy_again|review_notes/);
  });

  it("Q: an archived Product keeps historical Review access but no new Review CTA", () => {
    assert.deepEqual(productReviewEntryPoints({ productId: PRODUCT_A, archived: true, latestReviewId: REVIEW_A }), {
      create: null,
      editLatest: `/shopping/reviews/${REVIEW_A}/edit`,
    });
    const source = edit();
    assert.match(source, /productReviewEntryPoints\(\{ productId: id, archived, latestReviewId: latestReview\?\.id \?\? null \}\)/);
    assert.match(source, /reviewEntry\.editLatest && <Link href=\{reviewEntry\.editLatest\}/);
    // Archived catalog section advertises no new Review.
    const shopping = read(SHOPPING);
    const archivedSection = shopping.slice(shopping.indexOf("archivedProducts.length > 0 &&"), shopping.indexOf("Histórico de preços"));
    assert.doesNotMatch(archivedSection, /reviews\/new|Avaliar/);
    // Product-mode Review page and the standalone action both refuse archived Products.
    assert.match(read(REVIEW_NEW), /if \(isProductArchived\(product\)\) \{[\s\S]*?PRODUCT_ARCHIVED_REVIEW_MESSAGE/);
    const actions = read(ACTIONS);
    assert.match(actions.slice(actions.indexOf("export async function createStandaloneProductReview")), /if \(isProductArchived\(product\)\) redirect\(/);
  });
});
