/**
 * Client-side 1:1 profile crop helpers.
 * Crop is UX only — server still validates magic bytes and size after upload.
 */

export const PROFILE_CROP_OUTPUT_MAX_EDGE = 1280;
export const PROFILE_CROP_OUTPUT_QUALITY = 0.9;

export type CropViewport = {
  /** Image natural width */
  imageWidth: number;
  imageHeight: number;
  /** Zoom factor (>= 1 means zoomed in relative to cover-fit) */
  zoom: number;
  /** Pan offset in CSS pixels of the viewport (square side = viewportSize) */
  offsetX: number;
  offsetY: number;
  viewportSize: number;
};

/** Minimum zoom so the square viewport is fully covered by the image. */
export function minCoverZoom(imageWidth: number, imageHeight: number, viewportSize: number): number {
  if (imageWidth <= 0 || imageHeight <= 0 || viewportSize <= 0) return 1;
  return Math.max(viewportSize / imageWidth, viewportSize / imageHeight);
}

/** Drawn image size inside the viewport at the current zoom. */
export function displayedImageSize(imageWidth: number, imageHeight: number, zoom: number) {
  return { width: imageWidth * zoom, height: imageHeight * zoom };
}

/**
 * Clamp pan so the square viewport never shows empty edges.
 * Offsets are top-left of the image relative to the viewport.
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
  const minX = viewportSize - width;
  const minY = viewportSize - height;
  return {
    offsetX: Math.min(0, Math.max(minX, offsetX)),
    offsetY: Math.min(0, Math.max(minY, offsetY)),
  };
}

/** Source rectangle in natural image pixels for the current viewport crop. */
export function cropSourceRect(view: CropViewport): { sx: number; sy: number; sw: number; sh: number } {
  const scale = 1 / view.zoom;
  const sw = view.viewportSize * scale;
  const sh = view.viewportSize * scale;
  const sx = -view.offsetX * scale;
  const sy = -view.offsetY * scale;
  return {
    sx: Math.max(0, Math.min(view.imageWidth - sw, sx)),
    sy: Math.max(0, Math.min(view.imageHeight - sh, sy)),
    sw: Math.min(sw, view.imageWidth),
    sh: Math.min(sh, view.imageHeight),
  };
}

export async function renderSquareCropToBlob(
  image: CanvasImageSource & { width: number; height: number },
  view: CropViewport,
  options?: { mimeType?: string; quality?: number; maxEdge?: number },
): Promise<Blob> {
  const mimeType = options?.mimeType ?? "image/jpeg";
  const quality = options?.quality ?? PROFILE_CROP_OUTPUT_QUALITY;
  const maxEdge = options?.maxEdge ?? PROFILE_CROP_OUTPUT_MAX_EDGE;
  const { sx, sy, sw, sh } = cropSourceRect(view);
  const edge = Math.min(maxEdge, Math.round(Math.max(sw, sh)));
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar o recorte.");
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, edge, edge);
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
