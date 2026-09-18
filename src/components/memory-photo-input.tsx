"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Pencil, Star, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  deleteMemoryMediaBulk,
  replaceMemoryMedia,
  setMemoryCover,
} from "@/app/(app)/memories/actions";
import {
  registerPendingAttachmentFile,
  unregisterPendingAttachmentFile,
  clearPendingAttachmentFiles,
} from "@/lib/attachment-file-registry";
import { localFileSelectionKey } from "@/lib/attachments";
import { IMAGE_MEDIA_MAX_BYTES, isImageMediaMime, MEMORY_MEDIA_MAX_PHOTOS } from "@/lib/image-media";
import {
  compensateMemoryUploadsIfNeeded,
  runDirectMemoryMediaUploads,
} from "@/lib/memory-direct-upload-client";
import type { MemoryMediaUploadIntent } from "@/lib/memory-media-upload";
import type { MemoryMediaWithUrl } from "@/types/database";

type PendingPhoto = {
  mediaId: string;
  file: File;
  url: string;
  selectionKey: string;
};

export function MemoryPhotoInput({
  currentMedia = [],
  disabled = false,
  memoryId,
  onIntentsChange,
}: {
  currentMedia?: MemoryMediaWithUrl[];
  disabled?: boolean;
  /** When set (edit), enables selection / cover / replace management. */
  memoryId?: string;
  onIntentsChange?: (intents: MemoryMediaUploadIntent[]) => void;
}) {
  const router = useRouter();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  useEffect(() => () => {
    pending.forEach((item) => {
      URL.revokeObjectURL(item.url);
      unregisterPendingAttachmentFile(item.mediaId);
    });
  }, [pending]);

  useEffect(() => {
    onIntentsChange?.(
      pending.map((item, position) => ({
        media_id: item.mediaId,
        mime_type: item.file.type as MemoryMediaUploadIntent["mime_type"],
        byte_size: item.file.size,
        original_filename: item.file.name || "foto",
        position,
      })),
    );
  }, [pending, onIntentsChange]);

  const hasCurrentPhoto = currentMedia.length > 0;
  const remainingSlots = MEMORY_MEDIA_MAX_PHOTOS - currentMedia.length - pending.length;
  const coverId = currentMedia[0]?.id ?? null;

  function addFiles(fileList: FileList | null) {
    setLocalError(null);
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    const existingKeys = new Set(pending.map((item) => item.selectionKey));
    const next: PendingPhoto[] = [...pending];

    for (const file of files) {
      if (next.length >= MEMORY_MEDIA_MAX_PHOTOS - currentMedia.length) {
        setLocalError(`Escolha no máximo ${MEMORY_MEDIA_MAX_PHOTOS} fotos por memória.`);
        break;
      }
      if (!isImageMediaMime(file.type)) {
        setLocalError(`A foto “${file.name}” precisa ser JPG, PNG ou WebP.`);
        continue;
      }
      if (file.size > IMAGE_MEDIA_MAX_BYTES) {
        setLocalError(`A foto “${file.name}” deve ter no máximo 5 MB.`);
        continue;
      }
      const selectionKey = localFileSelectionKey(file);
      if (existingKeys.has(selectionKey)) {
        setLocalError("Esta foto já foi selecionada nesta memória.");
        continue;
      }
      const mediaId = crypto.randomUUID();
      registerPendingAttachmentFile(mediaId, file);
      existingKeys.add(selectionKey);
      next.push({ mediaId, file, url: URL.createObjectURL(file), selectionKey });
    }
    setPending(next);
  }

  function clearPending() {
    pending.forEach((item) => {
      URL.revokeObjectURL(item.url);
      unregisterPendingAttachmentFile(item.mediaId);
    });
    clearPendingAttachmentFiles(pending.map((item) => item.mediaId));
    setPending([]);
  }

  function exitSelection() {
    setSelecting(false);
    setSelectedIds(new Set());
    setConfirmDelete(false);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulkDelete() {
    if (!memoryId || selectedIds.size === 0) return;
    startTransition(async () => {
      setLocalError(null);
      setStatus("Excluindo fotos...");
      const result = await deleteMemoryMediaBulk(memoryId, [...selectedIds]);
      setStatus(null);
      if (!result.ok) {
        setLocalError(result.error);
        return;
      }
      exitSelection();
      router.refresh();
    });
  }

  function runSetCover(mediaId: string) {
    if (!memoryId) return;
    startTransition(async () => {
      setLocalError(null);
      setStatus("Atualizando capa...");
      const result = await setMemoryCover(memoryId, mediaId);
      setStatus(null);
      if (!result.ok) {
        setLocalError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function openReplacePicker(mediaId: string) {
    setReplacingId(mediaId);
    replaceInputRef.current?.click();
  }

  function onReplaceFile(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;
    const oldId = replacingId;
    setReplacingId(null);
    if (replaceInputRef.current) replaceInputRef.current.value = "";
    if (!file || !oldId || !memoryId) return;

    if (!isImageMediaMime(file.type)) {
      setLocalError("A foto precisa ser JPG, PNG ou WebP.");
      return;
    }
    if (file.size > IMAGE_MEDIA_MAX_BYTES) {
      setLocalError("A foto deve ter no máximo 5 MB.");
      return;
    }

    startTransition(async () => {
      setLocalError(null);
      const mediaId = crypto.randomUUID();
      registerPendingAttachmentFile(mediaId, file);
      let newlyCreatedPaths: string[] = [];
      try {
        const formData = new FormData();
        const intent: MemoryMediaUploadIntent = {
          media_id: mediaId,
          mime_type: file.type as MemoryMediaUploadIntent["mime_type"],
          byte_size: file.size,
          original_filename: file.name || "foto",
          position: 0,
        };
        newlyCreatedPaths = (
          await runDirectMemoryMediaUploads(formData, memoryId, [intent], (progress) => {
            setStatus(progress.message);
          })
        ).newlyCreatedPaths;
        setStatus("Substituindo foto...");
        const result = await replaceMemoryMedia(memoryId, oldId, formData);
        if (!result.ok) {
          if (newlyCreatedPaths.length) await compensateMemoryUploadsIfNeeded(newlyCreatedPaths);
          setLocalError(result.error);
          setStatus(null);
          return;
        }
        setStatus(null);
        router.refresh();
      } catch (cause) {
        if (newlyCreatedPaths.length) await compensateMemoryUploadsIfNeeded(newlyCreatedPaths);
        setLocalError(cause instanceof Error ? cause.message : "Não foi possível substituir a foto.");
        setStatus(null);
      } finally {
        unregisterPendingAttachmentFile(mediaId);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-bold">Fotos da memória</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Adicione até {MEMORY_MEDIA_MAX_PHOTOS} fotos (opcional). A capa aparece no álbum.
          </p>
        </div>
        {memoryId && hasCurrentPhoto && !disabled ? (
          selecting ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[var(--muted)]">
                {selectedIds.size} selecionada{selectedIds.size === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                disabled={busy || selectedIds.size === 0}
                onClick={() => setConfirmDelete(true)}
                className="focus-ring inline-flex items-center gap-1.5 rounded-2xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-[var(--danger)] disabled:opacity-55"
              >
                <Trash2 size={14} aria-hidden /> Excluir selecionadas
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={exitSelection}
                className="focus-ring inline-flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold"
              >
                <X size={14} aria-hidden /> Concluir
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelecting(true)}
              className="focus-ring rounded-2xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-bold"
            >
              Selecionar
            </button>
          )
        ) : null}
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => onReplaceFile(event.target.files)}
      />

      {!hasCurrentPhoto && pending.length === 0 ? (
        <p className="mt-3 rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--cream)] px-4 py-6 text-center text-sm font-semibold text-[var(--muted)]">
          Nenhuma foto nesta memória.
        </p>
      ) : null}

      {currentMedia.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {currentMedia.map((item, index) => {
            const isCover = item.id === coverId || index === 0;
            const isSelected = selectedIds.has(item.id);
            return (
              <div key={item.id} className="relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--cream)]">
                <div className="aspect-square">
                  {item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={`Foto ${index + 1} da memória`} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                {isCover ? (
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold shadow-sm">
                    Capa
                  </span>
                ) : null}

                {selecting ? (
                  <button
                    type="button"
                    disabled={busy || disabled}
                    aria-pressed={isSelected}
                    aria-label={isSelected ? `Desmarcar foto ${index + 1}` : `Selecionar foto ${index + 1}`}
                    onClick={() => toggleSelected(item.id)}
                    className={`absolute inset-x-2 bottom-2 rounded-xl px-2 py-2 text-[10px] font-bold shadow-sm ${
                      isSelected ? "bg-[var(--lavender)] text-white" : "bg-white/95 text-[var(--graphite)]"
                    }`}
                  >
                    {isSelected ? "Selecionada" : "Selecionar"}
                  </button>
                ) : (
                  <div className="absolute inset-x-2 bottom-2 flex flex-wrap gap-1">
                    {!isCover && memoryId && !disabled ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runSetCover(item.id)}
                        className="focus-ring inline-flex items-center gap-1 rounded-xl bg-white/95 px-2 py-1.5 text-[10px] font-bold shadow-sm"
                      >
                        <Star size={12} aria-hidden /> Definir como capa
                      </button>
                    ) : null}
                    {memoryId && !disabled ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openReplacePicker(item.id)}
                        aria-label="Substituir foto"
                        title="Substituir foto"
                        className="focus-ring ml-auto inline-flex items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-sm"
                      >
                        <Pencil size={13} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pending.map((item, index) => (
            <div key={item.mediaId} className="relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--cream)]">
              <div className="aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={`Nova foto ${index + 1}: ${item.file.name}`} className="h-full w-full object-cover" />
              </div>
              <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold shadow-sm">
                Nova {index + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      <label
        className={`mt-3 flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-[var(--lavender)] bg-[var(--lavender-soft)] px-4 py-4 text-xs font-bold text-[var(--lavender-strong)] ${
          disabled || remainingSlots <= 0 || selecting ? "cursor-not-allowed opacity-55" : "cursor-pointer"
        }`}
      >
        <ImagePlus size={17} /> {hasCurrentPhoto || pending.length ? "Adicionar mais fotos" : "Adicionar fotos"}
        <input
          disabled={disabled || remainingSlots <= 0 || selecting}
          multiple
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {pending.length > 0 && !disabled ? (
        <button type="button" className="mt-2 text-xs font-bold text-[var(--muted)] underline" onClick={clearPending}>
          Limpar novas fotos
        </button>
      ) : null}
      {status || busy ? (
        <p className="mt-2 text-sm font-semibold text-[var(--lavender-strong)]" aria-live="polite">
          {status ?? "Atualizando..."}
        </p>
      ) : null}
      {localError ? (
        <p className="mt-2 text-sm font-semibold text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}
      <p className="mt-1.5 text-xs text-[var(--muted)]">
        Fotos JPG, PNG ou WebP, até 5 MB cada. Vídeos e PDF não entram em Memórias.
      </p>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-delete-title"
            className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-xl"
          >
            <h2 id="memory-delete-title" className="text-lg font-bold">
              Excluir fotos selecionadas?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Essas fotos serão removidas desta memória.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
                className="focus-ring rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={runBulkDelete}
                className="focus-ring rounded-2xl bg-[var(--danger)] px-4 py-2.5 text-sm font-bold text-white"
              >
                Excluir fotos
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
