import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATTACHMENT_MAX_BYTES,
  assertAttachmentStoragePath,
  buildAttachmentStoragePath,
  contentDispositionAttachment,
  detectMimeFromMagicBytes,
  extensionForMime,
  isAllowedAttachmentMime,
  mimeMatchesMagicBytes,
  sanitizeOriginalFilename,
  validateAttachmentFile,
  validateAttachmentFiles,
} from "./attachments";

const HOUSEHOLD = "f2d3a4b5-c6d7-4e8f-9a0b-1c2d3e4f5a6b";
const ATTACHMENT = "a9f8e7d6-c5b4-4a39-8f21-0d1e2f3a4b5c";

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

function fileFrom(name: string, type: string, bytes: Uint8Array, size?: number): File {
  const buffer = new Uint8Array(size ?? bytes.length);
  buffer.set(bytes.slice(0, Math.min(bytes.length, buffer.length)));
  return new File([buffer], name, { type });
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

  it("builds storage path starting with household UUID and MIME extension", () => {
    const path = buildAttachmentStoragePath(HOUSEHOLD, ATTACHMENT, "application/pdf");
    assert.ok(path.startsWith(`${HOUSEHOLD}/attachments/${ATTACHMENT}/`));
    assert.ok(path.endsWith(".pdf"));
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

describe("multi-file positions", () => {
  it("prepareAttachmentUploads assigns sequential positions", async () => {
    const { prepareAttachmentUploads } = await import("./attachments");
    const files = [
      fileFrom("a.jpg", "image/jpeg", jpegBytes()),
      fileFrom("b.pdf", "application/pdf", pdfBytes()),
    ];
    const validated = await validateAttachmentFiles(files);
    assert.equal(validated.ok, true);
    if (!validated.ok) return;
    const prepared = prepareAttachmentUploads(HOUSEHOLD, validated.values, 0);
    assert.deepEqual(prepared.map((item) => item.position), [0, 1]);
    assert.equal(prepared[0].storage_path.startsWith(`${HOUSEHOLD}/attachments/`), true);
  });
});
