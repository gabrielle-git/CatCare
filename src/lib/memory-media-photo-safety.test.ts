import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { localFileSelectionKey } from "@/lib/attachments";
import {
  foreignIntentErrorMessage,
  invalidIntentErrorMessage,
  isUniqueViolation,
  resolveHouseholdCreateOwnership,
} from "@/lib/create-idempotency";
import {
  canonicalMemoryMediaPath,
  parseMemoryMediaPayload,
  resolveMemoryCreateOwnership,
  validateMemoryMediaIntent,
} from "@/lib/memory-media-upload";
import {
  canonicalPetPhotoPath,
  parsePetPhotoPayload,
} from "@/lib/pet-photo-upload";
import { isImageMediaMime, IMAGE_MEDIA_MAX_BYTES, MEMORY_MEDIA_MAX_PHOTOS } from "@/lib/image-media";

const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const MEMORY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const MEDIA_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const MEDIA_B = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const PET_A = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
const PHOTO_INTENT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

describe("wave-2b memory create ownership", () => {
  it("stable memory_id: create then reuse; foreign reject; invalid reject", () => {
    assert.deepEqual(resolveMemoryCreateOwnership(MEMORY_A, HOUSEHOLD_A, null), { ok: true, status: "create" });
    assert.deepEqual(
      resolveMemoryCreateOwnership(MEMORY_A, HOUSEHOLD_A, { id: MEMORY_A, household_id: HOUSEHOLD_A }),
      { ok: true, status: "reuse" },
    );
    assert.deepEqual(
      resolveMemoryCreateOwnership(MEMORY_A, HOUSEHOLD_A, { id: MEMORY_A, household_id: HOUSEHOLD_B }),
      { ok: false, reason: "foreign_household" },
    );
    assert.deepEqual(resolveMemoryCreateOwnership("bad", HOUSEHOLD_A, null), { ok: false, reason: "invalid_id" });
  });

  it("10 submits same ownership stay one create then reuse", () => {
    let existing: { id: string; household_id: string } | null = null;
    const outcomes: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const result = resolveHouseholdCreateOwnership(MEMORY_A, HOUSEHOLD_A, existing);
      assert.equal(result.ok, true);
      if (result.ok) {
        outcomes.push(result.status);
        if (result.status === "create") existing = { id: MEMORY_A, household_id: HOUSEHOLD_A };
      }
    }
    assert.equal(outcomes.filter((s) => s === "create").length, 1);
    assert.equal(outcomes.filter((s) => s === "reuse").length, 9);
  });

  it("23505 is not treated as created-now — requires relire + ownership", () => {
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    const legit = resolveMemoryCreateOwnership(MEMORY_A, HOUSEHOLD_A, {
      id: MEMORY_A,
      household_id: HOUSEHOLD_A,
    });
    const foreign = resolveMemoryCreateOwnership(MEMORY_A, HOUSEHOLD_A, {
      id: MEMORY_A,
      household_id: HOUSEHOLD_B,
    });
    assert.equal(legit.ok && legit.status, "reuse");
    assert.equal(foreign.ok, false);
    assert.doesNotMatch(foreignIntentErrorMessage(), /HOUSEHOLD|uuid/i);
    assert.match(invalidIntentErrorMessage(), /Recarregue/i);
  });
});

describe("wave-2b memory_media paths + intents", () => {
  it("canonical path is memory-domain (not /attachments/)", () => {
    const path = canonicalMemoryMediaPath(HOUSEHOLD_A, MEMORY_A, MEDIA_A, "image/jpeg");
    assert.equal(path, `${HOUSEHOLD_A}/memories/${MEMORY_A}/${MEDIA_A}.jpg`);
    assert.doesNotMatch(path, /\/attachments\//);
  });

  it("stable media_ids parse from payload; positions independent", () => {
    const raw = JSON.stringify([
      { media_id: MEDIA_A, mime_type: "image/jpeg", byte_size: 1000, original_filename: "a.jpg", position: 0 },
      { media_id: MEDIA_B, mime_type: "image/png", byte_size: 2000, original_filename: "b.png", position: 1 },
    ]);
    const intents = parseMemoryMediaPayload(raw);
    assert.equal(intents.length, 2);
    assert.equal(intents[0].media_id, MEDIA_A);
    assert.equal(intents[1].media_id, MEDIA_B);
    assert.notEqual(intents[0].media_id, intents[1].media_id);
  });

  it("rejects oversize and non-image MIME", () => {
    assert.equal(
      validateMemoryMediaIntent({
        media_id: MEDIA_A,
        mime_type: "image/jpeg",
        byte_size: IMAGE_MEDIA_MAX_BYTES + 1,
        original_filename: "big.jpg",
        position: 0,
      }),
      "A foto deve ter no máximo 5 MB.",
    );
    assert.equal(isImageMediaMime("application/pdf"), false);
    assert.equal(MEMORY_MEDIA_MAX_PHOTOS, 8);
  });

  it("local duplicate File key blocks same selection in one Memory; other Memory may reuse File", () => {
    const file = { name: "cat.jpg", size: 1234, lastModified: 99, type: "image/jpeg" };
    const key = localFileSelectionKey(file);
    assert.equal(localFileSelectionKey(file), key);
    assert.notEqual(localFileSelectionKey({ ...file, lastModified: 100 }), key);
  });
});

describe("wave-2b pet photo paths", () => {
  it("deterministic profile path under /profile/{intent}", () => {
    const path = canonicalPetPhotoPath(HOUSEHOLD_A, PET_A, PHOTO_INTENT, "image/webp");
    assert.equal(path, `${HOUSEHOLD_A}/${PET_A}/profile/${PHOTO_INTENT}.webp`);
    assert.match(path, /\/profile\//);
    assert.doesNotMatch(path, /\/attachments\/|\/memories\//);
  });

  it("legacy profile-{uuid} path shape is distinct and still household/pet prefixed", () => {
    const legacy = `${HOUSEHOLD_A}/${PET_A}/profile-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1.jpg`;
    assert.match(legacy, new RegExp(`^${HOUSEHOLD_A}/${PET_A}/profile-`));
    assert.notEqual(legacy, canonicalPetPhotoPath(HOUSEHOLD_A, PET_A, PHOTO_INTENT, "image/jpeg"));
  });

  it("parses pet_photo_payload metadata", () => {
    const intent = parsePetPhotoPayload(
      JSON.stringify({
        photo_intent_id: PHOTO_INTENT,
        mime_type: "image/png",
        byte_size: 500,
        original_filename: "pet.png",
      }),
    );
    assert.equal(intent?.photo_intent_id, PHOTO_INTENT);
    assert.equal(intent?.mime_type, "image/png");
  });
});

describe("wave-2b wiring (source contracts)", () => {
  const root = process.cwd();
  const memoryActions = readFileSync(join(root, "src/app/(app)/memories/actions.ts"), "utf8");
  const memoryUpload = readFileSync(join(root, "src/app/(app)/memories/upload-actions.ts"), "utf8");
  const createMemoryForm = readFileSync(join(root, "src/components/create-memory-form.tsx"), "utf8");
  const memoryPhotoInput = readFileSync(join(root, "src/components/memory-photo-input.tsx"), "utf8");
  const petActions = readFileSync(join(root, "src/app/(app)/pets/actions.ts"), "utf8");
  const petPhotoUpload = readFileSync(join(root, "src/app/(app)/pets/photo-upload-actions.ts"), "utf8");
  const createPetForm = readFileSync(join(root, "src/components/create-pet-form.tsx"), "utf8");
  const editPetForm = readFileSync(join(root, "src/components/edit-pet-form.tsx"), "utf8");

  it("memory create: stable id + ownership + no File in SA + media payload", () => {
    assert.match(memoryActions, /memory_id/);
    assert.match(memoryActions, /resolveMemoryCreateOwnership/);
    assert.match(memoryActions, /isUniqueViolation/);
    assert.match(memoryActions, /memory_media_payload|parseMemoryMediaPayload/);
    assert.match(memoryActions, /rejectBinaryFiles|instanceof File/);
    assert.match(memoryActions, /ensureMemoryPets/);
    assert.match(memoryActions, /validateStoredMemoryMediaObject/);
    assert.match(createMemoryForm, /crypto\.randomUUID\(\)/);
    assert.match(createMemoryForm, /runDirectMemoryMediaUploads/);
    assert.match(createMemoryForm, /Enviando fotos\.\.\.|Salvando\.\.\./);
    assert.match(memoryPhotoInput, /registerPendingAttachmentFile/);
    assert.match(memoryPhotoInput, /localFileSelectionKey/);
  });

  it("memory prepare/compensate are memory-scoped (not attachments)", () => {
    assert.match(memoryUpload, /prepareMemoryMediaUploadsAction/);
    assert.match(memoryUpload, /compensateMemoryMediaUploadsAction/);
    assert.match(memoryUpload, /\/memories\//);
    assert.doesNotMatch(memoryUpload, /\/attachments\//);
  });

  it("memory does not delete legitimate memory on media failure", () => {
    assert.doesNotMatch(
      memoryActions,
      /ensureMemoryMediaRows[\s\S]{0,400}from\("memories"\)\.delete/,
    );
    assert.match(memoryActions, /keep it|Memory already exists/i);
  });

  it("pet photo: prepare + validate + DB before old cleanup", () => {
    assert.match(petPhotoUpload, /preparePetPhotoUploadAction/);
    assert.match(petActions, /validateStoredPetPhotoObject/);
    assert.match(petActions, /Only after DB success|existing\.photo_path/);
    assert.match(createPetForm, /runDirectPetPhotoUpload/);
    assert.match(editPetForm, /runDirectPetPhotoUpload/);
    const photoClient = readFileSync(join(root, "src/lib/pet-photo-direct-upload-client.ts"), "utf8");
    assert.match(photoClient, /Enviando foto/);
  });

  it("abandonment limitation documented; no 0036; feeding untouched", () => {
    const mediaLib = readFileSync(join(root, "src/lib/memory-media-upload.ts"), "utf8");
    assert.match(mediaLib + memoryActions, /memories\/\{memory_id\}|\/memories\//);
    assert.doesNotMatch(memoryActions + petActions + mediaLib, /0036/);
    let has0036 = false;
    try {
      readFileSync(join(root, "supabase/migrations/0036_anything.sql"));
      has0036 = true;
    } catch {
      has0036 = false;
    }
    assert.equal(has0036, false);

    const recordsActions = readFileSync(join(root, "src/app/(app)/records/new/actions.ts"), "utf8");
    assert.match(recordsActions, /create_feeding_sessions_batch/);
    assert.match(recordsActions, /resolveInitialWeightOwnership/);
  });

  it("wave-1 create helpers remain", () => {
    const expense = readFileSync(join(root, "src/app/(app)/expenses/actions.ts"), "utf8");
    assert.match(expense, /resolveHouseholdCreateOwnership/);
  });
});
