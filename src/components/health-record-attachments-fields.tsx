"use client";

import { useEffect, useRef, useState } from "react";
import { FilePlus2, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import {
  ATTACHMENT_MAX_PER_DOCUMENT,
  attachmentKindLabel,
  attachmentSlotsSummary,
  canRemoveHealthRecordAttachment,
  formatAttachmentBytes,
  mergeLocalFileSelections,
  resolveAttachmentDisplayName,
  type LocalSelectedFile,
} from "@/lib/attachments";
import { healthAttachmentFieldNames } from "@/lib/health-record-attachment-form";
import { healthRecordAttachmentRemoveFormId } from "@/lib/health-record-attachment-form-ids";
import type { AttachmentWithUrl } from "@/types/database";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function AccumulatingHealthFilePicker({
  disabled,
  existingStoredCount,
  pickerId,
  heading,
  careType,
}: {
  disabled?: boolean;
  existingStoredCount: number;
  pickerId: string;
  heading: string;
  careType?: string | null;
}) {
  const [selected, setSelected] = useState<LocalSelectedFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const syncInputRef = useRef<HTMLInputElement>(null);
  const fieldNames = healthAttachmentFieldNames(careType);

  useEffect(() => {
    const input = syncInputRef.current;
    if (!input) return;
    const transfer = new DataTransfer();
    selected.forEach((item) => transfer.items.add(item.file));
    input.files = transfer.files;
  }, [selected]);

  const slots = attachmentSlotsSummary(existingStoredCount, selected.length);
  const remainingSlots = slots.remaining;

  return (
    <div>
      <p className="text-sm font-bold">{heading} — {slots.label}</p>
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
                    onClick={() => setSelected((current) => current.filter((entry) => entry.id !== item.id))}
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
                    onChange={(event) => {
                      const next = event.target.value;
                      setSelected((current) =>
                        current.map((entry) => (entry.id === item.id ? { ...entry, displayName: next } : entry)),
                      );
                    }}
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

      <input
        ref={syncInputRef}
        type="file"
        name={fieldNames.files}
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

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
          });
          setSelected(merged.items);
          const parts: string[] = [];
          if (merged.skippedDuplicates) parts.push(`${merged.skippedDuplicates} já estavam na lista`);
          if (merged.truncated) parts.push(`limite de ${ATTACHMENT_MAX_PER_DOCUMENT} arquivos`);
          setNotice(parts.length ? parts.join(" · ") : null);
          event.target.value = "";
        }}
      />
      {notice && <p className="mt-2 text-xs text-[var(--muted)]">{notice}</p>}
    </div>
  );
}

export function HealthRecordExistingFilesPanel({
  attachments,
  disabled = false,
  editableNames = false,
}: {
  attachments: AttachmentWithUrl[];
  disabled?: boolean;
  editableNames?: boolean;
}) {
  if (attachments.length === 0) return null;
  const slots = attachmentSlotsSummary(attachments.length, 0);
  const canRemove = canRemoveHealthRecordAttachment(attachments.length);

  return (
    <div>
      <p className="text-sm font-bold">Arquivos / Anexos — {slots.label}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Evidências deste registro clínico. Remover o último arquivo é permitido.</p>
      <ul className="mt-3 space-y-3">
        {attachments.map((item) => {
          const isPdf = item.mime_type === "application/pdf";
          const label = resolveAttachmentDisplayName(item.display_name, item.original_filename);
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
                      defaultValue={label}
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
  heading,
}: {
  disabled?: boolean;
  existingAttachments?: AttachmentWithUrl[];
  pickerId?: string;
  showExisting?: boolean;
  editableExistingNames?: boolean;
  /** When set, FormData fields are scoped so multi-type create keeps files per health_record. */
  careType?: string | null;
  heading?: string;
}) {
  const resolvedHeading = heading ?? "Arquivos / Anexos";
  return (
    <section className="mt-5 space-y-5" aria-label={resolvedHeading}>
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
        pickerId={pickerId}
        heading={resolvedHeading}
        careType={careType}
      />
    </section>
  );
}
