import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  canRemoveHealthRecordAttachment,
  canRemoveStoredAttachment,
  contentDispositionAttachment,
  resolveDocumentCreateOwnership,
  ATTACHMENT_MAX_PER_DOCUMENT,
} from "@/lib/attachments";
import { EXPORT_HOUSEHOLD_TABLES } from "@/lib/export-tables";
import {
  attachmentHeadingForCareType,
  attachmentHeadingForPetCareType,
  healthAttachmentFieldNames,
  healthAttachmentRecordKey,
  readAttachmentFiles,
  readAttachmentIds,
  readDisplayNamesForCareType,
  readStableRecordIdForPetType,
} from "@/lib/health-record-attachment-form";
import { healthRecordAttachmentRemoveFormId } from "@/lib/health-record-attachment-form-ids";
import {
  mapFormTypeToHealthRecordType,
  resolveHealthRecordCreateOwnership,
} from "@/lib/health-record-type";

const HOUSEHOLD_A = "11111111-1111-4111-8111-111111111111";
const HOUSEHOLD_B = "22222222-2222-4222-8222-222222222222";
const PET_A = "33333333-3333-4333-8333-333333333333";
const PET_B = "44444444-4444-4444-8444-444444444444";
const RECORD_ID = "55555555-5555-4555-8555-555555555555";
const ATTACHMENT_ID = "66666666-6666-4666-8666-666666666666";

describe("health_record type mapper", () => {
  it("maps exam create/edit to exam (never silent other)", () => {
    assert.equal(mapFormTypeToHealthRecordType("exam"), "exam");
  });

  it("preserves valid schema types including disease/allergy/surgery", () => {
    assert.equal(mapFormTypeToHealthRecordType("disease"), "disease");
    assert.equal(mapFormTypeToHealthRecordType("allergy"), "allergy");
    assert.equal(mapFormTypeToHealthRecordType("surgery"), "surgery");
    assert.equal(mapFormTypeToHealthRecordType("consultation"), "consultation");
    assert.equal(mapFormTypeToHealthRecordType("vaccine"), "vaccine");
  });

  it("maps UI observation to other without collapsing other valid types", () => {
    assert.equal(mapFormTypeToHealthRecordType("observation"), "other");
    assert.equal(mapFormTypeToHealthRecordType("other"), "other");
  });
});

describe("health_record create idempotency ownership", () => {
  it("treats same household/pet retry as reuse", () => {
    const result = resolveHealthRecordCreateOwnership(RECORD_ID, HOUSEHOLD_A, PET_A, {
      id: RECORD_ID,
      household_id: HOUSEHOLD_A,
      pet_id: PET_A,
    });
    assert.deepEqual(result, { ok: true, status: "reuse" });
  });

  it("rejects cross-household reuse", () => {
    const result = resolveHealthRecordCreateOwnership(RECORD_ID, HOUSEHOLD_A, PET_A, {
      id: RECORD_ID,
      household_id: HOUSEHOLD_B,
      pet_id: PET_A,
    });
    assert.deepEqual(result, { ok: false, reason: "foreign_household" });
  });

  it("rejects pet mismatch", () => {
    const result = resolveHealthRecordCreateOwnership(RECORD_ID, HOUSEHOLD_A, PET_A, {
      id: RECORD_ID,
      household_id: HOUSEHOLD_A,
      pet_id: PET_B,
    });
    assert.deepEqual(result, { ok: false, reason: "pet_mismatch" });
  });

  it("allows first create when absent", () => {
    assert.deepEqual(
      resolveHealthRecordCreateOwnership(RECORD_ID, HOUSEHOLD_A, PET_A, null),
      { ok: true, status: "create" },
    );
  });
});

describe("health_record edit RSC regression (#441)", () => {
  const editPage = readFileSync(join(process.cwd(), "src/app/(app)/records/[id]/edit/page.tsx"), "utf8");
  const recordFields = readFileSync(join(process.cwd(), "src/components/record-fields.tsx"), "utf8");
  const attachmentFields = readFileSync(join(process.cwd(), "src/components/health-record-attachments-fields.tsx"), "utf8");

  it("does not pass a function prop from the Server edit page into RecordFields", () => {
    // Root cause of React #441 on consultation/vaccine edit: inline arrow was not RSC-serializable.
    assert.doesNotMatch(editPage, /removeAttachmentFormIdFor\s*=\s*\{/);
    assert.doesNotMatch(editPage, /removeAttachmentFormIdFor=\{\(attachmentId\)/);
    assert.doesNotMatch(recordFields, /removeAttachmentFormIdFor/);
  });

  it("keeps remove form ids via shared import (server + client), not via props", () => {
    assert.match(editPage, /healthRecordAttachmentRemoveFormId/);
    assert.match(attachmentFields, /healthRecordAttachmentRemoveFormId/);
    assert.equal(
      healthRecordAttachmentRemoveFormId(ATTACHMENT_ID),
      `remove-health-attachment-${ATTACHMENT_ID}`,
    );
  });

  it("edit path accepts zero attachments as [] (consultation/vaccine/exam)", () => {
    assert.equal(canRemoveHealthRecordAttachment(0), true);
    const empty: unknown[] = [];
    assert.equal(empty.length, 0);
    assert.match(editPage, /existingAttachments/);
    assert.match(editPage, /listHealthRecordAttachments/);
  });

  it("serializable attachment-shaped payloads survive JSON (legacy/null-safe)", () => {
    const withFiles = [
      {
        id: ATTACHMENT_ID,
        household_id: HOUSEHOLD_A,
        storage_path: `${HOUSEHOLD_A}/attachments/${ATTACHMENT_ID}/file.pdf`,
        original_filename: "IMG_20260910_192833.pdf",
        display_name: "Resultado do hemograma",
        mime_type: "application/pdf",
        byte_size: 1024,
        created_by: null,
        created_at: "2026-09-10T00:00:00.000Z",
        url: null,
        position: 0,
      },
    ];
    const withoutFiles: typeof withFiles = [];
    assert.equal(JSON.parse(JSON.stringify(withoutFiles)).length, 0);
    assert.equal(JSON.parse(JSON.stringify(withFiles))[0].display_name, "Resultado do hemograma");
    assert.equal(JSON.parse(JSON.stringify(withFiles))[0].original_filename, "IMG_20260910_192833.pdf");
  });

  it("exam remains a first-class edit type in RecordFields options", () => {
    assert.match(recordFields, /value: "exam"/);
    assert.match(recordFields, /label: "Exame"/);
  });

  it("edit remove uses ConfirmButton before mutation (not silent submit)", () => {
    assert.match(attachmentFields, /ConfirmButton/);
    assert.match(attachmentFields, /Remover este arquivo\?/);
    assert.match(attachmentFields, /não poderá ser recuperado por aqui/);
    assert.match(attachmentFields, /confirmLabel="Remover arquivo"/);
  });
});

describe("health_record multi-type attachments", () => {
  const recordFields = readFileSync(join(process.cwd(), "src/components/record-fields.tsx"), "utf8");
  const createActions = readFileSync(join(process.cwd(), "src/app/(app)/records/new/actions.ts"), "utf8");
  const examId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const vaccineId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const examAtt1 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const examAtt2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const vaccineAtt = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

  it("single and multi health types keep attachment UI (no !multiType gate)", () => {
    assert.doesNotMatch(recordFields, /attachmentsEnabled\s*=\s*\n?\s*!multiType/);
    assert.match(recordFields, /createAttachmentsAllowed/);
    assert.match(recordFields, /showCreateAttachmentsForType/);
    assert.match(recordFields, /careType=\{type\}/);
  });

  it("multi-pet create keeps attachment pickers (no single-pet-only gate)", () => {
    assert.match(recordFields, /visibleSelectedIds\.length >= 1/);
    assert.match(recordFields, /multiPetAttachments/);
    assert.match(recordFields, /Arquivos por pet/);
    assert.match(recordFields, /petId=\{petId\}/);
    assert.doesNotMatch(createActions, /Anexos clínicos ficam disponíveis ao registrar para um pet por vez/);
    assert.doesNotMatch(createActions, /wantsAttachments && pets\.length !== 1/);
    assert.doesNotMatch(createActions, /wantsAttachments && pets\.length === 1 && isAttachableQuickRecordType/);
  });

  it("scopes FormData fields per care type so exam files stay on exam", () => {
    assert.deepEqual(healthAttachmentFieldNames("exam"), {
      files: "files__exam",
      attachmentIds: "attachment_ids__exam",
      displayNames: "display_names__exam",
    });
    assert.deepEqual(healthAttachmentFieldNames("vaccine"), {
      files: "files__vaccine",
      attachmentIds: "attachment_ids__vaccine",
      displayNames: "display_names__vaccine",
    });
    assert.equal(attachmentHeadingForCareType("exam"), "Arquivos do exame");
    assert.equal(attachmentHeadingForCareType("vaccine"), "Arquivos da vacina");
  });

  it("scopes FormData fields per pet + care type for multi-pet create", () => {
    assert.deepEqual(healthAttachmentFieldNames("exam", PET_A), {
      files: `files__${PET_A}__exam`,
      attachmentIds: `attachment_ids__${PET_A}__exam`,
      displayNames: `display_names__${PET_A}__exam`,
    });
    assert.deepEqual(healthAttachmentFieldNames("vaccine", PET_B), {
      files: `files__${PET_B}__vaccine`,
      attachmentIds: `attachment_ids__${PET_B}__vaccine`,
      displayNames: `display_names__${PET_B}__vaccine`,
    });
    assert.equal(healthAttachmentRecordKey(PET_A, "exam"), `${PET_A}:exam`);
    assert.equal(attachmentHeadingForPetCareType("Dobby", "exam"), "Arquivos do Dobby — exame");
    assert.equal(attachmentHeadingForPetCareType("Anya", "vaccine"), "Arquivos da Anya — vacina");
  });

  it("reads nested record_ids_json per pet+type (idempotent multi-type)", () => {
    const form = new FormData();
    form.set(
      "record_ids_json",
      JSON.stringify({
        [PET_A]: { exam: examId, vaccine: vaccineId },
      }),
    );
    assert.equal(readStableRecordIdForPetType(form, PET_A, "exam", [PET_A]), examId);
    assert.equal(readStableRecordIdForPetType(form, PET_A, "vaccine", [PET_A]), vaccineId);
    assert.notEqual(
      readStableRecordIdForPetType(form, PET_A, "exam", [PET_A]),
      readStableRecordIdForPetType(form, PET_A, "vaccine", [PET_A]),
    );
  });

  it("2 pets × 2 types keep four independent attachment buckets", () => {
    const form = new FormData();
    const dobbyExam = new File(["a"], "dobby-exam.pdf", { type: "application/pdf" });
    const dobbyVac = new File(["b"], "dobby-vac.jpg", { type: "image/jpeg" });
    const anyaExam = new File(["c"], "anya-exam.pdf", { type: "application/pdf" });
    const anyaVac = new File(["d"], "anya-vac.jpg", { type: "image/jpeg" });
    const ids = {
      de: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      dv: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      ae: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
      av: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
    };

    form.append(`files__${PET_A}__exam`, dobbyExam);
    form.append(`attachment_ids__${PET_A}__exam`, ids.de);
    form.append(`display_names__${PET_A}__exam`, "Exame Dobby");
    form.append(`files__${PET_A}__vaccine`, dobbyVac);
    form.append(`attachment_ids__${PET_A}__vaccine`, ids.dv);
    form.append(`display_names__${PET_A}__vaccine`, "Vacina Dobby");
    form.append(`files__${PET_B}__exam`, anyaExam);
    form.append(`attachment_ids__${PET_B}__exam`, ids.ae);
    form.append(`display_names__${PET_B}__exam`, "Exame Anya");
    form.append(`files__${PET_B}__vaccine`, anyaVac);
    form.append(`attachment_ids__${PET_B}__vaccine`, ids.av);
    form.append(`display_names__${PET_B}__vaccine`, "Vacina Anya");

    const opts = { allowLegacyFallback: false };
    assert.equal(readAttachmentFiles(form, "exam", PET_A, opts)[0]?.name, "dobby-exam.pdf");
    assert.equal(readAttachmentFiles(form, "exam", PET_B, opts)[0]?.name, "anya-exam.pdf");
    assert.equal(readAttachmentFiles(form, "vaccine", PET_A, opts)[0]?.name, "dobby-vac.jpg");
    assert.equal(readAttachmentFiles(form, "vaccine", PET_B, opts)[0]?.name, "anya-vac.jpg");
    assert.equal(readAttachmentFiles(form, "exam", PET_A, opts).length, 1);
    assert.deepEqual(readAttachmentIds(form, 1, "exam", PET_A, opts), [ids.de]);
    assert.deepEqual(readAttachmentIds(form, 1, "exam", PET_B, opts), [ids.ae]);
    assert.notEqual(
      readAttachmentIds(form, 1, "exam", PET_A, opts)[0],
      readAttachmentIds(form, 1, "exam", PET_B, opts)[0],
    );
    assert.notEqual(
      readAttachmentIds(form, 1, "vaccine", PET_A, opts)[0],
      readAttachmentIds(form, 1, "exam", PET_A, opts)[0],
    );
  });

  it("does not leak type-only files into multi-pet buckets", () => {
    const form = new FormData();
    form.append("files__exam", new File(["x"], "shared.pdf", { type: "application/pdf" }));
    form.append("attachment_ids__exam", examAtt1);
    form.append("display_names__exam", "Shared");
    assert.equal(readAttachmentFiles(form, "exam", PET_A, { allowLegacyFallback: false }).length, 0);
    assert.equal(readAttachmentFiles(form, "exam", PET_A, { allowLegacyFallback: true }).length, 1);
  });

  it("enforces max 8 attachments per health_record via shared slots helper", () => {
    assert.equal(ATTACHMENT_MAX_PER_DOCUMENT, 8);
  });

  it("distributes exam 2 + vaccine 1 files to the correct scoped fields", () => {
    const form = new FormData();
    const examFile1 = new File(["hemograma"], "hemograma.pdf", { type: "application/pdf" });
    const examFile2 = new File(["coleta"], "coleta.jpg", { type: "image/jpeg" });
    const vaccineFile = new File(["carteira"], "carteira.jpg", { type: "image/jpeg" });

    form.append("files__exam", examFile1);
    form.append("files__exam", examFile2);
    form.append("attachment_ids__exam", examAtt1);
    form.append("attachment_ids__exam", examAtt2);
    form.append("display_names__exam", "Resultado do hemograma");
    form.append("display_names__exam", "Foto da coleta");

    form.append("files__vaccine", vaccineFile);
    form.append("attachment_ids__vaccine", vaccineAtt);
    form.append("display_names__vaccine", "Carteira de vacinação");

    const examFiles = readAttachmentFiles(form, "exam");
    const vaccineFiles = readAttachmentFiles(form, "vaccine");
    assert.equal(examFiles.length, 2);
    assert.equal(vaccineFiles.length, 1);
    assert.deepEqual(readAttachmentIds(form, 2, "exam"), [examAtt1, examAtt2]);
    assert.deepEqual(readAttachmentIds(form, 1, "vaccine"), [vaccineAtt]);
    assert.deepEqual(readDisplayNamesForCareType(form, 2, "exam"), ["Resultado do hemograma", "Foto da coleta"]);
    assert.deepEqual(readDisplayNamesForCareType(form, 1, "vaccine"), ["Carteira de vacinação"]);
  });

  it("create action wires per-type record ids and scoped attachment attach with pet id", () => {
    assert.match(createActions, /readStableRecordIdForPetType/);
    assert.match(createActions, /ensureHealthRecordAttachments\(/);
    assert.match(createActions, /pet\.id/);
    assert.match(createActions, /pets\.length/);
    assert.match(createActions, /isAttachableQuickRecordType\(type\)/);
    assert.match(createActions, /readAttachmentsPayload|finalizeDirectUploadedAttachments/);
    assert.doesNotMatch(createActions, /uploadPreparedAttachments/);
    assert.doesNotMatch(createActions, /wantsAttachments = !multi &&/);
  });

  it("new record page uses DirectUploadForm (no File in Server Action body)", () => {
    const newPage = readFileSync(join(process.cwd(), "src/app/(app)/records/new/page.tsx"), "utf8");
    assert.match(newPage, /DirectUploadForm/);
    assert.match(createActions, /instanceof File/);
  });

  it("edit page does not pass removeAttachmentFormIdFor as a Client prop (#441 regression)", () => {
    const editPage = readFileSync(join(process.cwd(), "src/app/(app)/records/[id]/edit/page.tsx"), "utf8");
    const attachmentsFields = readFileSync(join(process.cwd(), "src/components/health-record-attachments-fields.tsx"), "utf8");
    assert.doesNotMatch(editPage, /removeAttachmentFormIdFor=\{/);
    assert.doesNotMatch(editPage, /removeFormIdFor=\{/);
    assert.match(editPage, /healthRecordAttachmentRemoveFormId/);
    assert.match(attachmentsFields, /ConfirmButton/);
  });

  it("historico accepts saved banner after multi-pet create redirect", () => {
    const historico = readFileSync(join(process.cwd(), "src/app/(app)/historico/page.tsx"), "utf8");
    assert.match(historico, /saved\?:/);
    assert.match(historico, /flags\.saved/);
  });

  it("Documents already confirm attachment removal (report-only; untouched)", () => {
    const docs = readFileSync(join(process.cwd(), "src/components/document-fields.tsx"), "utf8");
    assert.match(docs, /ConfirmButton/);
    assert.match(docs, /Remover arquivo\?/);
  });
});

describe("health_record attachments contracts", () => {
  it("allows zero attachments and removing the last clinical file", () => {
    assert.equal(canRemoveHealthRecordAttachment(1), true);
    assert.equal(canRemoveHealthRecordAttachment(0), true);
    assert.equal(canRemoveStoredAttachment(1), false);
  });

  it("export includes health_record_attachments without implying Storage binaries", () => {
    assert.ok(EXPORT_HOUSEHOLD_TABLES.includes("health_record_attachments"));
    assert.ok(EXPORT_HOUSEHOLD_TABLES.includes("attachments"));
    assert.ok(!EXPORT_HOUSEHOLD_TABLES.includes("storage.objects" as never));
  });

  it("download disposition still prefers original_filename", () => {
    const header = contentDispositionAttachment("IMG_20260910_192833.pdf");
    assert.match(header, /IMG_20260910_192833\.pdf/);
    assert.doesNotMatch(header, /Resultado do hemograma/);
  });

  it("migration 0035 is the only new clinical attachments migration", () => {
    assert.equal(existsSync(join(process.cwd(), "supabase/migrations/0035_health_record_attachments.sql")), true);
    assert.equal(existsSync(join(process.cwd(), "supabase/migrations/0036_health_record_attachments.sql")), false);
  });

  it("create/update actions wire exam mapper and attachment RPCs", () => {
    const createSql = readFileSync(join(process.cwd(), "src/app/(app)/records/new/actions.ts"), "utf8");
    const updateSql = readFileSync(join(process.cwd(), "src/app/(app)/records/actions.ts"), "utf8");
    assert.match(createSql, /mapFormTypeToHealthRecordType/);
    assert.match(createSql, /resolveHealthRecordCreateOwnership/);
    assert.match(createSql, /add_health_record_attachments/);
    assert.match(createSql, /findVaccineDoseByHealthRecordId/);
    assert.match(createSql, /existingReminder/);
    assert.match(updateSql, /mapFormTypeToHealthRecordType/);
    assert.match(updateSql, /purge_health_record_attachments/);
    assert.match(updateSql, /delete_health_record_attachment/);
  });

  it("document create ownership helper remains intact", () => {
    assert.deepEqual(
      resolveDocumentCreateOwnership(RECORD_ID, HOUSEHOLD_A, PET_A, {
        id: RECORD_ID,
        household_id: HOUSEHOLD_A,
        pet_id: PET_A,
      }),
      { ok: true, status: "reuse" },
    );
  });

  it("feeding / memory / pet photo paths stay out of 0035", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0035_health_record_attachments.sql"), "utf8");
    assert.doesNotMatch(sql, /feeding_sessions/);
    assert.doesNotMatch(sql, /memory_media/);
    assert.doesNotMatch(sql, /photo_path/);
    assert.doesNotMatch(sql, /document_attachments/);
  });
});
