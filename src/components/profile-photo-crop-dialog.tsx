"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  blobToCroppedFile,
  clampCropOffset,
  minCoverZoom,
  renderSquareCropToBlob,
} from "@/lib/profile-photo-crop";

const VIEWPORT = 280;

/**
 * Fixed 1:1 crop dialog for pet profile photos.
 * No external crop library — pan + zoom over a square viewport.
 */
export function ProfilePhotoCropDialog({
  open,
  file,
  onCancel,
  onConfirm,
  pending = false,
}: {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
  pending?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const minZoom = useMemo(
    () => (natural.width ? minCoverZoom(natural.width, natural.height, VIEWPORT) : 1),
    [natural],
  );

  useEffect(() => {
    if (!open || !file) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, pending]);

  if (!open || !file || !objectUrl) return null;

  function onImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    imgRef.current = img;
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    setNatural({ width, height });
    const cover = minCoverZoom(width, height, VIEWPORT);
    setZoom(cover);
    const displayedW = width * cover;
    const displayedH = height * cover;
    setOffset({
      x: (VIEWPORT - displayedW) / 2,
      y: (VIEWPORT - displayedH) / 2,
    });
  }

  function applyPan(nextX: number, nextY: number, nextZoom = zoom) {
    const clamped = clampCropOffset(natural.width, natural.height, nextZoom, VIEWPORT, nextX, nextY);
    setOffset({ x: clamped.offsetX, y: clamped.offsetY });
  }

  async function confirm() {
    setError(null);
    const img = imgRef.current;
    if (!img || !natural.width) {
      setError("Aguarde a foto carregar.");
      return;
    }
    try {
      const blob = await renderSquareCropToBlob(img, {
        imageWidth: natural.width,
        imageHeight: natural.height,
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
        viewportSize: VIEWPORT,
      });
      onConfirm(blobToCroppedFile(blob, "perfil"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível recortar a foto.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-crop-title"
        className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-xl"
      >
        <h2 id="profile-crop-title" className="text-lg font-bold tracking-[-0.03em]">
          Escolha como a foto ficará no perfil
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Recorte quadrado (1:1) para o avatar circular.</p>

        <div
          className="relative mx-auto mt-4 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--cream)]"
          style={{ width: VIEWPORT, height: VIEWPORT, touchAction: "none" }}
          onPointerDown={(event) => {
            (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
            dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag) return;
            applyPan(drag.ox + (event.clientX - drag.x), drag.oy + (event.clientY - drag.y));
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={objectUrl}
            alt="Pré-visualização do recorte"
            draggable={false}
            onLoad={onImageLoad}
            className="absolute max-w-none select-none"
            style={{
              width: natural.width ? natural.width * zoom : "auto",
              height: natural.height ? natural.height * zoom : "auto",
              left: offset.x,
              top: offset.y,
            }}
          />
        </div>

        <label className="mt-4 block text-xs font-bold text-[var(--muted)]">
          Zoom
          <input
            type="range"
            min={minZoom}
            max={minZoom * 3}
            step={0.01}
            value={zoom}
            disabled={pending || !natural.width}
            onChange={(event) => {
              const nextZoom = Number(event.target.value);
              setZoom(nextZoom);
              applyPan(offset.x, offset.y, nextZoom);
            }}
            className="mt-2 w-full accent-[var(--lavender)]"
          />
        </label>

        {error ? (
          <p className="mt-3 text-sm font-semibold text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="focus-ring rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-55"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending || !natural.width}
            onClick={() => void confirm()}
            className="focus-ring rounded-2xl bg-[var(--graphite)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-55"
          >
            Usar recorte
          </button>
        </div>
      </div>
    </div>
  );
}
