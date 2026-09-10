import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const migration0033 = readFileSync(
  path.join(process.cwd(), "supabase/migrations/0033_attachments_pet_documents.sql"),
  "utf8",
);
const migration0034 = readFileSync(
  path.join(process.cwd(), "supabase/migrations/0034_attachment_display_name.sql"),
  "utf8",
);

describe("0033 schema intent", () => {
  it("enforces same-household composite FKs on document_attachments", () => {
    assert.match(migration0033, /document_attachments_document_household_fkey/);
    assert.match(migration0033, /document_attachments_attachment_household_fkey/);
    assert.match(migration0033, /references public\.documents \(id, household_id\)/);
    assert.match(migration0033, /references public\.attachments \(id, household_id\)/);
  });

  it("cascades document delete through links and attachment delete RPC", () => {
    assert.match(migration0033, /on delete cascade/);
    assert.match(migration0033, /create or replace function public\.delete_pet_document/);
    assert.match(migration0033, /delete from public\.attachments/);
  });

  it("does not alter memory_media table or pet photo columns", () => {
    assert.doesNotMatch(migration0033, /alter table public\.memory_media/);
    assert.doesNotMatch(migration0033, /alter table public\.pets/);
    assert.match(migration0033, /intentionally untouched/);
  });

  it("deprecates documents.storage_path for new writes", () => {
    assert.match(migration0033, /alter column storage_path drop not null/);
    assert.match(migration0033, /LEGACY\/DEPRECATED/);
  });
});

describe("0034 attachment display_name", () => {
  it("adds nullable display_name without touching original_filename semantics", () => {
    assert.match(migration0034, /add column if not exists display_name text null/);
    assert.match(migration0034, /original_filename remains the uploaded name/);
    assert.doesNotMatch(migration0034, /drop column.*original_filename/i);
    assert.doesNotMatch(migration0034, /rename column original_filename/i);
  });

  it("exposes update_attachment_display_name without Storage rename", () => {
    assert.match(migration0034, /create or replace function public\.update_attachment_display_name/);
    assert.doesNotMatch(migration0034, /storage\.objects/);
  });

  it("does not create a 0035 migration", () => {
    assert.equal(existsSync(path.join(process.cwd(), "supabase/migrations/0035_attachment_display_name.sql")), false);
    const extras = readdirSync(path.join(process.cwd(), "supabase/migrations")).filter((name) => /^0035/.test(name));
    assert.deepEqual(extras, []);
  });
});
