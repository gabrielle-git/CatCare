"use client";

import { useEffect, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import type { MemoryMediaWithUrl } from "@/types/database";

const MAX_PHOTOS = 8;

export function MemoryPhotoInput({ currentMedia = [], disabled = false }: { currentMedia?: MemoryMediaWithUrl[]; disabled?: boolean }) {
  const [newPreviews, setNewPreviews] = useState<Array<{ name: string; url: string }>>([]);

  useEffect(() => () => { newPreviews.forEach((item) => URL.revokeObjectURL(item.url)); }, [newPreviews]);

  const hasCurrentPhoto = currentMedia.length > 0;
  return <div>
    <p className="text-sm font-bold">Fotos da memória <span className="text-[var(--danger)]">*</span></p>
    <p className="mt-1 text-xs text-[var(--muted)]">Adicione até {MAX_PHOTOS} fotos. A primeira fica como capa do álbum.</p>

    {currentMedia.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {currentMedia.map((item, index) => <label key={item.id} className="group relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--cream)]">
        <div className="aspect-square">
          {item.url && <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={`Foto ${index + 1} da memória`} className="h-full w-full object-cover" />
          </>}
        </div>
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold shadow-sm">{index === 0 ? "Capa" : `Foto ${index + 1}`}</span>
        <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 rounded-xl bg-white/95 px-2 py-2 text-[10px] font-bold text-[var(--danger)] shadow-sm"><input disabled={disabled} type="checkbox" name="remove_media_ids" value={item.id} className="size-3.5 accent-[var(--danger)]" /> <Trash2 size={12} /> Remover</span>
      </label>)}
    </div>}

    {newPreviews.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {newPreviews.map((item, index) => <div key={item.url} className="relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--cream)]">
        <div className="aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={`Nova foto ${index + 1}: ${item.name}`} className="h-full w-full object-cover" />
        </div>
        <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold shadow-sm">Nova {index + 1}</span>
      </div>)}
    </div>}

    <label className={`mt-3 flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-[var(--lavender)] bg-[var(--lavender-soft)] px-4 py-4 text-xs font-bold text-[var(--lavender-strong)] ${disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}>
      <ImagePlus size={17} /> {hasCurrentPhoto || newPreviews.length ? "Adicionar mais fotos" : "Escolher fotos"}
      <input disabled={disabled} required={!hasCurrentPhoto} multiple type="file" name="photos" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
        newPreviews.forEach((item) => URL.revokeObjectURL(item.url));
        const files = Array.from(event.target.files ?? []);
        setNewPreviews(files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })));
      }} />
    </label>
    <p className="mt-1.5 text-xs text-[var(--muted)]">JPG, PNG ou WebP, até 5 MB por foto. Na edição, marque uma foto existente para removê-la.</p>
  </div>;
}
