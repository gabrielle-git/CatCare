/**
 * Client-side 1:1 profile crop helpers.
 * Crop is UX only — server still validates magic bytes and size after upload.
 *
 * Zoom model:
 * - minZoom = contain (entire image visible; may letterbox inside the square)
 * - coverZoom = fills the square (no empty edges)
 * - maxZoom = coverZoom * 3 (tighter face crop)
 * Initial framing uses coverZoom so the circle is filled; user can zoom out to contain.
 */

export const PROFILE_CROP_OUTPUT_MAX_EDGE = 1280;
export const PROFILE_CROP_OUTPUT_QUALITY = 0.9;
export const PROFILE_CROP_LETTERBOX_FILL = "#F5EDE6";

export type CropViewport = {
  imageWidth: number;
  imageHeight: number;
  /** Absolute scale: displayed size = natural * zoom */
  zoom: number;
  /** Pan offset: top-left of image relative to viewport */
  offsetX: number;
  offsetY: number;
  viewportSize: number;
};

/** Fit entire image inside the square (may leave empty bands). */
export function containZoom(imageWidth: number, imageHeight: number, viewportSize: number): number {
  if (imageWidth <= 0 || imageHeight <= 0 || viewportSize <= 0) return 1;
  return Math.min(viewportSize / imageWidth, viewportSize / imageHeight);
}

/** Fill the square completely (may crop edges of the source). */
export function coverZoom(imageWidth: number, imageHeight: number, viewportSize: number): number {
  if (imageWidth <= 0 || imageHeight <= 0 || viewportSize <= 0) return 1;
  return Math.max(viewportSize / imageWidth, viewportSize / imageHeight);
}

/** @deprecated use coverZoom — kept for callers during transition */
export function minCoverZoom(imageWidth: number, imageHeight: number, viewportSize: number): number {
  return coverZoom(imageWidth, imageHeight, viewportSize);
}

export function displayedImageSize(imageWidth: number, imageHeight: number, zoom: number) {
  return { width: imageWidth * zoom, height: imageHeight * zoom };
}

/**
 * Clamp pan.
 * When zoom >= cover: keep the square fully covered (no empty edges).
 * When zoom < cover (letterbox): keep the image within the viewport with optional centering slack.
 */
export function clampCropOffset(
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  viewportSize: number,
  offsetX: number,
  offsetY: number,
): { offsetX: number; offsetY: number } {
  const { width, height } = displayedImageSize(imageWidth, imageHeight, zoom);

  function axis(offset: number, size: number): number {
    if (size <= viewportSize) {
      // Image smaller than viewport on this axis — center with small drag slack.
      const centered = (viewportSize - size) / 2;
      const slack = Math.min(24, (viewportSize - size) / 2);
      return Math.min(centered + slack, Math.max(centered - slack, offset));
    }
    const min = viewportSize - size;
    return Math.min(0, Math.max(min, offset));
  }

  return {
    offsetX: axis(offsetX, width),
    offsetY: axis(offsetY, height),
  };
}

/** Center the image in the viewport at the given zoom. */
export function centeredCropOffset(
  imageWidth: number,
  imageHeight: number,
  zoom: number,
  viewportSize: number,
): { offsetX: number; offsetY: number } {
  const { width, height } = displayedImageSize(imageWidth, imageHeight, zoom);
  return clampCropOffset(
    imageWidth,
    imageHeight,
    zoom,
    viewportSize,
    (viewportSize - width) / 2,
    (viewportSize - height) / 2,
  );
}

/** Source rectangle in natural image pixels for the current viewport crop. */
export function cropSourceRect(view: CropViewport): { sx: number; sy: number; sw: number; sh: number } {
  const scale = 1 / view.zoom;
  const sw = view.viewportSize * scale;
  const sh = view.viewportSize * scale;
  const sx = -view.offsetX * scale;
  const sy = -view.offsetY * scale;
  return { sx, sy, sw, sh };
}

export async function renderSquareCropToBlob(
  image: CanvasImageSource & { width: number; height: number },
  view: CropViewport,
  options?: { mimeType?: string; quality?: number; maxEdge?: number; fillStyle?: string },
): Promise<Blob> {
  const mimeType = options?.mimeType ?? "image/jpeg";
  const quality = options?.quality ?? PROFILE_CROP_OUTPUT_QUALITY;
  const maxEdge = options?.maxEdge ?? PROFILE_CROP_OUTPUT_MAX_EDGE;
  const fillStyle = options?.fillStyle ?? PROFILE_CROP_LETTERBOX_FILL;
  const { sx, sy, sw, sh } = cropSourceRect(view);
  const edge = Math.min(maxEdge, Math.max(64, Math.round(Math.max(sw, sh))));
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar o recorte.");
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, edge, edge);

  // Map natural-image crop rect (may extend outside image when letterboxed) onto canvas.
  const srcX = Math.max(0, sx);
  const srcY = Math.max(0, sy);
  const srcRight = Math.min(view.imageWidth, sx + sw);
  const srcBottom = Math.min(view.imageHeight, sy + sh);
  const srcW = srcRight - srcX;
  const srcH = srcBottom - srcY;
  if (srcW > 0 && srcH > 0) {
    const destX = ((srcX - sx) / sw) * edge;
    const destY = ((srcY - sy) / sh) * edge;
    const destW = (srcW / sw) * edge;
    const destH = (srcH / sh) * edge;
    ctx.drawImage(image, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), mimeType, quality);
  });
  if (!blob) throw new Error("Não foi possível gerar a foto recortada.");
  return blob;
}

export function blobToCroppedFile(blob: Blob, baseName = "perfil"): File {
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${baseName}.${ext}`, { type: blob.type || "image/jpeg", lastModified: Date.now() });
}
