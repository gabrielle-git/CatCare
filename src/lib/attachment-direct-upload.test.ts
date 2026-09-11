import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ATTACHMENT_MAX_BYTES,
  buildAttachmentStoragePath,
  contentDispositionAttachment,
  mimeMatchesMagicBytes,
} from "@/lib/attachments";
import {
  assertUniqueAttachmentIds,
  attachmentsPayloadFieldName,
  canonicalAttachmentPath,
  expectedFileNameForMime,
  filterIntentsForScope,
  parseAttachmentsPayload,
  toRpcAttachmentPayload,
  validateIntentMetadata,
  type AttachmentUploadIntent,
} from "@/lib/attachment-direct-upload";
import { readAttachmentsPayload } from "@/lib/attachment-finalize";

const HOUSEHOLD = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const PET_A = "33333333-3333-4333-8333-333333333333";
const PET_B = "44444444-4444-4444-8444-444444444444";
const ATT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const ATT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const ATT_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ATT_D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function intent(partial: Partial<AttachmentUploadIntent> & Pick<AttachmentUploadIntent, "attachment_id">): AttachmentUploadIntent {
  return {
    original_filename: "arquivo.pdf",
    display_name: null,
    mime_type: "application/pdf",
    byte_size: 2 * 1024 * 1024,
    pet_id: null,
    care_type: null,
    ...partial,
  };
}

describe("attachment direct-upload transport", () => {
  it("builds canonical path from household + attachment_id + MIME (not client filename)", () => {
    const path = canonicalAttachmentPath(HOUSEHOLD, intent({
      attachment_id: ATT_A,
      mime_type: "image/jpeg",
      original_filename: "evil.exe.jpg",
    }));
    assert.equal(path, `${HOUSEHOLD}/attachments/${ATT_A}/file.jpg`);
    assert.equal(expectedFileNameForMime("application/pdf"), "file.pdf");
    assert.equal(path, buildAttachmentStoragePath(HOUSEHOLD, ATT_A, "image/jpeg"));
  });

  it("rejects client-invented cross-household storage_path via assert helpers", () => {
    const foreign = `${HOUSEHOLD_B}/attachments/${ATT_A}/file.pdf`;
    assert.notEqual(foreign.startsWith(`${HOUSEHOLD}/`), true);
    const expected = canonicalAttachmentPath(HOUSEHOLD, intent({ attachment_id: ATT_A }));
    assert.equal(expected.startsWith(`${HOUSEHOLD}/attachments/`), true);
    assert.notEqual(expected, foreign);
  });

  it("keeps attachment_id stable across payload round-trip", () => {
    const raw = JSON.stringify([intent({ attachment_id: ATT_A, pet_id: PET_A, care_type: "exam" })]);
    const parsed = parseAttachmentsPayload(raw);
    assert.equal(parsed[0]?.attachment_id, ATT_A);
    assert.equal(parsed[0]?.pet_id, PET_A);
    assert.equal(parsed[0]?.care_type, "exam");
  });

  it("rejects invalid mime and oversize byte_size in metadata", () => {
    assert.match(String(validateIntentMetadata(intent({
      attachment_id: ATT_A,
      mime_type: "application/pdf",
      byte_size: ATTACHMENT_MAX_BYTES + 1,
    }))), /5 MB/);
    assert.throws(
      () => parseAttachmentsPayload(JSON.stringify([{
        attachment_id: ATT_A,
        original_filename: "x.bin",
        display_name: "",
        mime_type: "application/octet-stream",
        byte_size: 100,
      }])),
      /não permitido|inválido/i,
    );
  });

  it("accepts allowed mime types under 5 MB", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const) {
      assert.equal(validateIntentMetadata(intent({ attachment_id: ATT_A, mime_type: mime, byte_size: 1024 })), null);
    }
  });

  it("filters pet×type scopes without leakage", () => {
    const intents = [
      intent({ attachment_id: ATT_A, pet_id: PET_A, care_type: "exam" }),
      intent({ attachment_id: ATT_B, pet_id: PET_A, care_type: "vaccine" }),
      intent({ attachment_id: ATT_C, pet_id: PET_B, care_type: "exam" }),
      intent({ attachment_id: ATT_D, pet_id: PET_B, care_type: "vaccine" }),
    ];
    assert.deepEqual(
      filterIntentsForScope(intents, "exam", PET_A).map((item) => item.attachment_id),
      [ATT_A],
    );
    assert.deepEqual(
      filterIntentsForScope(intents, "vaccine", PET_B).map((item) => item.attachment_id),
      [ATT_D],
    );
    assert.equal(filterIntentsForScope(intents, "exam", PET_B)[0]?.attachment_id, ATT_C);
    // Unscoped intents never leak into clinical buckets
    assert.equal(filterIntentsForScope([intent({ attachment_id: ATT_A })], "exam", PET_A).length, 0);
  });

  it("rejects duplicate attachment ids in one intention", () => {
    assert.throws(
      () => assertUniqueAttachmentIds([
        intent({ attachment_id: ATT_A }),
        intent({ attachment_id: ATT_A }),
      ]),
      /duplicados/i,
    );
  });

  it("magic bytes still distinguish JPEG/PNG/WEBP/PDF", () => {
    assert.equal(mimeMatchesMagicBytes("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0x00])), true);
    assert.equal(mimeMatchesMagicBytes("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
    assert.equal(mimeMatchesMagicBytes("application/pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
    assert.equal(mimeMatchesMagicBytes("application/pdf", new Uint8Array([0xff, 0xd8, 0xff])), false);
  });

  it("RPC payload recalculates position and keeps server path", () => {
    const path = canonicalAttachmentPath(HOUSEHOLD, intent({ attachment_id: ATT_A }));
    const payload = toRpcAttachmentPayload([{
      ...intent({ attachment_id: ATT_A, display_name: "Hemograma" }),
      storage_path: path,
      byte_size: 2048,
    }], 3);
    assert.equal(payload[0]?.position, 3);
    assert.equal(payload[0]?.storage_path, path);
    assert.equal(payload[0]?.id, ATT_A);
  });

  it("factual FormData stays metadata-only and small even for multi-MB files", () => {
    const form = new FormData();
    const intents = [
      intent({ attachment_id: ATT_A, pet_id: PET_A, care_type: "exam", byte_size: 2 * 1024 * 1024 }),
      intent({ attachment_id: ATT_B, pet_id: PET_A, care_type: "vaccine", byte_size: 2 * 1024 * 1024 }),
      intent({ attachment_id: ATT_C, pet_id: PET_B, care_type: "exam", byte_size: 2 * 1024 * 1024 }),
      intent({ attachment_id: ATT_D, pet_id: PET_B, care_type: "consultation", byte_size: 2 * 1024 * 1024 }),
    ];
    // Simulate binary total > 4.5 MB while payload is only JSON metadata
    const binaryTotal = intents.reduce((sum, item) => sum + item.byte_size, 0);
    assert.ok(binaryTotal > 4.5 * 1024 * 1024);
    form.set(attachmentsPayloadFieldName(), JSON.stringify(intents));
    const read = readAttachmentsPayload(form);
    assert.equal(read.length, 4);
    const serialized = String(form.get(attachmentsPayloadFieldName()));
    assert.ok(serialized.length < 50_000, `metadata payload too large: ${serialized.length}`);
    assert.ok(serialized.length < 1024 * 1024);
    for (const entry of form.values()) {
      assert.equal(entry instanceof File, false);
    }
  });

  it("download disposition still uses original_filename", () => {
    assert.match(contentDispositionAttachment("resultado-exame.pdf"), /resultado-exame\.pdf/);
  });
});

describe("direct-upload wiring (source contracts)", () => {
  const root = process.cwd();
  const createActions = readFileSync(join(root, "src/app/(app)/records/new/actions.ts"), "utf8");
  const updateActions = readFileSync(join(root, "src/app/(app)/records/actions.ts"), "utf8");
  const docActions = readFileSync(join(root, "src/app/(app)/pets/[id]/documents/actions.ts"), "utf8");
  const prepareActions = readFileSync(join(root, "src/app/(app)/attachments/actions.ts"), "utf8");
  const newRecordPage = readFileSync(join(root, "src/app/(app)/records/new/page.tsx"), "utf8");
  const editForm = readFileSync(join(root, "src/components/edit-record-form.tsx"), "utf8");
  const directForm = readFileSync(join(root, "src/components/direct-upload-form.tsx"), "utf8");
  const docNew = readFileSync(join(root, "src/app/(app)/pets/[id]/documents/new/page.tsx"), "utf8");
  const docEdit = readFileSync(join(root, "src/app/(app)/pets/[id]/documents/[documentId]/edit/page.tsx"), "utf8");
  const healthFields = readFileSync(join(root, "src/components/health-record-attachments-fields.tsx"), "utf8");
  const docFields = readFileSync(join(root, "src/components/document-fields.tsx"), "utf8");
  const clientUpload = readFileSync(join(root, "src/lib/attachment-direct-upload-client.ts"), "utf8");
  const finalize = readFileSync(join(root, "src/lib/attachment-direct-upload.ts"), "utf8");

  it("prepare action authenticates household from session (never client household_id)", () => {
    assert.match(prepareActions, /ensureHousehold/);
    assert.match(prepareActions, /createSignedUploadUrl|createSignedUploadForPath/);
    assert.doesNotMatch(prepareActions, /service_role/);
    assert.doesNotMatch(prepareActions, /household_id.*formData|formData.*household/);
  });

  it("create/update health + documents reject File binaries in Server Actions", () => {
    assert.match(createActions, /instanceof File/);
    assert.match(updateActions, /instanceof File/);
    assert.match(docActions, /assertNoBinaryFiles/);
    assert.match(createActions, /attachments_payload|readAttachmentsPayload/);
    assert.match(docActions, /readAttachmentsPayload/);
    assert.doesNotMatch(createActions, /uploadPreparedAttachments/);
    assert.doesNotMatch(docActions, /uploadPreparedAttachments/);
  });

  it("forms use DirectUploadForm / edit form direct upload before factual action", () => {
    assert.match(newRecordPage, /DirectUploadForm/);
    assert.match(docNew, /DirectUploadForm/);
    assert.match(docEdit, /DirectUploadForm/);
    assert.match(editForm, /runDirectAttachmentUploads/);
    assert.match(directForm, /runDirectAttachmentUploads/);
  });

  it("pickers register Files in client registry (not FormData files__ fields)", () => {
    assert.match(healthFields, /registerPendingAttachmentFile/);
    assert.match(docFields, /registerPendingAttachmentFile/);
    assert.doesNotMatch(healthFields, /DataTransfer|input\.files\s*=/);
    assert.doesNotMatch(docFields, /name=\"files\"/);
  });

  it("client uploads via uploadToSignedUrl with concurrency limit and no upsert", () => {
    assert.match(clientUpload, /uploadToSignedUrl/);
    assert.match(clientUpload, /DEFAULT_CONCURRENCY = 3/);
    assert.match(clientUpload, /upsert:\s*false/);
  });

  it("server validates stored object magic bytes and can remove invalid objects", () => {
    assert.match(finalize, /validateStoredAttachmentObject/);
    assert.match(finalize, /mimeMatchesMagicBytes/);
    assert.match(readFileSync(join(root, "src/lib/attachment-finalize.ts"), "utf8"), /removeStoragePaths/);
  });

  it("compensation only targets household attachments paths", () => {
    assert.match(prepareActions, /compensateAttachmentUploadsAction/);
    assert.match(prepareActions, /\/attachments\//);
  });

  it("exam round-trip still maps exam type (no silent other)", () => {
    assert.match(createActions, /isAttachableQuickRecordType/);
    assert.match(createActions, /filterIntentsForScope/);
  });

  it("no next.config bodySizeLimit workaround required for attachments", () => {
    const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");
    assert.doesNotMatch(nextConfig, /bodySizeLimit/);
  });

  it("no migration 0036 introduced", () => {
    const list = readdirSync(join(root, "supabase/migrations"));
    assert.equal(list.some((name) => name.includes("0036")), false);
  });
});

describe("audit report — pet photo + memory_media (report-only)", () => {
  it("documents that both still send File through Server Actions", () => {
    const pets = readFileSync(join(process.cwd(), "src/app/(app)/pets/actions.ts"), "utf8");
    const memories = readFileSync(join(process.cwd(), "src/app/(app)/memories/actions.ts"), "utf8");
    assert.match(pets, /instanceof File/);
    assert.match(pets, /upload\(path, photo/);
    assert.match(memories, /instanceof File/);
    assert.match(memories, /formData\.getAll\("photos"\)/);
    assert.match(pets, /5 MB/);
    assert.match(memories, /5 MB/);
    assert.match(memories, /MAX_PHOTOS = 8/);
  });
});
