import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/0033_attachments_pet_documents.sql"),
  "utf8",
);

describe("0033 schema intent", () => {
  it("enforces same-household composite FKs on document_attachments", () => {
    assert.match(migration, /document_attachments_document_household_fkey/);
    assert.match(migration, /document_attachments_attachment_household_fkey/);
    assert.match(migration, /references public\.documents \(id, household_id\)/);
    assert.match(migration, /references public\.attachments \(id, household_id\)/);
  });

  it("cascades document delete through links and attachment delete RPC", () => {
    assert.match(migration, /on delete cascade/);
    assert.match(migration, /create or replace function public\.delete_pet_document/);
    assert.match(migration, /delete from public\.attachments/);
  });

  it("does not alter memory_media table or pet photo columns", () => {
    assert.doesNotMatch(migration, /alter table public\.memory_media/);
    assert.doesNotMatch(migration, /alter table public\.pets/);
    assert.match(migration, /intentionally untouched/);
  });

  it("deprecates documents.storage_path for new writes", () => {
    assert.match(migration, /alter column storage_path drop not null/);
    assert.match(migration, /LEGACY\/DEPRECATED/);
  });
});
