"use client";

import { useEffect, useState } from "react";
import { FilePlus2, FileText, Trash2 } from "lucide-react";
import { DOCUMENT_CATEGORY_SUGGESTIONS } from "@/lib/attachments";
import type { AttachmentWithUrl } from "@/types/database";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export function DocumentFields({
  disabled = false,
  defaultTitle = "",
  defaultCategory = "",
  currentAttachments = [],
  requireFiles = true,
}: {
  disabled?: boolean;
  defaultTitle?: string;
  defaultCategory?: string;
  currentAttachments?: AttachmentWithUrl[];
  requireFiles?: boolean;
}) {
  const known = DOCUMENT_CATEGORY_SUGGESTIONS.some((item) => item.value === defaultCategory && item.value !== "other");
  const [preset, setPreset] = useState(known ? defaultCategory : defaultCategory ? "other" : "");
  const [other, setOther] = useState(known ? "" : defaultCategory);
  const [newNames, setNewNames] = useState<string[]>([]);

  useEffect(() => {
    const knownNow = DOCUMENT_CATEGORY_SUGGESTIONS.some((item) => item.value === defaultCategory && item.value !== "other");
    setPreset(knownNow ? defaultCategory : defaultCategory ? "other" : "");
    setOther(knownNow ? "" : defaultCategory);
  }, [defaultCategory]);

  return (
    <div className="space-y-5">
      <label className="block text-sm font-bold">
        Título <span className="text-[var(--danger)]">*</span>
        <input
          disabled={disabled}
          required
          name="title"
          defaultValue={defaultTitle}
          maxLength={160}
          className="field mt-2"
          placeholder="Ex.: Passaporte do Dobby"
        />
      </label>

      <div>
        <p className="text-sm font-bold">Categoria <span className="text-[var(--danger)]">*</span></p>
        <p className="mt-1 text-xs text-[var(--muted)]">Sugestões rápidas — ou escolha Outro e digite a sua.</p>
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

      {currentAttachments.length > 0 && (
        <div>
          <p className="text-sm font-bold">Arquivos atuais</p>
          <ul className="mt-3 space-y-2">
            {currentAttachments.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--cream)] px-3 py-2.5 text-xs">
                <span className="min-w-0 truncate font-semibold">{item.original_filename}</span>
                <span className="shrink-0 text-[var(--muted)]">{item.mime_type === "application/pdf" ? "PDF" : "Imagem"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--muted)]">Para remover um arquivo individual, use as ações na visualização do documento.</p>
        </div>
      )}

      <div>
        <p className="text-sm font-bold">
          {currentAttachments.length ? "Adicionar arquivos" : "Arquivos"}{" "}
          {requireFiles ? <span className="text-[var(--danger)]">*</span> : null}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">Até 8 arquivos no total · JPG, PNG, WebP ou PDF · máx. 5 MB cada.</p>
        {newNames.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {newNames.map((name) => (
              <li key={name} className="flex items-center gap-2 text-xs font-semibold text-[var(--lavender-strong)]">
                <FileText size={14} /> {name}
              </li>
            ))}
          </ul>
        )}
        <label className={`mt-3 flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-[var(--lavender)] bg-[var(--lavender-soft)] px-4 py-4 text-xs font-bold text-[var(--lavender-strong)] ${disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}>
          <FilePlus2 size={17} /> {newNames.length || currentAttachments.length ? "Escolher mais arquivos" : "Escolher arquivos"}
          <input
            disabled={disabled}
            required={requireFiles && currentAttachments.length === 0}
            multiple
            type="file"
            name="files"
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => {
              setNewNames(Array.from(event.target.files ?? []).map((file) => file.name));
            }}
          />
        </label>
      </div>
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
              <button type="submit" className="focus-ring inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold text-[var(--danger)]">
                <Trash2 size={12} /> Excluir arquivo
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
