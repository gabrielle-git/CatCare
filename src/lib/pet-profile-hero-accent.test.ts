import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  BUILTIN_AVATAR_ACCENTS,
  BUILTIN_PET_AVATARS,
  DEFAULT_PROFILE_HERO_BACKGROUND,
  PROFILE_HERO_ACCENT_BACKGROUNDS,
  builtinPetAvatarPath,
  resolveProfileHeroBackground,
} from "@/lib/pet-avatars";

const root = process.cwd();
const accentSet = new Set<string>(BUILTIN_AVATAR_ACCENTS);

describe("wave-2b profile hero builtin accent", () => {
  it("every builtin avatar has a valid controlled accent token", () => {
    for (const avatar of BUILTIN_PET_AVATARS) {
      assert.ok(accentSet.has(avatar.accent), `${avatar.id} accent ${avatar.accent}`);
      assert.ok(PROFILE_HERO_ACCENT_BACKGROUNDS[avatar.accent]);
    }
  });

  it("accent values come only from the allowed palette", () => {
    assert.deepEqual([...BUILTIN_AVATAR_ACCENTS], [
      "cream",
      "peach",
      "lavender",
      "rose",
      "sage",
      "sky",
      "warm-neutral",
    ]);
    for (const key of Object.keys(PROFILE_HERO_ACCENT_BACKGROUNDS)) {
      assert.ok(accentSet.has(key));
    }
  });

  it("builtin avatars resolve to their accent; different accents can differ", () => {
    const orange = resolveProfileHeroBackground(builtinPetAvatarPath("cat-orange"));
    const blue = resolveProfileHeroBackground(builtinPetAvatarPath("cat-blue"));
    const cream = resolveProfileHeroBackground(builtinPetAvatarPath("cat-cream"));
    assert.equal(orange, PROFILE_HERO_ACCENT_BACKGROUNDS.peach);
    assert.equal(blue, PROFILE_HERO_ACCENT_BACKGROUNDS.sky);
    assert.equal(cream, PROFILE_HERO_ACCENT_BACKGROUNDS.cream);
    assert.notEqual(orange, blue);
  });

  it("uploaded photo, null, and invalid builtin fall back to standard lavender", () => {
    assert.equal(resolveProfileHeroBackground(null), DEFAULT_PROFILE_HERO_BACKGROUND);
    assert.equal(resolveProfileHeroBackground(undefined), DEFAULT_PROFILE_HERO_BACKGROUND);
    assert.equal(
      resolveProfileHeroBackground("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/profile/x.jpg"),
      DEFAULT_PROFILE_HERO_BACKGROUND,
    );
    assert.equal(resolveProfileHeroBackground("builtin:not-real"), DEFAULT_PROFILE_HERO_BACKGROUND);
    assert.equal(resolveProfileHeroBackground("builtin:"), DEFAULT_PROFILE_HERO_BACKGROUND);
    assert.equal(DEFAULT_PROFILE_HERO_BACKGROUND, PROFILE_HERO_ACCENT_BACKGROUNDS.lavender);
  });

  it("switching semantics: builtin tint vs photo/default lavender", () => {
    const tinted = resolveProfileHeroBackground(builtinPetAvatarPath("dog-golden"));
    assert.equal(tinted, PROFILE_HERO_ACCENT_BACKGROUNDS.peach);
    assert.equal(resolveProfileHeroBackground("household/pet/profile/intent.jpg"), DEFAULT_PROFILE_HERO_BACKGROUND);
    assert.equal(resolveProfileHeroBackground(builtinPetAvatarPath("paw-neutral")), PROFILE_HERO_ACCENT_BACKGROUNDS.lavender);
    assert.equal(resolveProfileHeroBackground(null), DEFAULT_PROFILE_HERO_BACKGROUND);
  });

  it("pet profile page applies resolveProfileHeroBackground to the hero only", () => {
    const page = readFileSync(join(root, "src/app/(app)/pets/[id]/page.tsx"), "utf8");
    assert.match(page, /resolveProfileHeroBackground\(pet\.photo_path\)/);
    assert.match(page, /style=\{\{ backgroundImage: heroBackground \}\}/);
    assert.doesNotMatch(page, /getImageData|canvas|createImageBitmap|vibrant|color-thief/i);
  });
});
