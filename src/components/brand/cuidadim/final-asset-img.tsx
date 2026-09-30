"use client";

import {
  finalLogoPath,
  finalNavSrc,
  type FinalNavId,
} from "@/components/brand/cuidadim/final-assets";

type LabTheme = "light" | "dark";

/** Final logo wordmark as delivered — no text placeholder. */
export function FinalLogoImg({
  theme,
  compact,
  tagline,
  className,
  alt = "Cuidadim",
}: {
  theme: LabTheme;
  compact?: boolean;
  tagline?: boolean;
  className?: string;
  alt?: string;
}) {
  const src = finalLogoPath(theme, { tagline });
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={
        className ??
        (compact ? "cd-final-logo cd-final-logo-compact" : "cd-final-logo")
      }
      draggable={false}
    />
  );
}

/** Final navigation / utility glyph from approved asset set. */
export function FinalNavImg({
  id,
  theme,
  size = 20,
  className,
  title,
}: {
  id: FinalNavId;
  theme: LabTheme;
  size?: number;
  className?: string;
  title?: string;
}) {
  const { src, color } = finalNavSrc(id, theme);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      title={title}
      width={size}
      height={size}
      className={className ?? "cd-final-nav-icon"}
      style={color ? { color, width: size, height: size } : { width: size, height: size }}
      draggable={false}
    />
  );
}
