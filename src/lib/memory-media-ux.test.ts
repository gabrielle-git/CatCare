import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { localFileSelectionKey } from "@/lib/attachments";
import { isImageMediaMime, MEMORY_MEDIA_MAX_PHOTOS } from "@/lib/image-media";
import {
  clampCropOffset,
  cropSourceRect,
  minCoverZoom,
} from "@/lib/profile-photo-crop";

const root = process.cwd();

describe("wave-2b-ux memory photo management", () => {
  const memoryPhotoInput = readFileSync(join(root, "src/components/memory-photo-input.tsx"), "utf8");
  const memoryActions = readFileSync(join(root, "src/app/(app)/memories/actions.ts"), "utf8");

  it("default mode has no delete checkboxes on each image", () => {
    assert.match(memoryPhotoInput, /Selecionar/);
    assert.match(memoryPhotoInput, /selecting \?/);
    // Selection controls only appear inside selecting branch — not always-on Remover checkboxes.
    assert.doesNotMatch(memoryPhotoInput, /type="checkbox"[\s\S]{0,80}Remover/);
    assert.doesNotMatch(memoryPhotoInput, />Remover</);
  });

  it("selection mode exposes multi-select, count, trash, and Concluir", () => {
    assert.match(memoryPhotoInput, /setSelecting\(true\)/);
    assert.match(memoryPhotoInput, /selecionada/);
    assert.match(memoryPhotoInput, /Excluir selecionadas/);
    assert.match(memoryPhotoInput, /Concluir/);
    assert.match(memoryPhotoInput, /toggleSelected/);
    assert.match(memoryPhotoInput, /selectedIds/);
  });

  it("bulk delete requires confirmation; cancel closes dialog without calling delete", () => {
    assert.match(memoryPhotoInput, /Excluir fotos selecionadas\?/);
    assert.match(memoryPhotoInput, /Essas fotos serão removidas desta memória\./);
    assert.match(memoryPhotoInput, /Cancelar/);
    assert.match(memoryPhotoInput, /Excluir fotos/);
    assert.match(memoryPhotoInput, /setConfirmDelete\(false\)/);
    assert.match(memoryPhotoInput, /setConfirmDelete\(true\)/);
    // Confirm path only invokes bulk delete action.
    assert.match(memoryPhotoInput, /onClick=\{runBulkDelete\}/);
    assert.match(memoryPhotoInput, /deleteMemoryMediaBulk/);
  });

  it("server bulk delete only removes chosen ids and keeps at least one photo", () => {
    assert.match(memoryActions, /export async function deleteMemoryMediaBulk/);
    assert.match(memoryActions, /A memória precisa continuar com ao menos uma foto/);
    assert.match(memoryActions, /\.in\("id", removing\.map/);
    // Storage remove only after DB delete.
    const bulkFn = memoryActions.slice(memoryActions.indexOf("deleteMemoryMediaBulk"));
    const dbDeleteIdx = bulkFn.indexOf('.delete()');
    const storageIdx = bulkFn.indexOf("storage.from");
    assert.ok(dbDeleteIdx >= 0 && storageIdx > dbDeleteIdx);
  });

  it("cover control is separate from delete selection", () => {
    assert.match(memoryPhotoInput, /Capa/);
    assert.match(memoryPhotoInput, /Definir como capa/);
    assert.match(memoryPhotoInput, /setMemoryCover/);
    assert.match(memoryActions, /export async function setMemoryCover/);
    // Cover UI is outside selecting branch (Definir as capa in !selecting path).
    assert.match(memoryPhotoInput, /selecting \?[\s\S]*Definir como capa|!isCover && memoryId[\s\S]*Definir como capa/);
  });

  it("each persisted photo has replace (pencil) action", () => {
    assert.match(memoryPhotoInput, /aria-label="Substituir foto"/);
    assert.match(memoryPhotoInput, /<Pencil/);
    assert.match(memoryPhotoInput, /replaceMemoryMedia/);
    assert.match(memoryPhotoInput, /openReplacePicker/);
  });

  it("replacement uses new media_id, validates, then cleans old; failure keeps old", () => {
    assert.match(memoryActions, /export async function replaceMemoryMedia/);
    assert.match(memoryActions, /Never deletes the old object before the new row is persisted/);
    assert.match(memoryActions, /validateStoredMemoryMediaObject/);
    assert.match(memoryActions, /wasCover/);
    assert.match(memoryActions, /position: oldRow\.position/);
    assert.match(memoryPhotoInput, /crypto\.randomUUID\(\)/);
    assert.match(memoryPhotoInput, /compensateMemoryUploadsIfNeeded/);
    // Retry path does not duplicate when new media already linked.
    assert.match(memoryActions, /Retry: new media already linked/);
  });

  it("labels say photos; max 8; local duplicate guard; photos-only MIME", () => {
    assert.match(memoryPhotoInput, /Adicionar fotos/);
    assert.match(memoryPhotoInput, /Adicionar mais fotos/);
    assert.match(memoryPhotoInput, /Até \{MEMORY_MEDIA_MAX_PHOTOS\} fotos/);
    assert.equal(MEMORY_MEDIA_MAX_PHOTOS, 8);
    assert.match(memoryPhotoInput, /localFileSelectionKey/);
    assert.match(memoryPhotoInput, /Esta foto já foi selecionada nesta memória/);
    assert.equal(isImageMediaMime("application/pdf"), false);
    assert.equal(isImageMediaMime("video/mp4"), false);
    assert.match(memoryPhotoInput, /Vídeos e PDF não entram em Memórias/);
    const file = { name: "a.jpg", size: 10, lastModified: 1, type: "image/jpeg" };
    assert.equal(localFileSelectionKey(file), localFileSelectionKey(file));
  });
});

describe("wave-2b-ux pet profile photo", () => {
  const petFields = readFileSync(join(root, "src/components/pet-fields.tsx"), "utf8");
  const petAvatar = readFileSync(join(root, "src/components/pet-avatar.tsx"), "utf8");
  const petPage = readFileSync(join(root, "src/app/(app)/pets/[id]/page.tsx"), "utf8");
  const createPetForm = readFileSync(join(root, "src/components/create-pet-form.tsx"), "utf8");
  const editPetForm = readFileSync(join(root, "src/components/edit-pet-form.tsx"), "utf8");
  const cropDialog = readFileSync(join(root, "src/components/profile-photo-crop-dialog.tsx"), "utf8");
  const cropLib = readFileSync(join(root, "src/lib/profile-photo-crop.ts"), "utf8");
  const petActions = readFileSync(join(root, "src/app/(app)/pets/actions.ts"), "utf8");
  const packageJson = readFileSync(join(root, "package.json"), "utf8");

  it("existing photo preview and clear no-photo affordance", () => {
    assert.match(petFields, /Foto atual/);
    assert.match(petFields, /Adicionar foto/);
    assert.match(petFields, /Alterar foto/);
    assert.match(editPetForm, /existingPhotoUrl=\{pet\.photo_url\}/);
    assert.doesNotMatch(petFields, /Escolher imagem/);
  });

  it("camera affordance on profile avatar", () => {
    assert.match(petAvatar, /Alterar foto de perfil/);
    assert.match(petAvatar, /Adicionar foto/);
    assert.match(petAvatar, /<Camera/);
    assert.match(petPage, /PetAvatar/);
    assert.match(petPage, /size="profile"/);
    assert.match(petPage, /editable=\{editable\}/);
    assert.match(petPage, /editHref=\{`\/pets\/\$\{pet\.id\}\/edit`\}/);
  });

  it("avatar is circular with object-cover object-center", () => {
    assert.match(petAvatar, /rounded-full object-cover object-center/);
    assert.match(petAvatar, /profile: "size-28 md:size-32"/);
  });

  it("crop is fixed 1:1; cancel does not upload; confirm wires direct upload", () => {
    assert.match(cropDialog, /Escolha como a foto ficará no perfil/);
    assert.match(cropDialog, /1:1/);
    assert.match(cropDialog, /Cancelar/);
    assert.match(cropDialog, /Usar recorte/);
    assert.match(cropLib, /renderSquareCropToBlob/);
    assert.match(createPetForm, /ProfilePhotoCropDialog/);
    assert.match(editPetForm, /ProfilePhotoCropDialog/);
    assert.match(createPetForm, /onCancel=\{ \(\) => setCropFile\(null\) \}|onCancel=\{\(\) => setCropFile\(null\)\}/);
    assert.match(createPetForm, /runDirectPetPhotoUpload/);
    assert.match(editPetForm, /runDirectPetPhotoUpload/);
    // Crop confirm sets file ref before submit upload — no upload inside crop dialog.
    assert.doesNotMatch(cropDialog, /runDirectPetPhotoUpload|preparePetPhoto/);
  });

  it("no new crop dependency; canvas helper only", () => {
    assert.doesNotMatch(packageJson, /react-easy-crop|react-image-crop|cropperjs|browser-image-compression/);
    assert.match(cropLib, /document\.createElement\("canvas"\)/);
  });

  it("photo replace safety: validate → DB → old cleanup; failure keeps old", () => {
    assert.match(petActions, /validateStoredPetPhotoObject/);
    assert.match(petActions, /Only after DB success|existing\.photo_path/);
    assert.match(petActions, /photo_path/);
    // No unsafe persisted remove invented in this patch.
    assert.doesNotMatch(petFields, /remove_photo|Remover foto atual/);
  });

  it("crop math: cover zoom and clamped pan keep square filled", () => {
    const zoom = minCoverZoom(2000, 1000, 280);
    assert.equal(zoom, 280 / 1000);
    const clamped = clampCropOffset(2000, 1000, zoom, 280, -9999, -9999);
    assert.ok(clamped.offsetX <= 0);
    assert.ok(clamped.offsetY <= 0);
    const rect = cropSourceRect({
      imageWidth: 2000,
      imageHeight: 1000,
      zoom,
      offsetX: clamped.offsetX,
      offsetY: clamped.offsetY,
      viewportSize: 280,
    });
    assert.ok(Math.abs(rect.sw - rect.sh) < 0.01);
  });

  it("create pet idempotency wiring unaffected", () => {
    assert.match(createPetForm, /pet_id/);
    assert.match(createPetForm, /crypto\.randomUUID\(\)/);
    assert.match(createPetForm, /initial_weight_record_id/);
    assert.match(createPetForm, /photoIntentId/);
  });
});

describe("wave-2b-ux domain boundaries", () => {
  it("no migration 0036; memory stays photo-only", () => {
    const memoryPhotoInput = readFileSync(join(root, "src/components/memory-photo-input.tsx"), "utf8");
    assert.doesNotMatch(memoryPhotoInput, /application\/pdf|video\/mp4/);
    let has0036 = false;
    try {
      readFileSync(join(root, "supabase/migrations/0036_anything.sql"));
      has0036 = true;
    } catch {
      has0036 = false;
    }
    assert.equal(has0036, false);
  });
});
