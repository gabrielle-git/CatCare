import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  findActiveHomonymPets,
  isUniqueViolation,
  normalizePetNameForComparison,
  readPetCreateFormDraft,
  resolveInitialWeightOwnership,
  resolvePetCreateOwnership,
} from "@/lib/pet-create";

const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const PET_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PET_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const WEIGHT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("pet create idempotency helpers", () => {
  it("normalizePetNameForComparison trims, lowercases, collapses spaces, strips accents", () => {
    assert.equal(normalizePetNameForComparison("  DóBby  "), "dobby");
    assert.equal(normalizePetNameForComparison("Zabuza"), normalizePetNameForComparison("zabuza"));
    assert.equal(normalizePetNameForComparison("Bebê  1"), "bebe 1");
  });

  it("explicit case/accent/trim/collapse pairs match (create+edit shared helper)", () => {
    const eq = (a: string, b: string) =>
      assert.equal(normalizePetNameForComparison(a), normalizePetNameForComparison(b), `${a} ↔ ${b}`);
    eq("Dobby", "DOBBY");
    eq("Dobby", "dobby");
    eq("Ágata", "agata");
    eq("ÁGATA", "ágata");
    eq("  Dobby  ", "dobby");
    eq("Dobby   Junior", "dobby junior");
  });

  it("create+edit homonym detection uses the same normalize pairs", () => {
    const pets = [
      { id: PET_A, name: "Dobby", archived_at: null },
      { id: PET_B, name: "Ágata", archived_at: null },
      { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Dobby", archived_at: "2026-01-01T00:00:00Z" },
    ];
    // create intent
    assert.equal(findActiveHomonymPets(pets, "DOBBY", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee").length, 1);
    assert.equal(findActiveHomonymPets(pets, "  dobby  ", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")[0]?.id, PET_A);
    assert.equal(findActiveHomonymPets(pets, "agata", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")[0]?.id, PET_B);
    assert.equal(findActiveHomonymPets(pets, "ÁGATA", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee").length, 1);
    // edit: self excluded
    assert.equal(findActiveHomonymPets(pets, "Dobby", PET_A).length, 0);
    assert.equal(findActiveHomonymPets(pets, "DOBBY", PET_A).length, 0);
    assert.equal(findActiveHomonymPets(pets, "Ágata", PET_B).length, 0);
    // archived ignored even with matching normalize
    assert.equal(findActiveHomonymPets(pets, "Dobby", PET_B).length, 1);
    assert.equal(findActiveHomonymPets(pets, "Dobby", PET_B)[0]?.id, PET_A);
  });

  it("ownership: create when absent, reuse same household, reject foreign", () => {
    assert.deepEqual(resolvePetCreateOwnership(PET_A, HOUSEHOLD_A, null), { ok: true, status: "create" });
    assert.deepEqual(
      resolvePetCreateOwnership(PET_A, HOUSEHOLD_A, { id: PET_A, household_id: HOUSEHOLD_A }),
      { ok: true, status: "reuse" },
    );
    assert.deepEqual(
      resolvePetCreateOwnership(PET_A, HOUSEHOLD_A, { id: PET_A, household_id: HOUSEHOLD_B }),
      { ok: false, reason: "foreign_household" },
    );
    assert.deepEqual(resolvePetCreateOwnership("not-a-uuid", HOUSEHOLD_A, null), { ok: false, reason: "invalid_id" });
  });

  it("same pet_id twice resolves to reuse (idempotent intent)", () => {
    const first = resolvePetCreateOwnership(PET_A, HOUSEHOLD_A, null);
    const second = resolvePetCreateOwnership(PET_A, HOUSEHOLD_A, { id: PET_A, household_id: HOUSEHOLD_A });
    assert.equal(first.ok && first.status, "create");
    assert.equal(second.ok && second.status, "reuse");
  });

  it("initial weight ownership is pet+household scoped", () => {
    assert.deepEqual(resolveInitialWeightOwnership(WEIGHT_A, HOUSEHOLD_A, PET_A, null), {
      ok: true,
      status: "create",
    });
    assert.deepEqual(
      resolveInitialWeightOwnership(WEIGHT_A, HOUSEHOLD_A, PET_A, {
        id: WEIGHT_A,
        household_id: HOUSEHOLD_A,
        pet_id: PET_A,
      }),
      { ok: true, status: "reuse" },
    );
    assert.deepEqual(
      resolveInitialWeightOwnership(WEIGHT_A, HOUSEHOLD_A, PET_A, {
        id: WEIGHT_A,
        household_id: HOUSEHOLD_A,
        pet_id: PET_B,
      }),
      { ok: false, reason: "pet_mismatch" },
    );
    assert.deepEqual(
      resolveInitialWeightOwnership(WEIGHT_A, HOUSEHOLD_A, PET_A, {
        id: WEIGHT_A,
        household_id: HOUSEHOLD_B,
        pet_id: PET_A,
      }),
      { ok: false, reason: "foreign_household" },
    );
  });

  it("unique violation detection covers postgres 23505", () => {
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    assert.equal(isUniqueViolation({ message: "duplicate key value violates unique constraint" }), true);
    assert.equal(isUniqueViolation({ code: "42P01" }), false);
  });

  it("active homonyms ignore archived and same intent id", () => {
    const pets = [
      { id: PET_A, name: "Zabuza", archived_at: null },
      { id: PET_B, name: "zabuza", archived_at: null },
      { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Zabuza", archived_at: "2026-01-01T00:00:00Z" },
    ];
    const hits = findActiveHomonymPets(pets, "ZABUZA", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
    assert.equal(hits.length, 2);
    assert.ok(hits.every((pet) => !pet.archived_at));

    const excludingSelf = findActiveHomonymPets(pets, "Zabuza", PET_A);
    assert.equal(excludingSelf.length, 1);
    assert.equal(excludingSelf[0]?.id, PET_B);

    assert.equal(findActiveHomonymPets(pets, "Dobby", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee").length, 0);
  });

  it("edit: own current name is not a homonym; other active pet is; archived is not", () => {
    const pets = [
      { id: PET_A, name: "Dobby", archived_at: null },
      { id: PET_B, name: "Anya", archived_at: null },
      { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Anya", archived_at: "2026-01-01T00:00:00Z" },
    ];
    assert.equal(findActiveHomonymPets(pets, "Dobby", PET_A).length, 0);
    assert.equal(findActiveHomonymPets(pets, "Anya", PET_A).length, 1);
    assert.equal(findActiveHomonymPets(pets, "Anya", PET_A)[0]?.id, PET_B);
    assert.equal(findActiveHomonymPets(pets, "Anya", PET_B).length, 0);
  });

  it("cross-household pets are out of scope for findActiveHomonymPets caller filter", () => {
    // Helper is household-agnostic; actions must query only current household.
    const sameHouseholdOnly = [
      { id: PET_A, name: "Dobby", archived_at: null },
      { id: PET_B, name: "Dobby", archived_at: null },
    ];
    assert.equal(findActiveHomonymPets(sameHouseholdOnly, "Dobby", PET_A).length, 1);
  });

  it("readPetCreateFormDraft preserves name and all create fields including intent ids", () => {
    const formData = new FormData();
    formData.set("name", "  Zabuza  ");
    formData.set("sex", "male");
    formData.set("birth_date", "2024-05-01");
    formData.set("birth_date_estimated", "on");
    formData.set("breed", "SRD");
    formData.set("color", "preto");
    formData.set("initial_weight_kg", "4,2");
    formData.set("neutered", "on");
    formData.set("neutered_at", "2025-01-10");
    formData.set("neutered_place", "Clínica");
    formData.set("has_microchip", "on");
    formData.set("microchip_number", "985");
    formData.set("microchip_implanted_at", "2025-02-01");
    formData.set("microchip_location", "pescoço");
    formData.set("notes", "bravo mas fofo");
    formData.set("pet_id", PET_A);
    formData.set("initial_weight_record_id", WEIGHT_A);

    const draft = readPetCreateFormDraft(formData);
    assert.equal(draft.name, "Zabuza");
    assert.equal(draft.sex, "male");
    assert.equal(draft.birth_date, "2024-05-01");
    assert.equal(draft.birth_date_estimated, true);
    assert.equal(draft.breed, "SRD");
    assert.equal(draft.color, "preto");
    assert.equal(draft.initial_weight_kg, "4,2");
    assert.equal(draft.neutered, true);
    assert.equal(draft.pet_id, PET_A);
    assert.equal(draft.initial_weight_record_id, WEIGHT_A);
  });

  it("readPetCreateFormDraft keeps unchecked estimated/neutered/microchip false", () => {
    const formData = new FormData();
    formData.set("name", "Dobby");
    formData.set("sex", "unknown");
    const draft = readPetCreateFormDraft(formData);
    assert.equal(draft.birth_date_estimated, false);
    assert.equal(draft.neutered, false);
    assert.equal(draft.has_microchip, false);
    assert.equal(draft.sex, "unknown");
  });
});

describe("pet create + edit wiring (source contracts)", () => {
  const root = process.cwd();
  const actions = readFileSync(join(root, "src/app/(app)/pets/actions.ts"), "utf8");
  const createForm = readFileSync(join(root, "src/components/create-pet-form.tsx"), "utf8");
  const editForm = readFileSync(join(root, "src/components/edit-pet-form.tsx"), "utf8");
  const dialog = readFileSync(join(root, "src/components/homonym-name-dialog.tsx"), "utf8");
  const fields = readFileSync(join(root, "src/components/pet-fields.tsx"), "utf8");
  const newPage = readFileSync(join(root, "src/app/(app)/pets/new/page.tsx"), "utf8");
  const editPage = readFileSync(join(root, "src/app/(app)/pets/[id]/edit/page.tsx"), "utf8");

  it("createPet uses explicit pet_id and returns structured results (no blind redirect create)", () => {
    assert.match(actions, /export async function createPet\(formData: FormData\): Promise<CreatePetResult>/);
    assert.match(actions, /id: petId/);
    assert.match(actions, /resolvePetCreateOwnership/);
    assert.match(actions, /duplicateName:\s*true/);
    assert.match(actions, /allow_duplicate_name/);
    assert.match(actions, /ensureInitialWeight|initial_weight_record_id/);
    assert.match(actions, /isUniqueViolation/);
  });

  it("create form uses imperative Server Action (preventDefault) so File is not reset", () => {
    assert.match(createForm, /event\.preventDefault\(\)/);
    assert.match(createForm, /new FormData\(form\)/);
    assert.match(createForm, /photoFileRef/);
    assert.match(createForm, /attachPreservedPhoto|formData\.set\("photo"/);
    assert.doesNotMatch(createForm, /key=\{fieldsKey\}|restoreDraft/);
    assert.match(createForm, /onSubmit=/);
  });

  it("homonym warning is a fixed accessible dialog (not top-of-form banner)", () => {
    assert.match(dialog, /role="dialog"/);
    assert.match(dialog, /aria-modal="true"/);
    assert.match(dialog, /aria-labelledby/);
    assert.match(dialog, /aria-describedby/);
    assert.match(dialog, /fixed inset-0/);
    assert.match(dialog, /Escape/);
    assert.match(createForm, /HomonymNameDialog/);
    assert.doesNotMatch(createForm, /role="status"/);
  });

  it("create cancel clears only name, keeps intents, does not create", () => {
    assert.match(createForm, /closeDuplicateClearName|nameInputRef\.current\.value = ""/);
    assert.match(createForm, /nameInputRef\.current\.focus\(\)/);
    assert.match(createForm, /const \[petId\] = useState\(\(\) => crypto\.randomUUID\(\)\)/);
    assert.match(createForm, /const \[weightRecordId\] = useState\(\(\) => crypto\.randomUUID\(\)\)/);
    assert.equal((createForm.match(/crypto\.randomUUID\(\)/g) ?? []).length, 2);
    assert.doesNotMatch(createForm, /setPetId|setWeightRecordId/);
  });

  it("create confirm keeps File + same intents and uses allow_duplicate_name", () => {
    assert.match(createForm, /Criar mesmo assim/);
    assert.match(createForm, /runCreate\(form, true\)/);
    assert.match(createForm, /allow_duplicate_name/);
    assert.match(createForm, /formData\.set\("pet_id", petId\)/);
    assert.match(createForm, /formData\.set\("initial_weight_record_id", weightRecordId\)/);
    assert.match(createForm, /photoFileRef/);
    assert.match(newPage, /CreatePetForm/);
  });

  it("form keeps stable pet_id and weight intent across retries with pending UX", () => {
    assert.match(createForm, /SubmitButton|Salvando\.\.\./);
    assert.match(createForm, /useTransition/);
    assert.match(createForm, /pending/);
  });

  it("updatePet returns UpdatePetResult and revalidates active homonyms excluding self", () => {
    assert.match(actions, /export async function updatePet\(petId: string, formData: FormData\): Promise<UpdatePetResult>/);
    assert.match(actions, /findActiveHomonymPets\(activePets \?\? \[\], fields\.name, petId\)/);
    assert.match(actions, /allow_duplicate_name/);
    assert.match(actions, /duplicateName:\s*true/);
    // Must not blind-redirect on soft duplicate / validation (structured result).
    assert.doesNotMatch(actions, /updatePet[\s\S]{0,800}redirect\(`\/pets\/\$\{petId\}\/edit/);
  });

  it("edit form dialog: restore original name on cancel; Salvar mesmo assim on confirm", () => {
    assert.match(editForm, /HomonymNameDialog/);
    assert.match(editForm, /event\.preventDefault\(\)/);
    assert.match(editForm, /originalName/);
    assert.match(editForm, /nameInputRef\.current\.value = originalName/);
    assert.match(editForm, /Salvar mesmo assim/);
    assert.match(editForm, /runUpdate\(form, true\)/);
    assert.match(editForm, /photoFileRef/);
    assert.match(editPage, /EditPetForm/);
    assert.match(editPage, /updatePet\.bind/);
  });

  it("edit and create share the same findActiveHomonymPets / normalize helpers", () => {
    assert.match(actions, /findActiveHomonymPets/);
    assert.equal((actions.match(/findActiveHomonymPets/g) ?? []).length >= 2, true);
    assert.doesNotMatch(actions, /toLocaleLowerCase\("pt-BR"\)/);
  });

  it("Data estimada sits under Nascimento with accessible checkbox label", () => {
    assert.match(fields, /Data estimada/);
    assert.doesNotMatch(fields, /A data de nascimento é estimada/);
    assert.match(fields, /name="birth_date_estimated"/);
    assert.match(fields, /Nascimento[\s\S]*birth_date[\s\S]*birth_date_estimated[\s\S]*Data estimada/);
    assert.doesNotMatch(fields, /birth_date_estimated[\s\S]{0,200}bg-\[var\(--cream\)\]/);
  });

  it("pet photo picker: empty / selected / replace / remove without submitting form", () => {
    assert.match(fields, /Escolher imagem/);
    assert.match(fields, /Trocar imagem/);
    assert.match(fields, /Remover imagem/);
    assert.match(fields, /JPG, PNG ou WebP, até 5 MB/);
    assert.match(fields, /type="file"/);
    assert.match(fields, /className="sr-only"/);
    assert.match(fields, /name="photo"/);
    assert.match(fields, /clearLocalSelection/);
    assert.match(fields, /inputRef\.current\.value = ""/);
    assert.match(fields, /onPhotoFileChange/);
    assert.match(fields, /onClick=\{openPicker\}/);
    assert.match(fields, /onClick=\{clearLocalSelection\}/);
    // Three type=button controls (choose / replace / remove) — never submit.
    assert.equal((fields.match(/type="button"/g) ?? []).length, 3);
    assert.doesNotMatch(fields, /createSignedUploadUrl|uploadToSignedUrl|base64/);
    // Local selection only — no persisted-photo delete control in this polish.
    assert.doesNotMatch(fields, /remove_photo|Remover foto atual/);
  });

  it("homonym warning + photo preservation wiring stays on create/edit forms", () => {
    assert.match(createForm, /photoFileRef/);
    assert.match(createForm, /closeDuplicateClearName/);
    assert.match(createForm, /nameInputRef\.current\.value = ""/);
    assert.match(editForm, /photoFileRef/);
    assert.match(createForm, /attachPreservedPhoto|formData\.set\("photo"/);
    assert.match(editForm, /attachPreservedPhoto|formData\.set\("photo"/);
  });

  it("does not introduce migration 0036 or delete Zabuza", () => {
    assert.doesNotMatch(actions, /0036|DELETE FROM pets|delete\(\)\.eq\(\"id\".*zabuza/i);
    assert.match(dialog, /Já existe um pet com esse nome/);
  });

  it("photo remains Server Action File transport (not direct upload in this PR)", () => {
    assert.match(actions, /instanceof File/);
    assert.match(actions, /uploadPhoto/);
    assert.doesNotMatch(actions, /createSignedUploadUrl|uploadToSignedUrl/);
    assert.doesNotMatch(createForm, /createSignedUploadUrl|uploadToSignedUrl/);
    assert.doesNotMatch(editForm, /createSignedUploadUrl|uploadToSignedUrl/);
  });

  it("expected errors stay as structured results (no RSC crash redirect-only path on update)", () => {
    assert.match(actions, /return \{ ok: false, error:/);
    assert.match(createForm, /setError/);
    assert.match(editForm, /setError/);
  });
});
