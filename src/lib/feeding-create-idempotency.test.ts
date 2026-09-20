import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildFeedingItems, buildFeedingSessionBatchPayload } from "@/lib/feeding-care";
import { resolveRecordSource } from "@/lib/record-form";

const root = process.cwd();
const PET_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PET_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const SESSION_A = "11111111-1111-4111-8111-111111111111";
const SESSION_B = "22222222-2222-4222-8222-222222222222";

describe("feeding create idempotency (0036)", () => {
  it("migration 0036 preserves legacy overload and adds session_id overload", () => {
    const migration = readFileSync(join(root, "supabase/migrations/0036_feeding_session_idempotency.sql"), "utf8");
    assert.match(migration, /create or replace function public\.create_feeding_session\(\s*p_session_id uuid/);
    assert.match(migration, /on conflict \(id\) do nothing/i);
    assert.match(migration, /for update/i);
    assert.match(migration, /delete from public\.feeding_items where session_id = p_session_id/i);
    assert.match(migration, /_feeding_insert_items/);
    assert.match(migration, /_feeding_assert_can_edit_pet/);
    assert.match(migration, /security definer/i);
    assert.match(migration, /set search_path = public/);
    assert.match(migration, /grant execute on function public\.create_feeding_session\(uuid, uuid, timestamptz, text, text, jsonb\) to authenticated/i);
    // Batch keeps external signature; optional session_id in payload.
    assert.match(migration, /create or replace function public\.create_feeding_sessions_batch/);
    assert.match(migration, /session_raw/);
    assert.match(migration, /Legacy path/);
    // Must not DROP legacy 5-arg create.
    assert.doesNotMatch(migration, /drop function.*create_feeding_session\(uuid,\s*timestamptz/i);
  });

  it("only feeding_session_idempotency owns 0036 in this wave", () => {
    const extras = readdirSync(join(root, "supabase/migrations")).filter((name) => /^0036/.test(name));
    assert.deepEqual(extras, ["0036_feeding_session_idempotency.sql"]);
  });

  it("stable session ID enters batch payload; multi-pet uses distinct ids", () => {
    const built = buildFeedingItems(["dry_food"], null);
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const batch = buildFeedingSessionBatchPayload({
      petIds: [PET_A, PET_B],
      notesByPetId: () => null,
      defaultItems: built.items,
      sessionIdsByPetId: new Map([
        [PET_A, SESSION_A],
        [PET_B, SESSION_B],
      ]),
    });
    assert.equal(batch.ok, true);
    if (!batch.ok) return;
    assert.equal(batch.payload.length, 2);
    assert.equal(batch.payload[0].session_id, SESSION_A);
    assert.equal(batch.payload[1].session_id, SESSION_B);
    assert.notEqual(batch.payload[0].session_id, batch.payload[1].session_id);
  });

  it("10 submits of the same intent keep the same session ids in the payload", () => {
    const built = buildFeedingItems(["milk"], null);
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const ids = new Set<string>();
    for (let i = 0; i < 10; i += 1) {
      const batch = buildFeedingSessionBatchPayload({
        petIds: [PET_A],
        notesByPetId: () => (i % 2 === 0 ? "ok" : "ajustado"),
        defaultItems: built.items,
        sessionIdsByPetId: () => SESSION_A,
      });
      assert.equal(batch.ok, true);
      if (!batch.ok) return;
      assert.equal(batch.payload[0].session_id, SESSION_A);
      ids.add(batch.payload[0].session_id!);
    }
    assert.equal(ids.size, 1);
  });

  it("legacy payload without session_id stays compatible (omit field)", () => {
    const built = buildFeedingItems(["wet_food"], null);
    assert.equal(built.ok, true);
    if (!built.ok) return;
    const batch = buildFeedingSessionBatchPayload({
      petIds: [PET_A],
      notesByPetId: () => null,
      defaultItems: built.items,
    });
    assert.equal(batch.ok, true);
    if (!batch.ok) return;
    assert.equal(batch.payload[0].session_id, undefined);
    assert.equal("session_id" in batch.payload[0], false);
  });

  it("createRecord wires record_ids_json feeding ids into the batch payload", () => {
    const actions = readFileSync(join(root, "src/app/(app)/records/new/actions.ts"), "utf8");
    assert.match(actions, /readStableRecordIdForPetType\(formData, pet\.id, "feeding"/);
    assert.match(actions, /sessionIdsByPetId/);
    assert.match(actions, /buildFeedingSessionBatchPayload\(/);
    assert.match(actions, /create_feeding_sessions_batch/);
  });

  it("SQL reuse path replaces items; foreign pet mismatch is rejected before item mutation", () => {
    const migration = readFileSync(join(root, "supabase/migrations/0036_feeding_session_idempotency.sql"), "utf8");
    const ownershipIdx = migration.search(/existing_pet is distinct from p_pet_id/);
    const deleteIdx = migration.search(/delete from public\.feeding_items where session_id = p_session_id/i);
    assert.ok(ownershipIdx >= 0);
    assert.ok(deleteIdx > ownershipIdx, "ownership reject must precede item DELETE");
    assert.match(migration, /Não foi possível salvar esta refeição/);
    assert.match(migration, /perform public\._feeding_insert_items\(p_session_id, p_items\)/);
    assert.match(migration, /for update/i);
    // No artificial uniqueness on pet+time (would collide legitimate same-minute meals).
    assert.doesNotMatch(migration, /unique\s*\(\s*pet_id\s*,\s*occurred_at/i);
  });

  it("batch resolves overloads by arity: 6-arg with session_id, 5-arg legacy", () => {
    const migration = readFileSync(join(root, "supabase/migrations/0036_feeding_session_idempotency.sql"), "utf8");
    // Idempotent call site has 6 arguments starting with session_id variable.
    assert.match(
      migration,
      /sid := public\.create_feeding_session\(\s*session_id,\s*\(entry->>'pet_id'\)::uuid/,
    );
    // Legacy call site has 5 arguments starting with pet_id.
    assert.match(
      migration,
      /sid := public\.create_feeding_session\(\s*\(entry->>'pet_id'\)::uuid,\s*p_occurred_at/,
    );
  });

  it("edit replace_feeding_session and neonatal legacy remain intact", () => {
    const mig0032 = readFileSync(join(root, "supabase/migrations/0032_feeding_sessions.sql"), "utf8");
    const mig0036 = readFileSync(join(root, "supabase/migrations/0036_feeding_session_idempotency.sql"), "utf8");
    const editActions = readFileSync(join(root, "src/app/(app)/records/actions.ts"), "utf8");
    assert.match(mig0032, /create or replace function public\.replace_feeding_session/);
    assert.doesNotMatch(mig0036, /replace_feeding_session/);
    assert.match(editActions, /replace_feeding_session/);
    assert.match(editActions, /p_session_id: recordId/);
    assert.doesNotMatch(mig0036, /neonatal_records/);
    assert.equal(resolveRecordSource("feeding"), "feeding");
    assert.equal(resolveRecordSource("urine"), "neonatal");
  });

  it("timeline still classifies feeding_sessions as Feeding", () => {
    const records = readFileSync(join(root, "src/lib/records.ts"), "utf8");
    assert.match(records, /source: "feeding"/);
    assert.match(records, /kind: "feeding"/);
    assert.match(records, /feedingSessionTimelineTitle/);
    assert.equal(existsSync(join(root, "supabase/migrations/0036_feeding_session_idempotency.sql")), true);
  });
});
