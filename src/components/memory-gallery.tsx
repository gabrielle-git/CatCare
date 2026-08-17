"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import type { MemoryMediaWithUrl } from "@/types/database";

export function MemoryGallery({ title, media }: { title: string; media: MemoryMediaWithUrl[] }) {
  const photos = media.filter((item) => item.url);
  const [active, setActive] = useState(0);
  const current = photos[active];

  return <div className="relative aspect-[4/3] overflow-hidden bg-[var(--cream)]">
    {current?.url ? <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current.url} alt={`${title} — foto ${active + 1} de ${photos.length}`} className="h-full w-full object-cover transition duration-300" />
      {photos.length > 1 && <>
        <span className="absolute right-3 top-3 rounded-full bg-[var(--graphite)]/85 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm">{active + 1} / {photos.length} fotos</span>
        <button type="button" onClick={() => setActive((active - 1 + photos.length) % photos.length)} aria-label="Foto anterior" className="focus-ring absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-sm"><ChevronLeft size={17} /></button>
        <button type="button" onClick={() => setActive((active + 1) % photos.length)} aria-label="Próxima foto" className="focus-ring absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-sm"><ChevronRight size={17} /></button>
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">{photos.map((photo, index) => <button key={photo.id} type="button" aria-label={`Ver foto ${index + 1}`} onClick={() => setActive(index)} className={`size-2 rounded-full shadow-sm ${index === active ? "bg-white" : "bg-white/55"}`} />)}</div>
      </>}
    </> : <div className="grid h-full place-items-center"><ImageIcon size={28} className="text-[var(--muted)]" /></div>}
  </div>;
}
