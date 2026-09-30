import type { SVGProps } from "react";

/**
 * PawIcon — patinha neutra, pra ícone de UI (tab bar, listas, botões).
 *
 * Por que patinha e não a silhueta de gato: a silhueta de gato já é usada
 * na ilustração de marca "cuidado" (Visual Atualizado/Ícones/cuidado.png).
 * Repetir o mesmo símbolo em dois níveis do sistema (marca vs. UI) faz
 * nenhum dos dois "mandar" visualmente. Regra: gato = camada de marca,
 * patinha = camada de UI.
 *
 * Sem faísca/estrela de propósito — ícone de navegação precisa ser mudo
 * e repetível. Pra versão com a estrelinha (uso em ícone do app/favicon),
 * veja icons/PawmarkIcon.tsx.
 */
export function PawIcon({
  size = 20,
  color = "#2A1F2F",
  strokeWidth = 2,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <ellipse cx="6.2" cy="10" rx="2.1" ry="2.6" />
      <ellipse cx="10.2" cy="6.6" rx="2.1" ry="2.7" />
      <ellipse cx="14.6" cy="6.6" rx="2.1" ry="2.7" />
      <ellipse cx="18.4" cy="10" rx="2.1" ry="2.6" />
      <path d="M12.3 13c-3 0-5.4 2.2-5.4 4.5 0 1.9 1.6 3 3.3 2.5l1.3-.4c.5-.15 1-.15 1.5 0l1.3.4c1.7.5 3.3-.6 3.3-2.5 0-2.3-2.4-4.5-5.3-4.5z" />
    </svg>
  );
}
