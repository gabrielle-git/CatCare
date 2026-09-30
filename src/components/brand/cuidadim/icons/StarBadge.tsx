import { type ReactNode } from "react";

/**
 * StarBadge — sobrepõe a estrela dourada da marca no canto de um elemento.
 * Origem: assets finais/estrela.svg → final/brand/four-point-star.svg.
 * Use só em momentos de marca — não em todo ícone.
 */
export function StarBadge({
  children,
  size = 14,
  className = "",
}: {
  children: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex ${className}`}>
      {children}
      {/* eslint-disable-next-line @next/next/no-img-element -- brand particle SVG */}
      <img
        src="/brand/cuidadim/final/brand/four-point-star.svg"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="pointer-events-none absolute -right-1 -top-1 select-none"
      />
    </span>
  );
}
