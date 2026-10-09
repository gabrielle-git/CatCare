import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncEntityPets } from "@/lib/entity-pets";
import { REVIEW_NOT_FOUND_MESSAGE, updateHouseholdRow, updateProductReviewWithPets } from "@/lib/household-row-update";

const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const PRODUCT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PRODUCT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const REVIEW_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const REVIEW_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const PET_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const PET_A2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const PET_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3";
const MISSING = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type Row = Record<string, unknown>;

/**
 * In-memory PostgREST stand-in for a member of `viewer`: RLS hides other households' rows and
 * rejects inserts outside `viewer`; review_pets.review_id only checks that the Review exists
 * (any household), like the real FK.
 */
function rlsClient(viewer: string, seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]));
  const writes: { table: string; op: string }[] = [];
  const client = {
    from(table: string) {
      const rows = (tables[table] ??= []);
      let op: "select" | "update" | "delete" | "insert" = "select";
      let payload: Row | Row[] = {};
      let returning = false;
      const eqs: [string, unknown][] = [];
      const ins: [string, unknown[]][] = [];
      const matches = (row: Row) =>
        row.household_id === viewer && eqs.every(([key, value]) => row[key] === value) && ins.every(([key, values]) => values.includes(row[key]));
      const execute = () => {
        if (op === "insert") {
          const list = Array.isArray(payload) ? payload : [payload];
          if (list.some((row) => row.household_id !== viewer)) return { data: null, error: { code: "42501", message: "rls" } };
          if (table === "review_pets" && list.some((row) => !(tables.product_reviews ?? []).some((review) => review.id === row.review_id))) {
            return { data: null, error: { code: "23503", message: "fk" } };
          }
          rows.push(...list.map((row) => ({ ...row })));
          return { data: null, error: null };
        }
        const hit = rows.filter(matches);
        if (op === "update") {
          for (const row of hit) Object.assign(row, payload);
          return { data: returning ? hit.map((row) => ({ id: row.id })) : null, error: null };
        }
        if (op === "delete") {
          for (const row of hit) rows.splice(rows.indexOf(row), 1);
          return { data: null, error: null };
        }
        return { data: hit.map((row) => ({ id: row.id })), error: null };
      };
      const builder = {
        select() {
          if (op !== "select") returning = true;
          return builder;
        },
        update(patch: Row) {
          op = "update";
          payload = patch;
          writes.push({ table, op });
          return builder;
        },
        delete() {
          op = "delete";
          writes.push({ table, op });
          return builder;
        },
        insert(values: Row | Row[]) {
          op = "insert";
          payload = values;
          writes.push({ table, op });
          return builder;
        },
        eq(column: string, value: unknown) {
          eqs.push([column, value]);
          return builder;
        },
        in(column: string, values: unknown[]) {
          ins.push([column, values]);
          return builder;
        },
        async maybeSingle() {
          const result = execute();
          const list = result.data as Row[] | null;
          return { data: list?.[0] ?? null, error: result.error };
        },
        then<T>(resolve: (value: ReturnType<typeof execute>) => T, reject?: (reason: unknown) => T) {
          return Promise.resolve(execute()).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, tables, writes };
}

function seed() {
  return {
    products: [
      { id: PRODUCT_A, household_id: HOUSEHOLD_A, name: "Areia A" },
      { id: PRODUCT_B, household_id: HOUSEHOLD_B, name: "Areia B" },
    ],
    product_reviews: [
      { id: REVIEW_A, household_id: HOUSEHOLD_A, quality_score: 3, notes: "antes" },
      { id: REVIEW_B, household_id: HOUSEHOLD_B, quality_score: 3, notes: "alheia" },
    ],
    pets: [
      { id: PET_A, household_id: HOUSEHOLD_A },
      { id: PET_A2, household_id: HOUSEHOLD_A },
      { id: PET_B, household_id: HOUSEHOLD_B },
    ],
    review_pets: [{ household_id: HOUSEHOLD_A, review_id: REVIEW_A, pet_id: PET_A }],
  };
}

const reviewPatch = { quality_score: 5, notes: "editada" };

describe("schema gap that made the review sync unsafe", () => {
  it("review_pets accepts a foreign review_id when the household and pet are the caller's own", async () => {
    const { client, tables } = rlsClient(HOUSEHOLD_A, seed());
    await syncEntityPets(client, "review_pets", HOUSEHOLD_A, REVIEW_B, [PET_A]);
    assert.ok(tables.review_pets.some((row) => row.review_id === REVIEW_B));
  });
});

describe("updateProductReviewWithPets", () => {
  it("E: foreign review → not_found, review untouched, no review_pets write", async () => {
    const { client, tables, writes } = rlsClient(HOUSEHOLD_A, seed());
    const result = await updateProductReviewWithPets(client, HOUSEHOLD_A, REVIEW_B, reviewPatch, [PET_A]);
    assert.deepEqual(result, { ok: false, reason: "not_found" });
    assert.deepEqual(tables.product_reviews.find((row) => row.id === REVIEW_B), { id: REVIEW_B, household_id: HOUSEHOLD_B, quality_score: 3, notes: "alheia" });
    assert.equal(tables.review_pets.length, 1);
    assert.ok(!tables.review_pets.some((row) => row.review_id === REVIEW_B));
    assert.deepEqual(writes.filter((write) => write.table !== "product_reviews"), []);
  });

  it("F: missing UUID → same external result as foreign; non-UUID never queries", async () => {
    const { client, tables, writes } = rlsClient(HOUSEHOLD_A, seed());
    const missing = await updateProductReviewWithPets(client, HOUSEHOLD_A, MISSING, reviewPatch, [PET_A]);
    const foreign = await updateProductReviewWithPets(client, HOUSEHOLD_A, REVIEW_B, reviewPatch, [PET_A]);
    assert.deepEqual(missing, foreign);
    assert.equal(tables.review_pets.length, 1);

    const before = writes.length;
    assert.deepEqual(await updateProductReviewWithPets(client, HOUSEHOLD_A, "not-a-uuid", reviewPatch, [PET_A]), { ok: false, reason: "not_found" });
    assert.equal(writes.length, before);
  });

  it("G: own review → updated and pets replaced", async () => {
    const { client, tables } = rlsClient(HOUSEHOLD_A, seed());
    const result = await updateProductReviewWithPets(client, HOUSEHOLD_A, REVIEW_A, reviewPatch, [PET_A2]);
    assert.deepEqual(result, { ok: true });
    const review = tables.product_reviews.find((row) => row.id === REVIEW_A);
    assert.equal(review?.quality_score, 5);
    assert.equal(review?.notes, "editada");
    assert.deepEqual(tables.review_pets, [{ household_id: HOUSEHOLD_A, review_id: REVIEW_A, pet_id: PET_A2 }]);
  });

  it("G: own review with no pets clears its links", async () => {
    const { client, tables } = rlsClient(HOUSEHOLD_A, seed());
    assert.deepEqual(await updateProductReviewWithPets(client, HOUSEHOLD_A, REVIEW_A, reviewPatch, []), { ok: true });
    assert.deepEqual(tables.review_pets, []);
  });

  it("G: own review with a foreign pet → error, no link to that pet", async () => {
    const { client, tables } = rlsClient(HOUSEHOLD_A, seed());
    const result = await updateProductReviewWithPets(client, HOUSEHOLD_A, REVIEW_A, reviewPatch, [PET_B]);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, "error");
    assert.ok(!tables.review_pets.some((row) => row.pet_id === PET_B));
  });
});

describe("updateHouseholdRow on products", () => {
  const patch = { name: "Renomeado" };

  it("H: foreign product → not_found and untouched", async () => {
    const { client, tables } = rlsClient(HOUSEHOLD_A, seed());
    assert.deepEqual(await updateHouseholdRow(client, "products", PRODUCT_B, HOUSEHOLD_A, patch), { ok: false, reason: "not_found" });
    assert.equal(tables.products.find((row) => row.id === PRODUCT_B)?.name, "Areia B");
  });

  it("I: missing UUID → same result as foreign", async () => {
    const { client } = rlsClient(HOUSEHOLD_A, seed());
    assert.deepEqual(
      await updateHouseholdRow(client, "products", MISSING, HOUSEHOLD_A, patch),
      await updateHouseholdRow(client, "products", PRODUCT_B, HOUSEHOLD_A, patch),
    );
  });

  it("J: own product → updated", async () => {
    const { client, tables } = rlsClient(HOUSEHOLD_A, seed());
    assert.deepEqual(await updateHouseholdRow(client, "products", PRODUCT_A, HOUSEHOLD_A, patch), { ok: true });
    assert.equal(tables.products.find((row) => row.id === PRODUCT_A)?.name, "Renomeado");
  });

  it("database error is reported as error, not as not_found", async () => {
    const failing = {
      from: () => ({
        update: () => failing.from(),
        eq: () => failing.from(),
        select: () => failing.from(),
        maybeSingle: async () => ({ data: null, error: { message: "boom" } }),
      }),
    };
    assert.deepEqual(
      await updateHouseholdRow(failing as unknown as SupabaseClient, "products", PRODUCT_A, HOUSEHOLD_A, patch),
      { ok: false, reason: "error", message: "boom" },
    );
  });
});

describe("product/review update wiring (source contracts)", () => {
  const actions = readFileSync(join(process.cwd(), "src/app/(app)/shopping/actions.ts"), "utf8");
  const body = (name: string) => {
    const start = actions.indexOf(`export async function ${name}(`);
    return actions.slice(start, actions.indexOf("\nexport ", start + 1));
  };

  it("updateProduct only redirects with updated=1 after a confirmed row", () => {
    const fn = body("updateProduct");
    assert.match(fn, /updateHouseholdRow\(supabase, "products", productId, household\.id/);
    assert.match(fn, /redirect\(`\/shopping\?error=\$\{encodeURIComponent\(PRODUCT_NOT_FOUND_MESSAGE\)\}`\)/);
    assert.ok(fn.indexOf("if (!updated.ok)") < fn.indexOf('redirect("/shopping?updated=1")'));
    assert.doesNotMatch(fn, /from\("products"\)\.update/);
  });

  it("updateProductReview syncs pets only through the confirmed-update helper", () => {
    const fn = body("updateProductReview");
    assert.match(fn, /updateProductReviewWithPets\(supabase, household\.id, reviewId/);
    assert.match(fn, /redirect\(`\/shopping\?error=\$\{encodeURIComponent\(REVIEW_NOT_FOUND_MESSAGE\)\}`\)/);
    assert.ok(fn.indexOf("if (!updated.ok)") < fn.indexOf('redirect("/shopping?updated=1")'));
    assert.doesNotMatch(fn, /syncEntityPets/);
    assert.doesNotMatch(fn, /from\("product_reviews"\)\.update/);
  });

  it("not-found copy is generic", () => {
    assert.equal(REVIEW_NOT_FOUND_MESSAGE, "Avaliação não encontrada.");
  });
});
