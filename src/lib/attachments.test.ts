import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_DOCUMENT,
  LAST_ATTACHMENT_REMOVAL_MESSAGE,
  assertAttachmentStoragePath,
  attachmentPayloadForRpc,
  attachmentSlotsSummary,
  basenameWithoutExtension,
  buildAttachmentStoragePath,
  canRemoveStoredAttachment,
  contentDispositionAttachment,
  detectMimeFromMagicBytes,
  documentListCardCount,
  extensionForMime,
  isAllowedAttachmentMime,
  isStorageObjectAlreadyExists,
  mergeLocalFileSelections,
  mimeMatchesMagicBytes,
  normalizeDisplayNameInput,
  prepareAttachmentUploads,
  resolveAttachmentDisplayName,
  resolveDocumentCreateOwnership,
  sanitizeOriginalFilename,
  validateAttachmentFile,
  validateAttachmentFiles,
} from "./attachments";

const HOUSEHOLD = "f2d3a4b5-c6d7-4e8f-9a0b-1c2d3e4f5a6b";
const OTHER_HOUSEHOLD = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const PET = "11111111-2222-4333-8444-555555555555";
const OTHER_PET = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const DOCUMENT = "b1b1b1b1-c2c2-4d3d-8e4e-f5f5f5f5f5f5";
const ATTACHMENT = "a9f8e7d6-c5b4-4a39-8f21-0d1e2f3a4b5c";
const ATTACHMENT_B = "c0c0c0c0-d1d1-4e2e-8f3f-a4a4a4a4a4a4";

function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01]);
}

function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
}

function webpBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  return bytes;
}

function pdfBytes(): Uint8Array {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xc7, 0xec, 0x8f, 0xa2, 0x0a, 0x31]);
}

function fileFrom(name: string, type: string, bytes: Uint8Array, size?: number, lastModified = 1): File {
  const buffer = new Uint8Array(size ?? bytes.length);
  buffer.set(bytes.slice(0, Math.min(bytes.length, buffer.length)));
  return new File([buffer], name, { type, lastModified });
}

describe("attachments validation", () => {
  it("allows known MIME types", () => {
    assert.equal(isAllowedAttachmentMime("image/jpeg"), true);
    assert.equal(isAllowedAttachmentMime("application/pdf"), true);
    assert.equal(isAllowedAttachmentMime("image/gif"), false);
    assert.equal(isAllowedAttachmentMime("application/msword"), false);
  });

  it("rejects invalid MIME on File.type", async () => {
    const file = fileFrom("x.gif", "image/gif", jpegBytes());
    const result = await validateAttachmentFile(file);
    assert.equal(result.ok, false);
  });

  it("detects magic bytes for jpeg/png/webp/pdf", () => {
    assert.equal(detectMimeFromMagicBytes(jpegBytes()), "image/jpeg");
    assert.equal(detectMimeFromMagicBytes(pngBytes()), "image/png");
    assert.equal(detectMimeFromMagicBytes(webpBytes()), "image/webp");
    assert.equal(detectMimeFromMagicBytes(pdfBytes()), "application/pdf");
    assert.equal(detectMimeFromMagicBytes(new Uint8Array([0, 1, 2, 3])), null);
  });

  it("rejects magic bytes incompatible with declared MIME", async () => {
    assert.equal(mimeMatchesMagicBytes("image/jpeg", pdfBytes()), false);
    const mismatched = fileFrom("fake.jpg", "image/jpeg", pdfBytes());
    const result = await validateAttachmentFile(mismatched);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /não corresponde/);
  });

  it("rejects files larger than 5MB", async () => {
    const huge = fileFrom("big.jpg", "image/jpeg", jpegBytes(), ATTACHMENT_MAX_BYTES + 1);
    const result = await validateAttachmentFile(huge);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /5 MB/);
  });

  it("accepts valid jpeg with matching magic bytes", async () => {
    const file = fileFrom("foto.jpg", "image/jpeg", jpegBytes());
    const result = await validateAttachmentFile(file);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.mimeType, "image/jpeg");
      assert.equal(result.value.extension, "jpg");
    }
  });

  it("sanitizes filename against traversal and control chars", () => {
    assert.equal(sanitizeOriginalFilename("../../etc/passwd"), "passwd");
    assert.equal(sanitizeOriginalFilename("pasta\\arquivo.pdf"), "arquivo.pdf");
    assert.equal(sanitizeOriginalFilename("a\nb.pdf"), "a_b.pdf");
    assert.equal(sanitizeOriginalFilename(""), "arquivo");
    const long = `${"a".repeat(200)}.pdf`;
    assert.ok(sanitizeOriginalFilename(long).length <= 180);
    assert.ok(sanitizeOriginalFilename(long).endsWith(".pdf"));
  });

  it("builds stable storage path starting with household UUID and MIME extension", () => {
    const path = buildAttachmentStoragePath(HOUSEHOLD, ATTACHMENT, "application/pdf");
    assert.equal(path, `${HOUSEHOLD}/attachments/${ATTACHMENT}/file.pdf`);
    assert.equal(extensionForMime("image/webp"), "webp");
    assert.doesNotThrow(() => assertAttachmentStoragePath(HOUSEHOLD, path));
    assert.throws(() => assertAttachmentStoragePath(HOUSEHOLD, `other/attachments/${ATTACHMENT}/x.pdf`));
  });

  it("multi-file validation keeps order and enforces max 8", async () => {
    const files = [
      fileFrom("a.jpg", "image/jpeg", jpegBytes()),
      fileFrom("b.pdf", "application/pdf", pdfBytes()),
    ];
    const ok = await validateAttachmentFiles(files);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.values.length, 2);
      assert.equal(ok.values[0].originalFilename, "a.jpg");
      assert.equal(ok.values[1].mimeType, "application/pdf");
    }
    const tooMany = await validateAttachmentFiles(files, { existingCount: 7 });
    assert.equal(tooMany.ok, false);
  });

  it("content-disposition uses sanitized original filename", () => {
    const header = contentDispositionAttachment('relatório "final".pdf');
    assert.match(header, /^attachment;/);
    assert.match(header, /filename\*=UTF-8''/);
  });
});

describe("attachments domain boundaries", () => {
  it("documents remain separate from memory_media and pet photo paths", () => {
    const attachmentPath = buildAttachmentStoragePath(HOUSEHOLD, ATTACHMENT, "image/png");
    assert.equal(attachmentPath.includes("/memories/"), false);
    assert.equal(attachmentPath.includes("profile-"), false);
    assert.ok(attachmentPath.includes("/attachments/"));
  });
});

describe("export includes attachment tables", () => {
  it("lists attachments and document_attachments without implying Storage binaries", async () => {
    const { EXPORT_HOUSEHOLD_TABLES } = await import("@/lib/export-tables");
    assert.ok(EXPORT_HOUSEHOLD_TABLES.includes("documents"));
    assert.ok(EXPORT_HOUSEHOLD_TABLES.includes("attachments"));
    assert.ok(EXPORT_HOUSEHOLD_TABLES.includes("document_attachments"));
    assert.ok(EXPORT_HOUSEHOLD_TABLES.includes("memory_media"));
  });
});

describe("create idempotency + multi-file selection", () => {
  it("same document_id ownership resolves to reuse (1 document)", () => {
    const first = resolveDocumentCreateOwnership(DOCUMENT, HOUSEHOLD, PET, null);
    assert.deepEqual(first, { ok: true, status: "create" });
    const retry = resolveDocumentCreateOwnership(DOCUMENT, HOUSEHOLD, PET, {
      id: DOCUMENT,
      household_id: HOUSEHOLD,
      pet_id: PET,
    });
    assert.deepEqual(retry, { ok: true, status: "reuse" });
  });

  it("stable attachment ids keep prepareAttachmentUploads from inventing new ids on retry", async () => {
    const files = [
      fileFrom("a.jpg", "image/jpeg", jpegBytes()),
      fileFrom("b.pdf", "application/pdf", pdfBytes()),
    ];
    const validated = await validateAttachmentFiles(files);
    assert.equal(validated.ok, true);
    if (!validated.ok) return;
    const ids = [ATTACHMENT, ATTACHMENT_B];
    const first = prepareAttachmentUploads(HOUSEHOLD, validated.values, 0, ids);
    const second = prepareAttachmentUploads(HOUSEHOLD, validated.values, 0, ids);
    assert.deepEqual(first.map((item) => item.id), ids);
    assert.deepEqual(second.map((item) => item.id), ids);
    assert.deepEqual(first.map((item) => item.storage_path), second.map((item) => item.storage_path));
    assert.equal(first.length, 2);
  });

  it("multi-file create preparation yields 1 intent with 2 attachments", async () => {
    const files = [
      fileFrom("frente.jpg", "image/jpeg", jpegBytes()),
      fileFrom("verso.pdf", "application/pdf", pdfBytes()),
    ];
    const validated = await validateAttachmentFiles(files);
    assert.equal(validated.ok, true);
    if (!validated.ok) return;
    const prepared = prepareAttachmentUploads(HOUSEHOLD, validated.values, 0, [ATTACHMENT, ATTACHMENT_B]);
    assert.equal(prepared.length, 2);
    assert.deepEqual(prepared.map((item) => item.position), [0, 1]);
  });

  it("adding a new selection preserves previous local files", () => {
    const a = fileFrom("a.jpg", "image/jpeg", jpegBytes(), undefined, 10);
    const b = fileFrom("b.pdf", "application/pdf", pdfBytes(), undefined, 20);
    const first = mergeLocalFileSelections([], [a], { createId: () => ATTACHMENT });
    assert.equal(first.items.length, 1);
    const second = mergeLocalFileSelections(first.items, [b], {
      createId: () => ATTACHMENT_B,
    });
    assert.equal(second.items.length, 2);
    assert.equal(second.items[0].file.name, "a.jpg");
    assert.equal(second.items[1].file.name, "b.pdf");
  });

  it("local duplicate selection (name+size+lastModified) does not duplicate item", () => {
    const a = fileFrom("a.jpg", "image/jpeg", jpegBytes(), undefined, 10);
    const again = fileFrom("a.jpg", "image/jpeg", jpegBytes(), undefined, 10);
    const merged = mergeLocalFileSelections([], [a, again], { createId: () => ATTACHMENT });
    assert.equal(merged.items.length, 1);
    assert.equal(merged.skippedDuplicates, 1);
  });

  it("enforces max 8 across stored + local selections", () => {
    let current: ReturnType<typeof mergeLocalFileSelections<File>>["items"] = [];
    for (let index = 0; index < 8; index += 1) {
      const file = fileFrom(`f${index}.jpg`, "image/jpeg", jpegBytes(), undefined, index + 1);
      current = mergeLocalFileSelections(current, [file], {
        maxTotal: ATTACHMENT_MAX_PER_DOCUMENT,
        createId: () => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      }).items;
    }
    assert.equal(current.length, 8);
    const overflow = mergeLocalFileSelections(current, [fileFrom("extra.jpg", "image/jpeg", jpegBytes(), undefined, 99)], {
      maxTotal: ATTACHMENT_MAX_PER_DOCUMENT,
      createId: () => ATTACHMENT_B,
    });
    assert.equal(overflow.items.length, 8);
    assert.equal(overflow.truncated, true);
  });

  it("rejects document_id that already belongs to another household", () => {
    const result = resolveDocumentCreateOwnership(DOCUMENT, HOUSEHOLD, PET, {
      id: DOCUMENT,
      household_id: OTHER_HOUSEHOLD,
      pet_id: PET,
    });
    assert.deepEqual(result, { ok: false, reason: "foreign_household" });
  });

  it("rejects document_id reused against a different pet in the same household", () => {
    const result = resolveDocumentCreateOwnership(DOCUMENT, HOUSEHOLD, PET, {
      id: DOCUMENT,
      household_id: HOUSEHOLD,
      pet_id: OTHER_PET,
    });
    assert.deepEqual(result, { ok: false, reason: "pet_mismatch" });
  });

  it("edit path can prepare multiple new attachments with stable ids", async () => {
    const files = [
      fileFrom("extra1.jpg", "image/jpeg", jpegBytes()),
      fileFrom("extra2.pdf", "application/pdf", pdfBytes()),
    ];
    const validated = await validateAttachmentFiles(files, { required: false, existingCount: 1 });
    assert.equal(validated.ok, true);
    if (!validated.ok) return;
    const prepared = prepareAttachmentUploads(HOUSEHOLD, validated.values, 1, [ATTACHMENT, ATTACHMENT_B]);
    assert.deepEqual(prepared.map((item) => item.position), [1, 2]);
    assert.equal(prepared[0].storage_path.endsWith("/file.jpg"), true);
  });

  it("storage already-exists errors are treated as idempotent upload success signals", () => {
    assert.equal(isStorageObjectAlreadyExists({ statusCode: "409", message: "The resource already exists" }), true);
    assert.equal(isStorageObjectAlreadyExists({ message: "boom" }), false);
  });

  it("delete cascade contract remains in migration 0033 (0034 is display_name only)", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0033_attachments_pet_documents.sql"), "utf8");
    assert.match(sql, /delete_pet_document/);
    assert.match(sql, /on delete cascade/);
    assert.equal(existsSync(join(process.cwd(), "supabase/migrations/0034_attachments_pet_documents.sql")), false);
    assert.equal(existsSync(join(process.cwd(), "supabase/migrations/0034_attachment_display_name.sql")), true);
  });
});

describe("attachment display_name", () => {
  it("accepts display_name in prepare + RPC payload while keeping original_filename intact", async () => {
    const files = [
      fileFrom("CNH Digital - Evandro (1).pdf", "application/pdf", pdfBytes()),
      fileFrom("IMG_8372.jpg", "image/jpeg", jpegBytes()),
    ];
    const validated = await validateAttachmentFiles(files);
    assert.equal(validated.ok, true);
    if (!validated.ok) return;
    const prepared = prepareAttachmentUploads(
      HOUSEHOLD,
      validated.values,
      0,
      [ATTACHMENT, ATTACHMENT_B],
      ["CNH — Frente", "CNH — Verso"],
    );
    assert.equal(prepared[0].original_filename, "CNH Digital - Evandro (1).pdf");
    assert.equal(prepared[1].original_filename, "IMG_8372.jpg");
    assert.equal(prepared[0].display_name, "CNH — Frente");
    assert.equal(prepared[1].display_name, "CNH — Verso");
    const payload = attachmentPayloadForRpc(prepared);
    assert.equal(payload[0].display_name, "CNH — Frente");
    assert.equal(payload[0].original_filename, "CNH Digital - Evandro (1).pdf");
    assert.equal(payload[1].display_name, "CNH — Verso");
  });

  it("fallback UI label uses basename without extension when display_name is null", () => {
    assert.equal(basenameWithoutExtension("CNH Digital - Evandro (1).pdf"), "CNH Digital - Evandro (1)");
    assert.equal(resolveAttachmentDisplayName(null, "CNH Digital - Evandro (1).pdf"), "CNH Digital - Evandro (1)");
    assert.equal(resolveAttachmentDisplayName("  ", "foto.jpg"), "foto");
    assert.equal(resolveAttachmentDisplayName("CNH — Frente", "x.pdf"), "CNH — Frente");
    assert.ok(!resolveAttachmentDisplayName(null, "a.pdf").endsWith(".pdf"));
  });

  it("normalizeDisplayNameInput trims and maps empty to null", () => {
    assert.equal(normalizeDisplayNameInput("  Frente  "), "Frente");
    assert.equal(normalizeDisplayNameInput("   "), null);
    assert.throws(() => normalizeDisplayNameInput("x".repeat(161)), /160/);
  });

  it("multi-file merge prefills distinct editable displayName per file", () => {
    const a = fileFrom("CNH Digital - Evandro (1).pdf", "application/pdf", pdfBytes(), undefined, 10);
    const b = fileFrom("IMG_8372.jpg", "image/jpeg", jpegBytes(), undefined, 20);
    const merged = mergeLocalFileSelections([], [a, b], {
      createId: (() => {
        let i = 0;
        return () => (i++ === 0 ? ATTACHMENT : ATTACHMENT_B);
      })(),
    });
    assert.equal(merged.items[0].displayName, "CNH Digital - Evandro (1)");
    assert.equal(merged.items[1].displayName, "IMG_8372");
    merged.items[0].displayName = "CNH — Frente";
    merged.items[1].displayName = "CNH — Verso";
    assert.notEqual(merged.items[0].displayName, merged.items[1].displayName);
    assert.equal(merged.items[0].file.name, "CNH Digital - Evandro (1).pdf");
  });

  it("download Content-Disposition continues to use original_filename, not display_name", () => {
    const header = contentDispositionAttachment("CNH Digital - Evandro (1).pdf");
    assert.match(header, /CNH Digital - Evandro \(1\)\.pdf/);
    assert.doesNotMatch(header, /CNH — Frente/);
  });

  it("export includes attachments table so display_name ships with row metadata", async () => {
    const { EXPORT_HOUSEHOLD_TABLES } = await import("@/lib/export-tables");
    assert.ok(EXPORT_HOUSEHOLD_TABLES.includes("attachments"));
    const route = readFileSync(join(process.cwd(), "src/app/api/export/route.ts"), "utf8");
    assert.match(route, /select\("\*"\)/);
  });

  it("editing display_name is a metadata RPC concern (no reupload path change)", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0034_attachment_display_name.sql"), "utf8");
    assert.match(sql, /update_attachment_display_name/);
    assert.match(sql, /set display_name = display_clean/);
    assert.doesNotMatch(sql, /storage_path\s*=/);
  });
});

describe("document vs attachment UX rules", () => {
  it("listing counts one card per document even with 3 attachments", () => {
    const cards = documentListCardCount([{ id: DOCUMENT, attachment_count: 3 }]);
    assert.equal(cards, 1);
  });

  it("edit slot math accounts for existing + new files", () => {
    const slots = attachmentSlotsSummary(5, 2);
    assert.equal(slots.used, 7);
    assert.equal(slots.remaining, 1);
    assert.equal(slots.label, "7 de 8");
  });

  it("last stored attachment cannot be removed", () => {
    assert.equal(canRemoveStoredAttachment(1), false);
    assert.equal(canRemoveStoredAttachment(3), true);
    assert.match(LAST_ATTACHMENT_REMOVAL_MESSAGE, /pelo menos um arquivo/);
  });

  it("title/category belong to document metadata helpers, not attachment payloads", async () => {
    const files = [fileFrom("a.jpg", "image/jpeg", jpegBytes())];
    const validated = await validateAttachmentFiles(files);
    assert.equal(validated.ok, true);
    if (!validated.ok) return;
    const prepared = prepareAttachmentUploads(HOUSEHOLD, validated.values, 0, [ATTACHMENT]);
    assert.equal("title" in prepared[0], false);
    assert.equal("category" in prepared[0], false);
    assert.ok("original_filename" in prepared[0]);
    assert.ok("display_name" in prepared[0]);
  });

  it("removing one attachment conceptually leaves document + siblings (count rules)", () => {
    const before = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const after = before.filter((item) => item.id !== "b");
    assert.equal(after.length, 2);
    assert.ok(after.some((item) => item.id === "a"));
    assert.ok(after.some((item) => item.id === "c"));
  });

  it("edit selection accumulates without replacing prior pending files", () => {
    const a = fileFrom("a.jpg", "image/jpeg", jpegBytes(), undefined, 10);
    const b = fileFrom("b.pdf", "application/pdf", pdfBytes(), undefined, 20);
    const first = mergeLocalFileSelections([], [a], { existingStoredCount: 2, createId: () => ATTACHMENT });
    const second = mergeLocalFileSelections(first.items, [b], { existingStoredCount: 2, createId: () => ATTACHMENT_B });
    assert.equal(second.items.length, 2);
    assert.equal(second.items[0].file.name, "a.jpg");
  });

  it("pending new files can be dropped before save", () => {
    const a = fileFrom("a.jpg", "image/jpeg", jpegBytes(), undefined, 10);
    const b = fileFrom("b.pdf", "application/pdf", pdfBytes(), undefined, 20);
    const selected = mergeLocalFileSelections([], [a, b], {
      createId: () => crypto.randomUUID(),
    }).items;
    const afterRemove = selected.filter((item) => item.file.name !== "a.jpg");
    assert.equal(afterRemove.length, 1);
    assert.equal(afterRemove[0].file.name, "b.pdf");
  });
});
