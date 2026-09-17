"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import {
  registerPendingAttachmentFile,
  unregisterPendingAttachmentFile,
  clearPendingAttachmentFiles,
} from "@/lib/attachment-file-registry";
import { localFileSelectionKey } from "@/lib/attachments";
import { IMAGE_MEDIA_MAX_BYTES, isImageMediaMime, MEMORY_MEDIA_MAX_PHOTOS } from "@/lib/image-media";
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
  onIntentsChange,
}: {
  currentMedia?: MemoryMediaWithUrl[];
  disabled?: boolean;
  /** Create/edit client forms receive stable media intents for direct upload. */
  onIntentsChange?: (intents: MemoryMediaUploadIntent[]) => void;
}) {
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

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
      next.push({
        mediaId,
        file,
        url: URL.createObjectURL(file),
        selectionKey,
      });
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

  return (
    <div>
      <p className="text-sm font-bold">
        Fotos da memória <span className="text-[var(--danger)]">*</span>
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Adicione até {MEMORY_MEDIA_MAX_PHOTOS} fotos. A primeira fica como capa do álbum.
      </p>

      {currentMedia.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {currentMedia.map((item, index) => (
            <label key={item.id} className="group relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--cream)]">
              <div className="aspect-square">
                {item.url && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={`Foto ${index + 1} da memória`} className="h-full w-full object-cover" />
                  </>
                )}
              </div>
              <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold shadow-sm">
                {index === 0 ? "Capa" : `Foto ${index + 1}`}
              </span>
              <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 rounded-xl bg-white/95 px-2 py-2 text-[10px] font-bold text-[var(--danger)] shadow-sm">
                <input disabled={disabled} type="checkbox" name="remove_media_ids" value={item.id} className="size-3.5 accent-[var(--danger)]" />
                <Trash2 size={12} /> Remover
              </span>
            </label>
          ))}
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
          disabled || remainingSlots <= 0 ? "cursor-not-allowed opacity-55" : "cursor-pointer"
        }`}
      >
        <ImagePlus size={17} /> {hasCurrentPhoto || pending.length ? "Adicionar mais fotos" : "Escolher fotos"}
        <input
          disabled={disabled || remainingSlots <= 0}
          required={!hasCurrentPhoto && pending.length === 0}
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
      {localError ? (
        <p className="mt-2 text-sm font-semibold text-[var(--danger)]" role="alert">
          {localError}
        </p>
      ) : null}
      <p className="mt-1.5 text-xs text-[var(--muted)]">
        JPG, PNG ou WebP, até 5 MB por foto. Na edição, marque uma foto existente para removê-la.
      </p>
    </div>
  );
}
