import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  findActiveHomonymPets,
  isUniqueViolation,
  normalizePetNameForComparison,
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
});

describe("pet create wiring (source contracts)", () => {
  const root = process.cwd();
  const actions = readFileSync(join(root, "src/app/(app)/pets/actions.ts"), "utf8");
  const form = readFileSync(join(root, "src/components/create-pet-form.tsx"), "utf8");
  const page = readFileSync(join(root, "src/app/(app)/pets/new/page.tsx"), "utf8");

  it("createPet uses explicit pet_id and returns structured results (no blind redirect create)", () => {
    assert.match(actions, /export async function createPet\(formData: FormData\): Promise<CreatePetResult>/);
    assert.match(actions, /id: petId/);
    assert.match(actions, /resolvePetCreateOwnership/);
    assert.match(actions, /duplicateName:\s*true/);
    assert.match(actions, /allow_duplicate_name/);
    assert.match(actions, /ensureInitialWeight|initial_weight_record_id/);
    assert.match(actions, /isUniqueViolation/);
  });

  it("form keeps stable pet_id and weight intent across retries with pending UX", () => {
    assert.match(form, /crypto\.randomUUID\(\)/);
    assert.match(form, /pet_id/);
    assert.match(form, /initial_weight_record_id/);
    assert.match(form, /SubmitButton/);
    assert.match(form, /Salvando\.\.\./);
    assert.match(form, /allowDuplicateRef/);
    assert.match(form, /Criar mesmo assim/);
    assert.match(page, /CreatePetForm/);
  });

  it("does not introduce migration 0036 or delete Zabuza", () => {
    assert.doesNotMatch(actions, /0036|DELETE FROM pets|delete\(\)\.eq\(\"id\".*zabuza/i);
    assert.match(form, /Já existe um pet com esse nome/);
  });

  it("photo remains Server Action File transport (not direct upload in this PR)", () => {
    assert.match(actions, /instanceof File/);
    assert.match(actions, /uploadPhoto/);
    assert.doesNotMatch(actions, /createSignedUploadUrl|uploadToSignedUrl/);
  });
});
