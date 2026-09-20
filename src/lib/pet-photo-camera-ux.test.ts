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
import {
  centeredCropOffset,
  clampCropOffset,
  containZoom,
  coverZoom,
  cropSourceRect,
} from "@/lib/profile-photo-crop";

const root = process.cwd();

describe("wave-2b pet photo camera UX", () => {
  const petAvatar = readFileSync(join(root, "src/components/pet-avatar.tsx"), "utf8");
  const petPage = readFileSync(join(root, "src/app/(app)/pets/[id]/page.tsx"), "utf8");
  const editForm = readFileSync(join(root, "src/components/edit-pet-form.tsx"), "utf8");
  const petFields = readFileSync(join(root, "src/components/pet-fields.tsx"), "utf8");
  const petActions = readFileSync(join(root, "src/app/(app)/pets/actions.ts"), "utf8");
  const petsLib = readFileSync(join(root, "src/lib/pets.ts"), "utf8");
  const cropDialog = readFileSync(join(root, "src/components/profile-photo-crop-dialog.tsx"), "utf8");
  const cropLib = readFileSync(join(root, "src/lib/profile-photo-crop.ts"), "utf8");
  const createPetForm = readFileSync(join(root, "src/components/create-pet-form.tsx"), "utf8");
  const householdMedia = readFileSync(join(root, "src/lib/household-media.ts"), "utf8");

  it("camera opens direct action menu and does not route to Edit Profile", () => {
    assert.match(petAvatar, /PetProfilePhotoControl/);
    assert.match(petAvatar, /Escolher foto/);
    assert.match(petAvatar, /Selecionar avatar/);
    assert.match(petAvatar, /Excluir foto/);
    assert.match(petAvatar, /Cancelar/);
    assert.doesNotMatch(petAvatar, /editHref|href=\{`\/pets\/\$\{.*\}\/edit`\}|Link[\s\S]*Camera/);
    assert.match(petPage, /PetProfilePhotoControl/);
    assert.doesNotMatch(petPage, /editHref=/);
  });

  it("Edit Profile no longer exposes photo input / crop", () => {
    assert.match(editForm, /includePhoto=\{false\}/);
    assert.doesNotMatch(editForm, /ProfilePhotoCropDialog|runDirectPetPhotoUpload|existingPhotoUrl|Alterar foto/);
    assert.match(editForm, /câmera no perfil/);
    assert.match(petFields, /includePhoto/);
  });

  it("choose photo opens file flow then crop; crop cancel does not mutate", () => {
    assert.match(petAvatar, /openFilePicker|fileInputRef/);
    assert.match(petAvatar, /ProfilePhotoCropDialog/);
    assert.match(petAvatar, /onCancel=\{\(\) => setCropFile\(null\)\}/);
    assert.match(petAvatar, /replacePetProfilePhoto/);
    assert.match(petAvatar, /runDirectPetPhotoUpload/);
  });

  it("crop is fixed 1:1 with zoom in/out and horizontal/vertical pan", () => {
    assert.match(cropDialog, /1:1|Recorte|perfil/);
    assert.match(cropDialog, /containZoom|coverZoom|minZoom|maxZoom/);
    assert.match(cropDialog, /onWheel|applyZoom|applyPan/);
    assert.match(cropDialog, /onPointerDown|onPointerMove/);
    assert.match(cropLib, /containZoom/);
    assert.match(cropLib, /coverZoom/);
    assert.match(cropLib, /clampCropOffset/);

    const minZ = containZoom(2000, 1000, 280);
    const coverZ = coverZoom(2000, 1000, 280);
    assert.ok(minZ < coverZ, "contain must be below cover so user can zoom out");
    assert.equal(coverZ, 280 / 1000);

    const pan = clampCropOffset(2000, 1000, coverZ, 280, -50, -80);
    assert.ok(typeof pan.offsetX === "number");
    assert.ok(typeof pan.offsetY === "number");

    const out = clampCropOffset(2000, 1000, minZ, 280, 10, 20);
    assert.ok(out.offsetX !== undefined);

    const rect = cropSourceRect({
      imageWidth: 2000,
      imageHeight: 1000,
      zoom: coverZ,
      offsetX: centeredCropOffset(2000, 1000, coverZ, 280).offsetX,
      offsetY: centeredCropOffset(2000, 1000, coverZ, 280).offsetY,
      viewportSize: 280,
    });
    assert.ok(Math.abs(rect.sw - rect.sh) < 0.01);
  });

  it("delete photo: confirm cancel stays in menu; DB-first then Storage only for storage paths", () => {
    assert.match(petAvatar, /Excluir foto de perfil\?/);
    assert.match(petAvatar, /Você poderá adicionar outra foto depois/);
    assert.match(petAvatar, /setMode\("confirm-delete"\)/);
    assert.match(petAvatar, /setMode\("menu"\)/);
    assert.match(petActions, /export async function removePetPhoto/);
    assert.match(petActions, /photo_path: null/);
    assert.match(petActions, /isStoragePetPhotoPath\(previousPath\)/);
    const removeFn = petActions.slice(petActions.indexOf("export async function removePetPhoto"));
    const dbIdx = removeFn.indexOf('photo_path: null');
    const storageIdx = removeFn.indexOf("storage.from");
    assert.ok(dbIdx >= 0 && storageIdx > dbIdx);
  });

  it("built-in avatar whitelist; arbitrary key rejected; never Storage-deleted", () => {
    assert.equal(resolveBuiltinPetAvatarId("cat-cream"), "cat-cream");
    assert.equal(resolveBuiltinPetAvatarId("marie-disney"), null);
    assert.equal(resolveBuiltinPetAvatarId("https://evil.example/x.png"), null);
    assert.equal(parseBuiltinPetAvatarId("builtin:cat-orange"), "cat-orange");
    assert.equal(parseBuiltinPetAvatarId("builtin:not-real"), null);
    assert.equal(isBuiltinPetAvatarPath("builtin:paw-neutral"), true);
    assert.equal(isStoragePetPhotoPath("builtin:cat-cream"), false);
    assert.equal(isStoragePetPhotoPath("hh/pet/profile/x.jpg"), true);
    assert.equal(builtinPetAvatarPath("cat-black"), "builtin:cat-black");
    assert.equal(builtinPetAvatarPublicUrl("cat-cream"), "/avatars/cat-cream.svg");

    assert.match(petActions, /export async function setPetBuiltinAvatar/);
    assert.match(petActions, /resolveBuiltinPetAvatarId/);
    assert.match(petsLib, /parseBuiltinPetAvatarId|builtinPetAvatarPublicUrl/);
    assert.doesNotMatch(petsLib, /createSignedUrl\(pet\.photo_path[\s\S]{0,40}builtin/);
    assert.match(householdMedia, /isStoragePetPhotoPath/);
    assert.match(petActions, /isStoragePetPhotoPath\(existing\.photo_path\)/);

    for (const avatar of BUILTIN_PET_AVATARS) {
      assert.equal(existsSync(join(root, "public", "avatars", `${avatar.id}.svg`)), true);
      const svg = readFileSync(join(root, "public", "avatars", `${avatar.id}.svg`), "utf8");
      assert.doesNotMatch(svg, /Disney|Marie|princess|Mickey|copyrighted/i);
    }
  });

  it("switch photo ↔ built-in: replace and setBuiltin clean Storage only when prior was Storage", () => {
    assert.match(petActions, /export async function replacePetProfilePhoto/);
    assert.match(petActions, /export async function setPetBuiltinAvatar/);
    assert.match(petActions, /isStoragePetPhotoPath\(existing\.photo_path\)/);
  });

  it("avatar remains larger circular cover/center; create idempotency unchanged", () => {
    assert.match(petAvatar, /profile: "size-28 md:size-32"/);
    assert.match(petAvatar, /rounded-full object-cover object-center/);
    assert.match(createPetForm, /pet_id/);
    assert.match(createPetForm, /crypto\.randomUUID\(\)/);
    assert.match(createPetForm, /runDirectPetPhotoUpload/);
    assert.match(createPetForm, /photoIntentId/);
  });

  it("no migration 0036; memory UX files untouched by this camera patch scope", () => {
    assert.doesNotMatch(petActions, /0036_/);
    let has0036 = false;
    try {
      readFileSync(join(root, "supabase/migrations/0036_anything.sql"));
      has0036 = true;
    } catch {
      has0036 = false;
    }
    assert.equal(has0036, false);
    const memoryPhoto = readFileSync(join(root, "src/components/memory-photo-input.tsx"), "utf8");
    assert.match(memoryPhoto, /Selecionar/);
    assert.match(memoryPhoto, /Excluir selecionadas/);
  });
});
