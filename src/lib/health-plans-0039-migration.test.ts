import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const migrationPath = join(root, "supabase/migrations/0039_health_plans_multi_plan.sql");
const originalPath = join(root, "supabase/migrations/0019_health_plans_and_purchase_discounts.sql");

describe("0039 health plans multi-plan schema contract", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const original = readFileSync(originalPath, "utf8");
  const migrations = readdirSync(join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql"));

  it("is the only 0039 file", () => {
    assert.deepEqual(
      migrations.filter((name) => name.startsWith("0039_")),
      ["0039_health_plans_multi_plan.sql"],
    );
  });

  it("adds optional ended_at as date and does not backfill or delete rows", () => {
    assert.match(sql, /add column if not exists ended_at date/);
    assert.doesNotMatch(sql, /delete from public\.health_plans/i);
    assert.doesNotMatch(sql, /delete from public\.health_plan_copay_rules/i);
    assert.doesNotMatch(sql, /update public\.health_plans/i);
    assert.match(original, /unique \(pet_id\)/);
  });

  it("checks only the active × ended_at implication", () => {
    assert.match(sql, /health_plans_active_ended_at_check/);
    assert.match(sql, /check \(ended_at is null or active = false\)/);
    assert.doesNotMatch(sql, /active = true or ended_at is not null/i);
  });

  it("drops UNIQUE (pet_id) and does not add a partial unique index on active plans", () => {
    assert.match(sql, /UNIQUE \(pet_id\)/);
    assert.match(sql, /drop constraint %I/);
    assert.match(sql, /create index if not exists health_plans_pet_idx/);
    assert.doesNotMatch(sql, /create unique index/i);
    assert.doesNotMatch(sql, /where active/i);
  });

  it("adds a composite pet/household FK and aborts on mismatched rows", () => {
    assert.match(sql, /health_plans_pet_household_fkey/);
    assert.match(sql, /foreign key \(pet_id, household_id\)/);
    assert.match(sql, /references public\.pets \(id, household_id\)/);
    assert.match(sql, /on delete cascade/);
    assert.match(sql, /0039 aborted: health_plans row has no pet in the same household/);
  });

  it("keeps copay, RLS and auth untouched", () => {
    assert.doesNotMatch(sql, /health_plan_copay_rules/);
    assert.doesNotMatch(sql, /row level security/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /auth\./i);
  });

  it("documents stable-id idempotency without a second key", () => {
    assert.match(sql, /stable id/i);
    assert.doesNotMatch(sql, /idempotency_key/i);
  });
});
