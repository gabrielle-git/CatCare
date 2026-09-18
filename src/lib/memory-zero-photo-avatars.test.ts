import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  BUILTIN_PET_AVATARS,
  builtinPetAvatarPath,
  builtinPetAvatarPublicUrl,
  isBuiltinPetAvatarPath,
  isStoragePetPhotoPath,
  parseBuiltinPetAvatarId,
  resolveBuiltinPetAvatarId,
} from "@/lib/pet-avatars";
import { parseMemoryMediaPayload } from "@/lib/memory-media-upload";

const root = process.cwd();

describe("wave-2b-qa avatar assets + memory zero photos", () => {
  it("every whitelist ID has a unique ASCII-valid SVG asset on disk", () => {
    const ids = BUILTIN_PET_AVATARS.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);

    for (const avatar of BUILTIN_PET_AVATARS) {
      const assetPath = join(root, "public", "avatars", `${avatar.id}.svg`);
      assert.equal(existsSync(assetPath), true, `missing asset for ${avatar.id}`);
      const bytes = readFileSync(assetPath);
      assert.equal(
        [...bytes].every((b) => b <= 127),
        true,
        `${avatar.id}.svg must be ASCII/UTF-8-safe (Latin-1 high bytes break SVG rendering)`,
      );
      const text = bytes.toString("utf8");
      assert.match(text, /^<svg[\s\S]*<\/svg>\s*$/);
      assert.equal((text.match(/<svg\b/g) ?? []).length, 1);
      assert.equal((text.match(/<\/svg>/g) ?? []).length, 1);
      assert.match(text, /viewBox="0 0 128 128"/);
      assert.doesNotMatch(text, /Disney|Marie|princess|Mickey/i);
    }

    assert.equal(resolveBuiltinPetAvatarId("dog-cream"), "dog-cream");
    assert.equal(resolveBuiltinPetAvatarId("dog-brown"), "dog-brown");
    assert.equal(builtinPetAvatarPublicUrl("dog-cream"), "/avatars/dog-cream.svg");
    assert.equal(builtinPetAvatarPublicUrl("dog-brown"), "/avatars/dog-brown.svg");
    assert.equal(existsSync(join(root, "public/avatars/dog-cream.svg")), true);
    assert.equal(existsSync(join(root, "public/avatars/dog-brown.svg")), true);
  });

  it("rejects arbitrary builtin IDs; storage helpers never treat builtins as objects", () => {
    assert.equal(resolveBuiltinPetAvatarId("not-a-real-avatar"), null);
    assert.equal(parseBuiltinPetAvatarId("builtin:hacker"), null);
    assert.equal(isBuiltinPetAvatarPath("builtin:cat-cream"), true);
    assert.equal(isStoragePetPhotoPath(builtinPetAvatarPath("cat-cream")), false);
  });

  it("avatar UI falls back safely on image error", () => {
    const petAvatar = readFileSync(join(root, "src/components/pet-avatar.tsx"), "utf8");
    assert.match(petAvatar, /onError=\{\(\) => setBroken\(true\)\}/);
    assert.match(petAvatar, /setBroken\(false\)/);
  });

  it("Memory create/update/bulk-delete allow zero photos; cover preserved or cleared correctly", () => {
    const actions = readFileSync(join(root, "src/app/(app)/memories/actions.ts"), "utf8");
    const createForm = readFileSync(join(root, "src/components/create-memory-form.tsx"), "utf8");
    const photoInput = readFileSync(join(root, "src/components/memory-photo-input.tsx"), "utf8");
    const gallery = readFileSync(join(root, "src/components/memory-gallery.tsx"), "utf8");

    assert.doesNotMatch(actions, /Escolha ao menos uma foto para guardar esta memória/);
    assert.doesNotMatch(actions, /A memória precisa continuar com ao menos uma foto/);
    assert.doesNotMatch(createForm, /Escolha ao menos uma foto para guardar esta memória/);
    assert.match(photoInput, /Adicione até \{MEMORY_MEDIA_MAX_PHOTOS\} fotos \(opcional\)/);
    assert.match(photoInput, /Nenhuma foto nesta memória/);
    assert.doesNotMatch(photoInput, /required=\{!hasCurrentPhoto/);
    assert.match(gallery, /Nenhuma foto nesta memória/);

    // Bulk delete: preserve cover when still remaining; else promote remaining[0]; else null.
    assert.match(actions, /preservedCover/);
    assert.match(actions, /remaining\.length === 0 \? null/);

    // Empty payload parses as zero intents.
    assert.deepEqual(parseMemoryMediaPayload(""), []);
    assert.deepEqual(parseMemoryMediaPayload("   "), []);
  });

  it("direct-upload + idempotency wiring still present", () => {
    const actions = readFileSync(join(root, "src/app/(app)/memories/actions.ts"), "utf8");
    const createForm = readFileSync(join(root, "src/components/create-memory-form.tsx"), "utf8");
    assert.match(actions, /resolveMemoryCreateOwnership/);
    assert.match(actions, /ensureMemoryMediaRows/);
    assert.match(createForm, /runDirectMemoryMediaUploads/);
    assert.match(createForm, /memory_id/);
  });
});
