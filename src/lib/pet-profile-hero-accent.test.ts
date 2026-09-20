import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import surfaceData from "@/lib/pet-avatar-surfaces.json";
import {
  BUILTIN_AVATAR_SURFACE_PALETTE,
  BUILTIN_AVATAR_SURFACE_TOKENS,
  BUILTIN_PET_AVATARS,
  DEFAULT_PROFILE_HERO_BACKGROUND,
  PROFILE_HERO_SURFACE_BACKGROUNDS,
  builtinPetAvatarPath,
  filterBuiltinPetAvatars,
  getBuiltinAvatarSurfaceHex,
  resolveProfileHeroBackground,
} from "@/lib/pet-avatars";

const root = process.cwd();
const surfaceTokenSet = new Set<string>(BUILTIN_AVATAR_SURFACE_TOKENS);

describe("wave-2b profile hero builtin surface calibration", () => {
  it("every builtin has valid surface metadata from the shared palette", () => {
    assert.equal(BUILTIN_PET_AVATARS.length, 36);
    assert.equal(Object.keys(surfaceData.byId).length, 36);
    for (const avatar of BUILTIN_PET_AVATARS) {
      assert.ok(surfaceTokenSet.has(avatar.surface), `${avatar.id} surface ${avatar.surface}`);
      assert.equal(surfaceData.byId[avatar.id], avatar.surface);
      assert.ok(BUILTIN_AVATAR_SURFACE_PALETTE[avatar.surface]?.hex);
      assert.ok(PROFILE_HERO_SURFACE_BACKGROUNDS[avatar.surface]);
    }
  });

  it("registry surface hex matches SVG outer circle and generator source-of-truth", () => {
    assert.deepEqual([...BUILTIN_AVATAR_SURFACE_TOKENS], ["lavender", "cream"]);
    assert.equal(surfaceData.palette.lavender.hex, "#EDE8F5");
    assert.equal(surfaceData.palette.cream.hex, "#F3E6D4");

    for (const avatar of BUILTIN_PET_AVATARS) {
      const expectedHex = getBuiltinAvatarSurfaceHex(avatar.id);
      const svg = readFileSync(join(root, "public/avatars", `${avatar.id}.svg`), "utf8");
      const match = svg.match(/<circle cx="64" cy="64" r="64" fill="(#[0-9A-Fa-f]{6})"\/>/);
      assert.ok(match, `${avatar.id} missing outer circle`);
      assert.equal(match![1].toUpperCase(), expectedHex.toUpperCase(), `${avatar.id} SVG surface`);
    }

    const generator = readFileSync(join(root, "scripts/generate-pet-avatars.mjs"), "utf8");
    assert.match(generator, /pet-avatar-surfaces\.json/);
    assert.match(generator, /function surfaceHex\(/);
    assert.doesNotMatch(generator, /bg\("#EDE8F5"\)|bg\("#F3E6D4"\)/);
  });

  it("hero tint preserves the same hue family as the avatar surface", () => {
    const catHero = resolveProfileHeroBackground(builtinPetAvatarPath("cat-orange"));
    const dogHero = resolveProfileHeroBackground(builtinPetAvatarPath("dog-golden"));
    assert.equal(catHero, PROFILE_HERO_SURFACE_BACKGROUNDS.lavender);
    assert.equal(dogHero, PROFILE_HERO_SURFACE_BACKGROUNDS.cream);
    assert.match(catHero, /#EDE8F5/i);
    assert.match(dogHero, /#F3E6D4/i);
    assert.notEqual(catHero, dogHero);
    // Softened stop stays in-family (not beige for lavender / not lavender for cream).
    assert.match(catHero, /#F6F3FA/i);
    assert.match(dogHero, /#F9F3EA/i);
  });

  it("uploaded photo, null, and invalid builtin fall back to standard lavender", () => {
    assert.equal(resolveProfileHeroBackground(null), DEFAULT_PROFILE_HERO_BACKGROUND);
    assert.equal(resolveProfileHeroBackground(undefined), DEFAULT_PROFILE_HERO_BACKGROUND);
    assert.equal(
      resolveProfileHeroBackground("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/profile/x.jpg"),
      DEFAULT_PROFILE_HERO_BACKGROUND,
    );
    assert.equal(resolveProfileHeroBackground("builtin:not-real"), DEFAULT_PROFILE_HERO_BACKGROUND);
    assert.match(DEFAULT_PROFILE_HERO_BACKGROUND, /lavender-soft/);
  });

  it("all 36 builtins resolve successfully; filters stay intact", () => {
    for (const avatar of BUILTIN_PET_AVATARS) {
      const hero = resolveProfileHeroBackground(builtinPetAvatarPath(avatar.id));
      assert.equal(hero, PROFILE_HERO_SURFACE_BACKGROUNDS[avatar.surface]);
    }
    assert.equal(filterBuiltinPetAvatars("all").length, 36);
    assert.ok(filterBuiltinPetAvatars("cat").every((item) => item.category === "cat"));
    assert.ok(filterBuiltinPetAvatars("dog").every((item) => item.category === "dog"));
    assert.ok(filterBuiltinPetAvatars("other").every((item) => item.category === "other"));
  });

  it("pet profile page applies resolveProfileHeroBackground without photo sampling", () => {
    const page = readFileSync(join(root, "src/app/(app)/pets/[id]/page.tsx"), "utf8");
    assert.match(page, /resolveProfileHeroBackground\(pet\.photo_path\)/);
    assert.match(page, /style=\{\{ backgroundImage: heroBackground \}\}/);
    assert.doesNotMatch(page, /getImageData|canvas|createImageBitmap|vibrant|color-thief/i);
  });
});
