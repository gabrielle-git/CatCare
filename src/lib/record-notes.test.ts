import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { notesFieldNameForPet, notesTargetPetFieldName } from "@/lib/neonatal-feeding";
import {
  notesFieldNameForPetType,
  notesFieldNameForType,
  recordFormSubmitMode,
  resolveRecordNoteFromForm,
} from "@/lib/record-notes";

const DOBBY = "00000000-0000-4000-8000-000000000001";
const CRYSTAL = "00000000-0000-4000-8000-000000000002";

function noteOf(form: FormData, petId: string, careType: string) {
  return resolveRecordNoteFromForm(form, petId, careType);
}

test("A. 1 pet × 1 care uses the single note", () => {
  const form = new FormData();
  form.set("notes", "retorno tranquilo");
  assert.equal(noteOf(form, DOBBY, "consultation"), "retorno tranquilo");
});

test("B. 2 pets × 1 care can share one note", () => {
  const form = new FormData();
  form.set("notes", "mesma consulta");
  assert.equal(noteOf(form, DOBBY, "consultation"), "mesma consulta");
  assert.equal(noteOf(form, CRYSTAL, "consultation"), "mesma consulta");
});

test("C. 2 pets × 1 care can keep different notes", () => {
  const form = new FormData();
  form.set("include_per_pet_notes", "1");
  form.append(notesTargetPetFieldName(), DOBBY);
  form.append(notesTargetPetFieldName(), CRYSTAL);
  form.set(notesFieldNameForPet(DOBBY), "Dobby sem vômito");
  form.set(notesFieldNameForPet(CRYSTAL), "Crystal apetite normal");
  assert.equal(noteOf(form, DOBBY, "consultation"), "Dobby sem vômito");
  assert.equal(noteOf(form, CRYSTAL, "consultation"), "Crystal apetite normal");
});

test("D. 1 pet × 2 cares can keep different notes", () => {
  const form = new FormData();
  form.set(notesFieldNameForType("consultation"), "nota da consulta");
  form.set(notesFieldNameForType("vaccine"), "nota da vacina");
  assert.equal(noteOf(form, DOBBY, "consultation"), "nota da consulta");
  assert.equal(noteOf(form, DOBBY, "vaccine"), "nota da vacina");
});

test("E. 2 pets × 2 cares keep four distinct notes", () => {
  const form = new FormData();
  form.set(notesFieldNameForPetType("consultation", DOBBY), "consulta dobby");
  form.set(notesFieldNameForPetType("consultation", CRYSTAL), "consulta crystal");
  form.set(notesFieldNameForPetType("vaccine", DOBBY), "vacina dobby");
  form.set(notesFieldNameForPetType("vaccine", CRYSTAL), "vacina crystal");
  assert.equal(noteOf(form, DOBBY, "consultation"), "consulta dobby");
  assert.equal(noteOf(form, CRYSTAL, "consultation"), "consulta crystal");
  assert.equal(noteOf(form, DOBBY, "vaccine"), "vacina dobby");
  assert.equal(noteOf(form, CRYSTAL, "vaccine"), "vacina crystal");
});

test("F. one launch note can fill every care when type fields are absent", () => {
  const form = new FormData();
  form.set("notes", "vale para todos");
  assert.equal(noteOf(form, DOBBY, "consultation"), "vale para todos");
  assert.equal(noteOf(form, CRYSTAL, "vaccine"), "vale para todos");
});

test("F. a type note still wins over the launch note", () => {
  const form = new FormData();
  form.set("notes", "vale para todos");
  form.set(notesFieldNameForType("vaccine"), "só a vacina");
  assert.equal(noteOf(form, DOBBY, "consultation"), "vale para todos");
  assert.equal(noteOf(form, DOBBY, "vaccine"), "só a vacina");
});

test("G. missing notes stay empty", () => {
  const form = new FormData();
  assert.equal(noteOf(form, DOBBY, "consultation"), null);
  form.set("notes", "   ");
  form.set(notesFieldNameForPetType("consultation", DOBBY), "  ");
  assert.equal(noteOf(form, DOBBY, "consultation"), null);
});

test("precedence: pet × type, then type, then legacy pet, then launch", () => {
  const form = new FormData();
  form.set("notes", "global");
  form.set("include_per_pet_notes", "1");
  form.append(notesTargetPetFieldName(), DOBBY);
  form.set(notesFieldNameForPet(DOBBY), "legacy pet");
  form.set(notesFieldNameForType("consultation"), "type shared");
  form.set(notesFieldNameForPetType("consultation", DOBBY), "specific");
  assert.equal(noteOf(form, DOBBY, "consultation"), "specific");

  form.set(notesFieldNameForPetType("consultation", DOBBY), " ");
  assert.equal(noteOf(form, DOBBY, "consultation"), "type shared");

  form.set(notesFieldNameForType("consultation"), "");
  assert.equal(noteOf(form, DOBBY, "consultation"), "legacy pet");

  form.set(notesFieldNameForPet(DOBBY), "");
  assert.equal(noteOf(form, DOBBY, "consultation"), "global");
});

test("I. old per-pet payload still applies that pet note to every care", () => {
  const form = new FormData();
  form.set("notes", "compartilhada");
  form.set("include_per_pet_notes", "1");
  form.append(notesTargetPetFieldName(), DOBBY);
  form.set(notesFieldNameForPet(DOBBY), "só dobby");
  assert.equal(noteOf(form, DOBBY, "consultation"), "só dobby");
  assert.equal(noteOf(form, DOBBY, "vaccine"), "só dobby");
  assert.equal(noteOf(form, CRYSTAL, "consultation"), "compartilhada");
});

test("H. editing one record's note does not describe another record", () => {
  const consultation = new FormData();
  consultation.set("notes", "nota da consulta do Dobby");
  const vaccine = new FormData();
  vaccine.set("notes", "nota da vacina da Crystal");
  assert.equal(noteOf(consultation, DOBBY, "consultation"), "nota da consulta do Dobby");
  assert.equal(noteOf(vaccine, CRYSTAL, "vaccine"), "nota da vacina da Crystal");
  assert.notEqual(noteOf(consultation, DOBBY, "consultation"), noteOf(vaccine, CRYSTAL, "vaccine"));

  const source = readFileSync(join(process.cwd(), "src/app/(app)/records/actions.ts"), "utf8");
  assert.match(source, /const notes = value\(formData, "notes"\)/);
  assert.match(source, /\.eq\("id", recordId\)\.eq\("household_id", household\.id\)/);
  assert.equal(source.includes("notesFieldNameForPetType"), false);
});

test("J. preview does not persist", () => {
  assert.equal(recordFormSubmitMode(true), "preview");
  assert.equal(recordFormSubmitMode(false), "persist");
});
