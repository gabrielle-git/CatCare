import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  canRemoveHealthRecordAttachment,
  canRemoveStoredAttachment,
  contentDispositionAttachment,
  resolveDocumentCreateOwnership,
} from "@/lib/attachments";
import { EXPORT_HOUSEHOLD_TABLES } from "@/lib/export-tables";
import {
  mapFormTypeToHealthRecordType,
  resolveHealthRecordCreateOwnership,
} from "@/lib/health-record-type";

const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const PET_A = "33333333-3333-4333-8333-333333333333";
const PET_B = "44444444-4444-4444-8444-444444444444";
const RECORD_ID = "55555555-5555-4555-8555-555555555555";

describe("health_record type mapper", () => {
  it("maps exam create/edit to exam (never silent other)", () => {
    assert.equal(mapFormTypeToHealthRecordType("exam"), "exam");
  });

  it("preserves valid schema types including disease/allergy/surgery", () => {
    assert.equal(mapFormTypeToHealthRecordType("disease"), "disease");
    assert.equal(mapFormTypeToHealthRecordType("allergy"), "allergy");
    assert.equal(mapFormTypeToHealthRecordType("surgery"), "surgery");
    assert.equal(mapFormTypeToHealthRecordType("consultation"), "consultation");
    assert.equal(mapFormTypeToHealthRecordType("vaccine"), "vaccine");
  });

  it("maps UI observation to other without collapsing other valid types", () => {
    assert.equal(mapFormTypeToHealthRecordType("observation"), "other");
    assert.equal(mapFormTypeToHealthRecordType("other"), "other");
  });
});

describe("health_record create idempotency ownership", () => {
  it("treats same household/pet retry as reuse", () => {
    const result = resolveHealthRecordCreateOwnership(RECORD_ID, HOUSEHOLD_A, PET_A, {
      id: RECORD_ID,
      household_id: HOUSEHOLD_A,
      pet_id: PET_A,
    });
    assert.deepEqual(result, { ok: true, status: "reuse" });
  });

  it("rejects cross-household reuse", () => {
    const result = resolveHealthRecordCreateOwnership(RECORD_ID, HOUSEHOLD_A, PET_A, {
      id: RECORD_ID,
      household_id: HOUSEHOLD_B,
      pet_id: PET_A,
    });
    assert.deepEqual(result, { ok: false, reason: "foreign_household" });
  });

  it("rejects pet mismatch", () => {
    const result = resolveHealthRecordCreateOwnership(RECORD_ID, HOUSEHOLD_A, PET_A, {
      id: RECORD_ID,
      household_id: HOUSEHOLD_A,
      pet_id: PET_B,
    });
    assert.deepEqual(result, { ok: false, reason: "pet_mismatch" });
  });

  it("allows first create when absent", () => {
    assert.deepEqual(
      resolveHealthRecordCreateOwnership(RECORD_ID, HOUSEHOLD_A, PET_A, null),
      { ok: true, status: "create" },
    );
  });
});

describe("health_record attachments contracts", () => {
  it("allows zero attachments and removing the last clinical file", () => {
    assert.equal(canRemoveHealthRecordAttachment(1), true);
    assert.equal(canRemoveHealthRecordAttachment(0), true);
    assert.equal(canRemoveStoredAttachment(1), false);
  });

  it("export includes health_record_attachments without implying Storage binaries", () => {
    assert.ok(EXPORT_HOUSEHOLD_TABLES.includes("health_record_attachments"));
    assert.ok(EXPORT_HOUSEHOLD_TABLES.includes("attachments"));
    assert.ok(!EXPORT_HOUSEHOLD_TABLES.includes("storage.objects" as never));
  });

  it("download disposition still prefers original_filename", () => {
    const header = contentDispositionAttachment("IMG_20260910_192833.pdf");
    assert.match(header, /IMG_20260910_192833\.pdf/);
    assert.doesNotMatch(header, /Resultado do hemograma/);
  });

  it("migration 0035 is the only new clinical attachments migration", () => {
    assert.equal(existsSync(join(process.cwd(), "supabase/migrations/0035_health_record_attachments.sql")), true);
    assert.equal(existsSync(join(process.cwd(), "supabase/migrations/0036_health_record_attachments.sql")), false);
  });

  it("create/update actions wire exam mapper and attachment RPCs", () => {
    const createSql = readFileSync(join(process.cwd(), "src/app/(app)/records/new/actions.ts"), "utf8");
    const updateSql = readFileSync(join(process.cwd(), "src/app/(app)/records/actions.ts"), "utf8");
    assert.match(createSql, /mapFormTypeToHealthRecordType/);
    assert.match(createSql, /resolveHealthRecordCreateOwnership/);
    assert.match(createSql, /add_health_record_attachments/);
    assert.match(createSql, /findVaccineDoseByHealthRecordId/);
    assert.match(createSql, /existingReminder/);
    assert.match(updateSql, /mapFormTypeToHealthRecordType/);
    assert.match(updateSql, /purge_health_record_attachments/);
    assert.match(updateSql, /delete_health_record_attachment/);
  });

  it("document create ownership helper remains intact", () => {
    assert.deepEqual(
      resolveDocumentCreateOwnership(RECORD_ID, HOUSEHOLD_A, PET_A, {
        id: RECORD_ID,
        household_id: HOUSEHOLD_A,
        pet_id: PET_A,
      }),
      { ok: true, status: "reuse" },
    );
  });

  it("feeding / memory / pet photo paths stay out of 0035", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0035_health_record_attachments.sql"), "utf8");
    assert.doesNotMatch(sql, /feeding_sessions/);
    assert.doesNotMatch(sql, /memory_media/);
    assert.doesNotMatch(sql, /photo_path/);
    assert.doesNotMatch(sql, /document_attachments/);
  });
});
