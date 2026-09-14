"use client";

import { useEffect, useId, useState } from "react";
import { FilePlus2, FileText, Trash2 } from "lucide-react";
import {
  ATTACHMENT_MAX_PER_DOCUMENT,
  DOCUMENT_CATEGORY_SUGGESTIONS,
  LAST_ATTACHMENT_REMOVAL_MESSAGE,
  attachmentKindLabel,
  attachmentSlotsSummary,
  canRemoveStoredAttachment,
  formatAttachmentBytes,
  mergeLocalFileSelections,
  resolveAttachmentDisplayName,
  type LocalSelectedFile,
} from "@/lib/attachments";
import {
  registerPendingAttachmentFile,
  unregisterPendingAttachmentFile,
} from "@/lib/attachment-file-registry";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import type { AttachmentWithUrl } from "@/types/database";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function CategoryFields({
  disabled,
  defaultCategory,
}: {
  disabled?: boolean;
  defaultCategory?: string;
}) {
  const known = DOCUMENT_CATEGORY_SUGGESTIONS.some((item) => item.value === defaultCategory && item.value !== "other");
  const [preset, setPreset] = useState(known ? defaultCategory! : defaultCategory ? "other" : "");
  const [other, setOther] = useState(known ? "" : defaultCategory ?? "");

  useEffect(() => {
    const knownNow = DOCUMENT_CATEGORY_SUGGESTIONS.some((item) => item.value === defaultCategory && item.value !== "other");
    setPreset(knownNow ? defaultCategory! : defaultCategory ? "other" : "");
    setOther(knownNow ? "" : defaultCategory ?? "");
  }, [defaultCategory]);

  return (
    <div>
      <p className="text-sm font-bold">Categoria <span className="text-[var(--danger)]">*</span></p>
      <p className="mt-1 text-xs text-[var(--muted)]">Pertence ao documento (não a cada arquivo).</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DOCUMENT_CATEGORY_SUGGESTIONS.map((item) => {
          const active = preset === item.value;
          return (
            <button
              key={item.value}
              type="button"
              disabled={disabled}
              onClick={() => setPreset(item.value)}
              className={`focus-ring rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-[var(--graphite)] text-white" : "border border-[var(--border)] bg-white text-[var(--muted)]"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="category_preset" value={preset} />
      {preset === "other" && (
        <input
          disabled={disabled}
          required
          name="category_other"
          value={other}
          onChange={(event) => setOther(event.target.value)}
          maxLength={80}
          className="field mt-3"
          placeholder="Categoria personalizada"
        />
      )}
      {!preset && <p className="mt-2 text-xs text-[var(--danger)]">Escolha uma categoria.</p>}
    </div>
  );
}

function AccumulatingFilePicker({
  disabled,
  requireFiles,
  existingStoredCount,
  pickerId,
  heading,
}: {
  disabled?: boolean;
  requireFiles: boolean;
  existingStoredCount: number;
  pickerId: string;
  heading: string;
}) {
  const [selected, setSelected] = useState<LocalSelectedFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

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

  return (
    <div>
      <p className="text-sm font-bold">
        {heading} {requireFiles && existingStoredCount === 0 ? <span className="text-[var(--danger)]">*</span> : null}
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {slots.label} arquivos · JPG, PNG, WebP ou PDF · máx. 5 MB cada.
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
                    name="display_names"
                    value={item.displayName}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSelected((current) =>
                        current.map((entry) => (entry.id === item.id ? { ...entry, displayName: next } : entry)),
                      );
                    }}
                    maxLength={160}
                    className="field mt-1.5 text-sm font-semibold"
                    placeholder="Ex.: CNH — Frente"
                  />
                </label>
                <input type="hidden" name="attachment_ids" value={item.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {requireFiles && existingStoredCount === 0 ? (
        <input type="hidden" name="require_files" value="1" />
      ) : null}

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
      {requireFiles && existingStoredCount === 0 && selected.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--danger)]">Adicione ao menos um arquivo.</p>
      ) : null}
    </div>
  );
}

/** Existing attachments — display_name inputs live in the parent save form; remove uses external form ids. */
export function DocumentExistingFilesPanel({
  attachments,
  disabled = false,
  editableNames = false,
  removeFormIdFor,
}: {
  attachments: AttachmentWithUrl[];
  disabled?: boolean;
  editableNames?: boolean;
  /** When set, Remover submits that external form id (avoids nested forms). */
  removeFormIdFor?: (attachmentId: string) => string;
}) {
  if (attachments.length === 0) return null;
  const slots = attachmentSlotsSummary(attachments.length, 0);
  const canRemove = canRemoveStoredAttachment(attachments.length);

  return (
    <div>
      <p className="text-sm font-bold">Arquivos deste documento — {slots.label}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Cada item é um arquivo do mesmo documento, não um documento separado.</p>
      <ul className="mt-3 space-y-3">
        {attachments.map((item) => {
          const isPdf = item.mime_type === "application/pdf";
          const label = resolveAttachmentDisplayName(item.display_name, item.original_filename);
          const removeFormId = removeFormIdFor?.(item.id);
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
                      placeholder="Ex.: CNH — Frente"
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
                  <p className="mt-0.5 text-[var(--muted)]">
                    Arquivo original: {item.original_filename}
                  </p>
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
                    className="focus-ring rounded-xl bg-[var(--lavender-soft)] px-3 py-2 text-[11px] font-bold text-[var(--lavender-strong)]"
                  >
                    {isPdf ? "Abrir" : "Visualizar"}
                  </a>
                )}
                <a
                  href={`/api/attachments/${item.id}/download`}
                  className="focus-ring rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-bold"
                >
                  Baixar
                </a>
                {removeFormId && canRemove ? (
                  <ConfirmButton
                    form={removeFormId}
                    title="Remover arquivo?"
                    message="Remover este arquivo do documento? O documento continua existindo."
                    confirmLabel="Remover arquivo"
                    className="focus-ring inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold text-[var(--danger)]"
                  >
                    <Trash2 size={12} /> Remover
                  </ConfirmButton>
                ) : removeFormId && !canRemove ? (
                  <span className="rounded-xl px-3 py-2 text-[11px] font-semibold text-[var(--muted)]">Último arquivo</span>
                ) : null}
              </div>
              {!canRemove && removeFormId && (
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{LAST_ATTACHMENT_REMOVAL_MESSAGE}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DocumentFields({
  disabled = false,
  defaultTitle = "",
  defaultCategory = "",
  existingStoredCount = 0,
  existingAttachments,
  requireFiles = true,
  documentId,
  submitLabel,
  removeFormIdFor,
}: {
  disabled?: boolean;
  defaultTitle?: string;
  defaultCategory?: string;
  /** Count of already-saved attachments (for slot math). */
  existingStoredCount?: number;
  /** When provided, renders editable display names inside this form. */
  existingAttachments?: AttachmentWithUrl[];
  requireFiles?: boolean;
  documentId?: string;
  submitLabel: string;
  removeFormIdFor?: (attachmentId: string) => string;
}) {
  const pickerId = useId();
  const storedCount = existingAttachments?.length ?? existingStoredCount;

  return (
    <div className="space-y-5">
      {documentId ? <input type="hidden" name="document_id" value={documentId} /> : null}

      <label className="block text-sm font-bold">
        Título <span className="text-[var(--danger)]">*</span>
        <input
          disabled={disabled}
          required
          name="title"
          defaultValue={defaultTitle}
          maxLength={160}
          className="field mt-2"
          placeholder="Ex.: Carteira de vacinação do Dobby"
        />
        <span className="mt-1.5 block text-xs font-normal text-[var(--muted)]">Nome do documento lógico — os arquivos abaixo pertencem a ele.</span>
      </label>

      <CategoryFields disabled={disabled} defaultCategory={defaultCategory} />

      {existingAttachments && existingAttachments.length > 0 ? (
        <DocumentExistingFilesPanel
          attachments={existingAttachments}
          disabled={disabled}
          editableNames
          removeFormIdFor={removeFormIdFor}
        />
      ) : null}

      <AccumulatingFilePicker
        disabled={disabled}
        requireFiles={requireFiles}
        existingStoredCount={storedCount}
        pickerId={pickerId}
        heading={storedCount > 0 ? "Adicionar mais arquivos" : "Arquivos"}
      />

      <SubmitButton
        disabled={disabled}
        pendingLabel="Salvando..."
        className="focus-ring mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-4 text-sm font-bold text-white disabled:opacity-60"
      >
        <FilePlus2 size={18} /> {submitLabel}
      </SubmitButton>
    </div>
  );
}

export function DocumentAttachmentActions({
  attachment,
  canDelete,
  deleteAction,
}: {
  attachment: AttachmentWithUrl;
  canDelete: boolean;
  deleteAction?: (formData: FormData) => void | Promise<void>;
}) {
  const isPdf = attachment.mime_type === "application/pdf";
  const label = resolveAttachmentDisplayName(attachment.display_name, attachment.original_filename);
  return (
    <div className="cat-card overflow-hidden">
      <div className="bg-[var(--cream)] p-4">
        {isPdf ? (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-[18px] bg-white">
            <FileText size={28} className="text-[var(--lavender-strong)]" />
            <p className="px-4 text-center text-xs font-bold">{label}</p>
          </div>
        ) : attachment.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachment.url} alt={label} className="aspect-[4/3] w-full rounded-[18px] object-cover" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-[18px] bg-white text-xs text-[var(--muted)]">Prévia indisponível</div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <p className="truncate text-sm font-bold">{label}</p>
        <p className="text-xs text-[var(--muted)]">Arquivo original: {attachment.original_filename}</p>
        <p className="text-xs text-[var(--muted)]">
          {attachmentKindLabel(attachment.mime_type)} · {formatAttachmentBytes(attachment.byte_size)}
        </p>
        <div className="flex flex-wrap gap-2">
          {attachment.url && (
            <a href={attachment.url} target="_blank" rel="noreferrer" className="focus-ring rounded-xl bg-[var(--lavender-soft)] px-3 py-2 text-[11px] font-bold text-[var(--lavender-strong)]">
              {isPdf ? "Abrir / Visualizar" : "Ampliar"}
            </a>
          )}
          <a href={`/api/attachments/${attachment.id}/download`} className="focus-ring rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[11px] font-bold">
            Baixar
          </a>
          {canDelete && deleteAction && (
            <form action={deleteAction}>
              <ConfirmButton
                title="Remover arquivo?"
                message="Remover este arquivo do documento? O documento continua existindo."
                confirmLabel="Remover arquivo"
                className="focus-ring inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold text-[var(--danger)]"
              >
                <Trash2 size={12} /> Remover arquivo
              </ConfirmButton>
            </form>
          )}
        </div>
        {!canDelete && (
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">{LAST_ATTACHMENT_REMOVAL_MESSAGE}</p>
        )}
      </div>
    </div>
  );
}
