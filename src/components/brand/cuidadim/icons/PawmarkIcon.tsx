import type { SVGProps } from "react";

/**
 * PawmarkIcon — a patinha com o mesmo gesto do logo (a curva que afina
 * terminando numa faísca dourada, igual ao "m" de cuidadim).
 *
 * ONDE USAR: ícone do app (home screen), favicon, splash screen,
 * avatar do app em notificação. É a "vitrine" da marca.
 *
 * ONDE NÃO USAR: tab bar, listas, qualquer ícone repetido na UI comum.
 * Nesses lugares o dourado dela compete com o dourado que já significa
 * "item ativo" — some a distinção. Pra esses lugares use PawIcon.tsx.
 */
export function PawmarkIcon({
  size = 40,
  strokeColor = "#2A1F2F",
  starColor = "#CCA863",
  strokeWidth = 2,
  ...props
}: SVGProps<SVGSVGElement> & {
  size?: number;
  strokeColor?: string;
  starColor?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="cuidadim"
      {...props}
    >
      <ellipse cx="6.2" cy="11" rx="2" ry="2.5" />
      <ellipse cx="10.1" cy="7.8" rx="2" ry="2.6" />
      <ellipse cx="14.3" cy="7.8" rx="2" ry="2.6" />
      <path d="M12.2 14c-2.9 0-5.2 2.1-5.2 4.3 0 1.8 1.5 2.9 3.2 2.4l1.2-.4c.5-.15 1-.15 1.5 0l1.2.4c1.7.5 3.2-.6 3.2-2.4 0-2.2-2.3-4.3-5.1-4.3z" />
      <path d="M17.3 11.4c1.6-.5 2.9-1.9 3.4-3.6" strokeWidth={strokeWidth * 0.85} />
      {/* Star sits slightly above/right of the trail tip — small visual gap, still led by the stroke */}
      <path
        d="M21.45 1.45c.25 1.9.5 2.2 2.2 2.5-1.7.3-1.95.6-2.2 2.5-.25-1.9-.5-2.2-2.2-2.5 1.7-.3 1.95-.6 2.2-2.5z"
        fill={starColor}
        stroke={starColor}
        strokeWidth={strokeWidth * 0.3}
      />
    </svg>
  );
}
