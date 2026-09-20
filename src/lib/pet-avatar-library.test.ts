import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  BUILTIN_AVATAR_CATEGORIES,
  BUILTIN_AVATAR_FILTERS,
  BUILTIN_PET_AVATARS,
  builtinPetAvatarPath,
  builtinPetAvatarPublicUrl,
  filterBuiltinPetAvatars,
  isStoragePetPhotoPath,
  resolveBuiltinPetAvatarId,
} from "@/lib/pet-avatars";

const root = process.cwd();

const LEGACY_STARTER_IDS = [
  "cat-cream",
  "cat-orange",
  "cat-black",
  "cat-gray",
  "cat-white",
  "cat-tabby",
  "dog-cream",
  "dog-brown",
  "paw-neutral",
] as const;

describe("wave-2b expanded avatar library", () => {
  it("every registry avatar has a unique ASCII-safe SVG asset", () => {
    const ids = BUILTIN_PET_AVATARS.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(BUILTIN_PET_AVATARS.length >= 30);
    assert.ok(BUILTIN_PET_AVATARS.length <= 40);

    for (const avatar of BUILTIN_PET_AVATARS) {
      assert.ok((BUILTIN_AVATAR_CATEGORIES as readonly string[]).includes(avatar.category));
      assert.ok(Array.isArray(avatar.tags));
      const assetPath = join(root, "public", "avatars", `${avatar.id}.svg`);
      assert.equal(existsSync(assetPath), true, `missing ${avatar.id}.svg`);
      const bytes = readFileSync(assetPath);
      assert.equal(
        [...bytes].every((b) => b <= 127),
        true,
        `${avatar.id}.svg must stay ASCII-safe`,
      );
      const text = bytes.toString("utf8");
      assert.match(text, /viewBox="0 0 128 128"/);
      assert.equal((text.match(/<svg\b/g) ?? []).length, 1);
      assert.doesNotMatch(text, /Disney|Marie|princess|Mickey|copyrighted/i);
    }
  });

  it("legacy starter IDs remain valid", () => {
    for (const id of LEGACY_STARTER_IDS) {
      assert.equal(resolveBuiltinPetAvatarId(id), id);
      assert.equal(existsSync(join(root, "public/avatars", `${id}.svg`)), true);
    }
  });

  it("rejects invalid IDs; builtins are never Storage paths", () => {
    assert.equal(resolveBuiltinPetAvatarId("marie-disney"), null);
    assert.equal(resolveBuiltinPetAvatarId("https://evil.example/x.png"), null);
    assert.equal(isStoragePetPhotoPath(builtinPetAvatarPath("cat-cream")), false);
    assert.equal(isStoragePetPhotoPath("hh/pet/profile/x.jpg"), true);
  });

  it("category filters: Todos / Gatos / Caes / Outros", () => {
    const all = filterBuiltinPetAvatars("all");
    const cats = filterBuiltinPetAvatars("cat");
    const dogs = filterBuiltinPetAvatars("dog");
    const other = filterBuiltinPetAvatars("other");

    assert.equal(all.length, BUILTIN_PET_AVATARS.length);
    assert.ok(cats.every((item) => item.category === "cat"));
    assert.ok(dogs.every((item) => item.category === "dog"));
    assert.ok(other.every((item) => item.category === "other"));
    assert.equal(cats.length + dogs.length + other.length, all.length);
    assert.ok(cats.length >= 14);
    assert.ok(dogs.length >= 12);
    assert.ok(other.length >= 6);

    assert.deepEqual(
      BUILTIN_AVATAR_FILTERS.map((item) => item.id),
      ["all", "cat", "dog", "other"],
    );
  });

  it("selector UX wires filters without losing selection semantics", () => {
    const petAvatar = readFileSync(join(root, "src/components/pet-avatar.tsx"), "utf8");
    assert.match(petAvatar, /BUILTIN_AVATAR_FILTERS/);
    assert.match(petAvatar, /filterBuiltinPetAvatars\(avatarFilter\)/);
    assert.match(petAvatar, /setAvatarFilter/);
    assert.match(petAvatar, /pickedAvatar/);
    assert.match(petAvatar, /setPetBuiltinAvatar/);
    assert.match(petAvatar, /overflow-y-auto/);
    assert.match(petAvatar, /grid-cols-2.*sm:grid-cols-3.*md:grid-cols-4|grid-cols-2 gap-3 sm:grid-cols-3/);
    // Selection is independent of filter — switching filter does not clear pickedAvatar.
    assert.doesNotMatch(petAvatar, /setAvatarFilter\([^\)]*setPickedAvatar\(null\)/);
  });

  it("persisted path remains builtin:{id}; Storage delete still guarded", () => {
    assert.equal(builtinPetAvatarPublicUrl("dog-golden"), "/avatars/dog-golden.svg");
    assert.equal(builtinPetAvatarPath("bird-parrot"), "builtin:bird-parrot");
    const actions = readFileSync(join(root, "src/app/(app)/pets/actions.ts"), "utf8");
    assert.match(actions, /isStoragePetPhotoPath\(existing\.photo_path\)/);
    assert.match(actions, /setPetBuiltinAvatar/);
  });
});
