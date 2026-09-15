"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import {
  ATTACHMENT_MAX_PER_DOCUMENT,
  attachmentKindLabel,
  attachmentSlotsSummary,
  canRemoveHealthRecordAttachment,
  formatAttachmentBytes,
  isDuplicateDisplayNameInScope,
  mergeLocalFileSelections,
  resolveAttachmentDisplayName,
  storedAttachmentSelectionKey,
  type LocalSelectedFile,
} from "@/lib/attachments";
import { healthAttachmentFieldNames } from "@/lib/health-record-attachment-form";
import { healthRecordAttachmentRemoveFormId } from "@/lib/health-record-attachment-form-ids";
import {
  registerPendingAttachmentFile,
  unregisterPendingAttachmentFile,
} from "@/lib/attachment-file-registry";
import type { AttachmentWithUrl } from "@/types/database";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const DUPLICATE_FILE_MESSAGE = "Este arquivo já foi selecionado. Selecione outro.";
const DUPLICATE_NAME_MESSAGE = "Já existe um arquivo com esse nome neste registro.";

function AccumulatingHealthFilePicker({
  disabled,
  existingStoredCount,
  existingAttachments,
  pickerId,
  heading,
  careType,
  petId,
}: {
  disabled?: boolean;
  existingStoredCount: number;
  existingAttachments: AttachmentWithUrl[];
  pickerId: string;
  heading: string;
  careType?: string | null;
  petId?: string | null;
}) {
  const [selected, setSelected] = useState<LocalSelectedFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const fieldNames = healthAttachmentFieldNames(careType, petId);

  const storedKeys = useMemo(
    () => existingAttachments.map((item) => storedAttachmentSelectionKey(item)),
    [existingAttachments],
  );

  const persistedNameEntries = useMemo(
    () =>
      existingAttachments.map((item) => ({
        key: item.id,
        name: resolveAttachmentDisplayName(item.display_name, item.original_filename),
      })),
    [existingAttachments],
  );

  useEffect(() => {
    for (const item of selected) {
      registerPendingAttachmentFile(item.id, item.file);
    }
    return () => {
      for (const item of selected) {
        unregisterPendingAttachmentFile(item.id);
      }
    };
  }, [selected]);

  const slots = attachmentSlotsSummary(existingStoredCount, selected.length);
  const remainingSlots = slots.remaining;

  function updateDisplayName(itemId: string, next: string) {
    const others = [
      ...persistedNameEntries,
      ...selected.map((entry) => ({ key: entry.id, name: entry.id === itemId ? next : entry.displayName })),
    ];
    setSelected((current) => current.map((entry) => (entry.id === itemId ? { ...entry, displayName: next } : entry)));
    setNameError(isDuplicateDisplayNameInScope(next, others, itemId) ? DUPLICATE_NAME_MESSAGE : null);
  }

  return (
    <div>
      <p className="text-sm font-bold">
        {heading} — {slots.label}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Opcional · JPG, PNG, WebP ou PDF · máx. 5 MB cada.
        {remainingSlots === 0 ? " Limite atingido." : ` Você ainda pode adicionar ${remainingSlots}.`}
      </p>

      {selected.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--lavender-strong)]">
            {existingStoredCount > 0 ? "Novos arquivos" : "Arquivos"} — {selected.length}
            {existingStoredCount === 0 ? ` de ${ATTACHMENT_MAX_PER_DOCUMENT}` : ""}
          </p>
          <ul className="mt-2 space-y-3">
            {selected.map((item) => (
              <li key={item.id} className="rounded-[16px] border border-[var(--border)] bg-[var(--cream)] px-3 py-3 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--muted)]">{item.file.name}</p>
                    <p className="mt-0.5 text-[var(--muted)]">
                      {attachmentKindLabel(item.file.type)} · {formatAttachmentBytes(item.file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      unregisterPendingAttachmentFile(item.id);
                      setSelected((current) => current.filter((entry) => entry.id !== item.id));
                      setNameError(null);
                    }}
                    className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 font-bold text-[var(--danger)]"
                  >
                    <Trash2 size={12} /> Remover
                  </button>
                </div>
                <label className="mt-3 block text-[11px] font-bold text-[var(--graphite)]">
                  Nome no CatCare
                  <input
                    disabled={disabled}
                    name={fieldNames.displayNames}
                    value={item.displayName}
                    onChange={(event) => updateDisplayName(item.id, event.target.value)}
                    maxLength={160}
                    className="field mt-1.5 text-sm font-semibold"
                    placeholder="Ex.: Resultado do hemograma"
                  />
                </label>
                <input type="hidden" name={fieldNames.attachmentIds} value={item.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <label
        htmlFor={pickerId}
        className={`mt-3 flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-[var(--lavender)] bg-[var(--lavender-soft)] px-4 py-4 text-xs font-bold text-[var(--lavender-strong)] ${disabled || remainingSlots === 0 ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}
      >
        <FilePlus2 size={17} /> + Adicionar arquivos
      </label>
      <input
        id={pickerId}
        disabled={disabled || remainingSlots === 0}
        multiple
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const incoming = Array.from(event.target.files ?? []);
          const merged = mergeLocalFileSelections(selected, incoming, {
            maxTotal: ATTACHMENT_MAX_PER_DOCUMENT,
            existingStoredCount,
            existingStoredKeys: storedKeys,
          });
          setSelected(merged.items);
          const parts: string[] = [];
          if (merged.skippedDuplicates) parts.push(DUPLICATE_FILE_MESSAGE);
          if (merged.truncated) parts.push(`limite de ${ATTACHMENT_MAX_PER_DOCUMENT} arquivos`);
          setNotice(parts.length ? parts.join(" · ") : null);

          const nameScope = [
            ...persistedNameEntries,
            ...merged.items.map((entry) => ({ key: entry.id, name: entry.displayName })),
          ];
          const hasNameClash = merged.items.some((entry) =>
            isDuplicateDisplayNameInScope(entry.displayName, nameScope, entry.id),
          );
          setNameError(hasNameClash ? DUPLICATE_NAME_MESSAGE : null);
          event.target.value = "";
        }}
      />
      {notice ? (
        <p className="mt-2 text-xs font-semibold text-[var(--danger)]" role="status">
          {notice}
        </p>
      ) : null}
      {nameError ? (
        <p className="mt-2 text-xs font-semibold text-[var(--danger)]" role="alert">
          {nameError}
        </p>
      ) : null}
    </div>
  );
}

export function HealthRecordExistingFilesPanel({
  attachments,
  disabled = false,
  editableNames = false,
  pendingLocalNames = [],
}: {
  attachments: AttachmentWithUrl[];
  disabled?: boolean;
  editableNames?: boolean;
  /** New local selections in the same record (create/edit picker). */
  pendingLocalNames?: Array<{ key: string; name: string }>;
}) {
  const [names, setNames] = useState(() =>
    Object.fromEntries(
      attachments.map((item) => [item.id, resolveAttachmentDisplayName(item.display_name, item.original_filename)]),
    ),
  );
  const [nameError, setNameError] = useState<string | null>(null);

  if (attachments.length === 0) return null;
  const slots = attachmentSlotsSummary(attachments.length, 0);
  const canRemove = canRemoveHealthRecordAttachment(attachments.length);

  function updateExistingName(attachmentId: string, next: string) {
    const others = [
      ...attachments.map((item) => ({
        key: item.id,
        name: item.id === attachmentId ? next : (names[item.id] ?? resolveAttachmentDisplayName(item.display_name, item.original_filename)),
      })),
      ...pendingLocalNames,
    ];
    setNames((current) => ({ ...current, [attachmentId]: next }));
    setNameError(isDuplicateDisplayNameInScope(next, others, attachmentId) ? DUPLICATE_NAME_MESSAGE : null);
  }

  return (
    <div>
      <p className="text-sm font-bold">Arquivos / Anexos — {slots.label}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Evidências deste registro clínico. Remover o último arquivo é permitido.</p>
      <ul className="mt-3 space-y-3">
        {attachments.map((item) => {
          const isPdf = item.mime_type === "application/pdf";
          const label = names[item.id] ?? resolveAttachmentDisplayName(item.display_name, item.original_filename);
          const removeFormId = healthRecordAttachmentRemoveFormId(item.id);
          return (
            <li key={item.id} className="rounded-[16px] border border-[var(--border)] bg-[var(--cream)] px-3 py-3 text-xs">
              {editableNames ? (
                <>
                  <input type="hidden" name="existing_attachment_ids" value={item.id} />
                  <label className="block text-[11px] font-bold text-[var(--graphite)]">
                    Nome no CatCare
                    <input
                      disabled={disabled}
                      name="existing_display_names"
                      value={label}
                      onChange={(event) => updateExistingName(item.id, event.target.value)}
                      maxLength={160}
                      className="field mt-1.5 text-sm font-semibold"
                      placeholder="Ex.: Resultado do hemograma"
                    />
                  </label>
                  <p className="mt-2 text-[11px] text-[var(--muted)]">
                    Arquivo original: <span className="font-semibold text-[var(--graphite)]">{item.original_filename}</span>
                  </p>
                  <p className="mt-0.5 text-[var(--muted)]">
                    {attachmentKindLabel(item.mime_type)} · {formatAttachmentBytes(item.byte_size)}
                  </p>
                </>
              ) : (
                <div className="min-w-0">
                  <p className="truncate font-semibold">{label}</p>
                  <p className="mt-0.5 text-[var(--muted)]">Arquivo original: {item.original_filename}</p>
                  <p className="mt-0.5 text-[var(--muted)]">
                    {attachmentKindLabel(item.mime_type)} · {formatAttachmentBytes(item.byte_size)}
                  </p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring inline-flex items-center rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 font-bold"
                  >
                    {isPdf ? "Abrir" : "Visualizar"}
                  </a>
                )}
                <a
                  href={`/api/attachments/${item.id}/download`}
                  className="focus-ring inline-flex items-center rounded-xl border border-[var(--border)] bg-white px-3 py-1.5 font-bold"
                >
                  Baixar
                </a>
                {canRemove ? (
                  <ConfirmButton
                    form={removeFormId}
                    title="Remover este arquivo?"
                    message="Ele será removido deste registro e não poderá ser recuperado por aqui."
                    confirmLabel="Remover arquivo"
                    className="focus-ring inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-bold text-[var(--danger)]"
                  >
                    <Trash2 size={12} /> Remover
                  </ConfirmButton>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {nameError ? (
        <p className="mt-2 text-xs font-semibold text-[var(--danger)]" role="alert">
          {nameError}
        </p>
      ) : null}
    </div>
  );
}

export function HealthRecordAttachmentsFields({
  disabled = false,
  existingAttachments = [],
  pickerId = "health-record-attachments-picker",
  showExisting = false,
  editableExistingNames = false,
  careType,
  petId,
  heading,
  compact = false,
}: {
  disabled?: boolean;
  existingAttachments?: AttachmentWithUrl[];
  pickerId?: string;
  showExisting?: boolean;
  editableExistingNames?: boolean;
  /** When set, FormData fields are scoped so multi-type create keeps files per health_record. */
  careType?: string | null;
  /** With careType, scopes FormData to petId+careType for multi-pet create. */
  petId?: string | null;
  heading?: string;
  /** Tighter spacing when nested under per-pet groups. */
  compact?: boolean;
}) {
  const resolvedHeading = heading ?? "Arquivos / Anexos";
  return (
    <section className={compact ? "space-y-3" : "mt-5 space-y-5"} aria-label={resolvedHeading}>
      {showExisting ? (
        <HealthRecordExistingFilesPanel
          attachments={existingAttachments}
          disabled={disabled}
          editableNames={editableExistingNames}
        />
      ) : null}
      <AccumulatingHealthFilePicker
        disabled={disabled}
        existingStoredCount={existingAttachments.length}
        existingAttachments={existingAttachments}
        pickerId={pickerId}
        heading={resolvedHeading}
        careType={careType}
        petId={petId}
      />
    </section>
  );
}
