"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  type LocalSelectedFile,
} from "@/lib/attachments";
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
  const syncInputRef = useRef<HTMLInputElement>(null);

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
            {existingStoredCount > 0 ? "Novos arquivos" : "Arquivos selecionados"} — {selected.length}
          </p>
          <ul className="mt-2 space-y-2">
            {selected.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--cream)] px-3 py-2.5 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.file.name}</p>
                  <p className="mt-0.5 text-[var(--muted)]">{attachmentKindLabel(item.file.type)} · {formatAttachmentBytes(item.file.size)}</p>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelected((current) => current.filter((entry) => entry.id !== item.id))}
                  className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 font-bold text-[var(--danger)]"
                >
                  <Trash2 size={12} /> Remover
                </button>
                <input type="hidden" name="attachment_ids" value={item.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <input
        ref={syncInputRef}
        type="file"
        name="files"
        multiple
        className="hidden"
        required={requireFiles && existingStoredCount === 0}
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

/** Existing attachments with view/remove — must stay OUTSIDE the save form (no nested forms). */
export function DocumentExistingFilesPanel({
  attachments,
  disabled = false,
  removeAttachmentAction,
}: {
  attachments: AttachmentWithUrl[];
  disabled?: boolean;
  removeAttachmentAction?: (attachmentId: string) => (formData: FormData) => void | Promise<void>;
}) {
  if (attachments.length === 0) return null;
  const slots = attachmentSlotsSummary(attachments.length, 0);
  const canRemove = canRemoveStoredAttachment(attachments.length);

  return (
    <div>
      <p className="text-sm font-bold">Arquivos deste documento — {slots.label}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Cada item é um arquivo do mesmo documento, não um documento separado.</p>
      <ul className="mt-3 space-y-2">
        {attachments.map((item) => {
          const isPdf = item.mime_type === "application/pdf";
          const remove = !disabled ? removeAttachmentAction?.(item.id) : undefined;
          return (
            <li key={item.id} className="rounded-[16px] border border-[var(--border)] bg-[var(--cream)] px-3 py-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.original_filename}</p>
                  <p className="mt-0.5 text-[var(--muted)]">
                    {attachmentKindLabel(item.mime_type)} · {formatAttachmentBytes(item.byte_size)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
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
                  {remove && canRemove ? (
                    <form action={remove}>
                      <ConfirmButton
                        title="Remover arquivo?"
                        message="Remover este arquivo do documento? O documento continua existindo."
                        confirmLabel="Remover arquivo"
                        className="focus-ring inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold text-[var(--danger)]"
                      >
                        <Trash2 size={12} /> Remover
                      </ConfirmButton>
                    </form>
                  ) : remove && !canRemove ? (
                    <span className="rounded-xl px-3 py-2 text-[11px] font-semibold text-[var(--muted)]">Último arquivo</span>
                  ) : null}
                </div>
              </div>
              {!canRemove && remove && (
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
  requireFiles = true,
  documentId,
  submitLabel,
}: {
  disabled?: boolean;
  defaultTitle?: string;
  defaultCategory?: string;
  /** Count of already-saved attachments (for slot math). Render list via DocumentExistingFilesPanel outside this form. */
  existingStoredCount?: number;
  requireFiles?: boolean;
  documentId?: string;
  submitLabel: string;
}) {
  const pickerId = useId();

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

      <AccumulatingFilePicker
        disabled={disabled}
        requireFiles={requireFiles}
        existingStoredCount={existingStoredCount}
        pickerId={pickerId}
        heading={existingStoredCount > 0 ? "Adicionar mais arquivos" : "Arquivos"}
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
  return (
    <div className="cat-card overflow-hidden">
      <div className="bg-[var(--cream)] p-4">
        {isPdf ? (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-[18px] bg-white">
            <FileText size={28} className="text-[var(--lavender-strong)]" />
            <p className="px-4 text-center text-xs font-bold">{attachment.original_filename}</p>
          </div>
        ) : attachment.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachment.url} alt={attachment.original_filename} className="aspect-[4/3] w-full rounded-[18px] object-cover" />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-[18px] bg-white text-xs text-[var(--muted)]">Prévia indisponível</div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <p className="truncate text-sm font-bold">{attachment.original_filename}</p>
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
