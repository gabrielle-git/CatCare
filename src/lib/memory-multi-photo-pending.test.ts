import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  clearPendingAttachmentFiles,
  getPendingAttachmentFile,
  listPendingAttachmentIds,
  registerPendingAttachmentFile,
  unregisterPendingAttachmentFile,
} from "@/lib/attachment-file-registry";

const root = process.cwd();

/**
 * Simulates the broken React effect cleanup keyed on `pending`:
 * whenever the pending list grows, the previous cleanup unregisters every
 * prior mediaId — which is exactly what produced
 * "Seleção de fotos inconsistente" on the second photo.
 */
function brokenPendingKeyedCleanup(previousIds: string[], nextIds: string[]) {
  for (const id of previousIds) unregisterPendingAttachmentFile(id);
  // Broken path never re-registers survivors; nextIds are assumed already registered
  // by addFiles (only the newly appended ones).
  void nextIds;
}

/**
 * Correct unmount-only cleanup: survivors stay registered until explicit
 * clear/discard or component unmount.
 */
function unmountOnlyCleanup(ids: string[]) {
  for (const id of ids) unregisterPendingAttachmentFile(id);
}

describe("memory multi-photo pending registry", () => {
  it("broken pending-keyed cleanup drops the first photo when a second is added", () => {
    clearPendingAttachmentFiles();
    const file1 = new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" });
    const file2 = new File([new Uint8Array([4, 5, 6])], "b.jpg", { type: "image/jpeg" });
    registerPendingAttachmentFile("media-1", file1);
    registerPendingAttachmentFile("media-2", file2);

    // User had [media-1], then adds media-2 → React runs cleanup for previous pending.
    brokenPendingKeyedCleanup(["media-1"], ["media-1", "media-2"]);

    assert.equal(getPendingAttachmentFile("media-1"), undefined, "first photo was unregistered");
    assert.ok(getPendingAttachmentFile("media-2"), "second photo still registered by addFiles");
    assert.deepEqual(listPendingAttachmentIds(), ["media-2"]);
    clearPendingAttachmentFiles();
  });

  it("unmount-only cleanup keeps every pending photo registered across successive selections", () => {
    clearPendingAttachmentFiles();
    const files = [1, 2, 5].flatMap((n) =>
      Array.from({ length: n }, (_, index) => {
        const id = `media-${n}-${index}`;
        const file = new File([new Uint8Array([n, index])], `${id}.jpg`, { type: "image/jpeg" });
        registerPendingAttachmentFile(id, file);
        return id;
      }),
    );

    // Growing the pending list must not touch the registry.
    for (const id of files) {
      assert.ok(getPendingAttachmentFile(id), `${id} must remain until unmount/clear`);
    }
    assert.equal(listPendingAttachmentIds().length, files.length);

    // Explicit discard / unmount is the only cleanup.
    unmountOnlyCleanup(files);
    assert.deepEqual(listPendingAttachmentIds(), []);
  });

  it("explicit clearPending removes only the listed media ids", () => {
    clearPendingAttachmentFiles();
    registerPendingAttachmentFile("keep", new File([new Uint8Array([9])], "keep.jpg", { type: "image/jpeg" }));
    registerPendingAttachmentFile("drop", new File([new Uint8Array([8])], "drop.jpg", { type: "image/jpeg" }));
    clearPendingAttachmentFiles(["drop"]);
    assert.ok(getPendingAttachmentFile("keep"));
    assert.equal(getPendingAttachmentFile("drop"), undefined);
    clearPendingAttachmentFiles();
  });

  it("memory-photo-input re-registers on pending change and revokes Object URLs only on unmount", () => {
    const source = readFileSync(join(root, "src/components/memory-photo-input.tsx"), "utf8");
    assert.match(source, /registerPendingAttachmentFile\(item\.mediaId, item\.file\)/);
    assert.match(source, /pendingRef\.current = pending/);
    assert.match(source, /URL\.revokeObjectURL\(item\.url\)/);
    assert.doesNotMatch(source, /useEffect\(\(\) => \(\) => \{/);
    // Must not revoke inside the pending-keyed effect (that blanked still-visible previews).
    const pendingDep = source.indexOf("}, [pending]);");
    assert.ok(pendingDep >= 0);
    const pendingEffect = source.slice(Math.max(0, pendingDep - 450), pendingDep);
    assert.match(pendingEffect, /registerPendingAttachmentFile\(item\.mediaId, item\.file\)/);
    assert.match(pendingEffect, /unregisterPendingAttachmentFile\(item\.mediaId\)/);
    assert.doesNotMatch(pendingEffect, /revokeObjectURL/);
    assert.match(source, /Seleção inconsistente|multi-photo/);
    assert.match(source, /multiple/);
    assert.match(source, /MEMORY_MEDIA_MAX_PHOTOS/);
  });

  it("re-register after pending-keyed cleanup keeps every prior photo", () => {
    clearPendingAttachmentFiles();
    const file1 = new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" });
    const file2 = new File([new Uint8Array([2])], "b.jpg", { type: "image/jpeg" });
    registerPendingAttachmentFile("media-1", file1);
    // Simulate React: cleanup previous [media-1], then effect re-registers [media-1, media-2].
    unregisterPendingAttachmentFile("media-1");
    registerPendingAttachmentFile("media-1", file1);
    registerPendingAttachmentFile("media-2", file2);
    assert.ok(getPendingAttachmentFile("media-1"));
    assert.ok(getPendingAttachmentFile("media-2"));
    clearPendingAttachmentFiles();
  });
});
