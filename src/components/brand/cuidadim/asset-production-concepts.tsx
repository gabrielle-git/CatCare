/**
 * CONCEPT REFERENCE — NOT PRODUCTION ASSET
 * Diagramas esquemáticos para o usuário desenhar no Illustrator.
 * Nunca importar estes mocks como ícones finais do produto.
 */

import type { SVGProps } from "react";

type ConceptProps = SVGProps<SVGSVGElement> & {
  size?: number;
  structure?: string;
  star?: string;
};

const CONCEPT_ATTR = {
  "data-concept": "reference",
  "data-production": "false",
} as const;

/** Casa Cuidadim — telhado suave, porta em arco, estrela gold na porta. */
export function ConceptAgora({
  size = 24,
  structure = "#2A1F2F",
  star = "#CCA863",
  ...props
}: ConceptProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      {...CONCEPT_ATTR}
      {...props}
    >
      {/* Roof + walls as one organic house silhouette */}
      <path
        d="M4.5 11.2 L12 4.8 L19.5 11.2 V19.2 C19.5 19.9 19 20.4 18.3 20.4 H5.7 C5 20.4 4.5 19.9 4.5 19.2 Z"
        stroke={structure}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arched door ~5.5px wide */}
      <path
        d="M9.25 20.4 V15.1 C9.25 13.55 10.45 12.4 12 12.4 C13.55 12.4 14.75 13.55 14.75 15.1 V20.4"
        stroke={structure}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Official 4-point star inside door — upper half, ~2.8px */}
      <path
        d="M12 13.15c.12.85.28 1.45.7 2 .42.55 1.1.78 2.05.9-.95.12-1.63.35-2.05.9-.42.55-.58 1.15-.7 2-.12-.85-.28-1.45-.7-2-.42-.55-1.1-.78-2.05-.9.95-.12 1.63-.35 2.05-.9.42-.55.58-1.15.7-2z"
        fill={star}
        stroke="none"
      />
    </svg>
  );
}

/** Coração orgânico + pulse simples (máx. 3 mudanças de direção). Sem estrela. */
export function ConceptCuidados({
  size = 24,
  structure = "#2A1F2F",
  ...props
}: ConceptProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      {...CONCEPT_ATTR}
      {...props}
    >
      <path
        d="M12 19.2 C12 19.2 4.8 14.2 4.8 9.4 C4.8 7.1 6.5 5.5 8.6 5.5 C10.1 5.5 11.2 6.3 12 7.5 C12.8 6.3 13.9 5.5 15.4 5.5 C17.5 5.5 19.2 7.1 19.2 9.4 C19.2 14.2 12 19.2 12 19.2 Z"
        stroke={structure}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pulse: left → peak → dip → right (3 direction changes) */}
      <path
        d="M7.8 11.2 H10.2 L11.3 8.8 L13.1 13.4 L14.2 11.2 H16.4"
        stroke={structure}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Assistente A — balão orgânico + swoosh, monocromático. */
export function ConceptAssistenteA({
  size = 24,
  structure = "#2A1F2F",
  ...props
}: ConceptProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      {...CONCEPT_ATTR}
      {...props}
    >
      <path
        d="M5.2 6.4 C5.2 5.3 6.1 4.4 7.2 4.4 H16.8 C17.9 4.4 18.8 5.3 18.8 6.4 V13.2 C18.8 14.3 17.9 15.2 16.8 15.2 H11.2 L7.6 18.4 V15.2 H7.2 C6.1 15.2 5.2 14.3 5.2 13.2 Z"
        stroke={structure}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.4 10.2 C9.6 9.1 11.2 8.6 12.6 9 C14 9.4 15.2 10.4 15.6 11.6"
        stroke={structure}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Assistente B — balão + swoosh + estrela gold acima da curva (preferência a testar). */
export function ConceptAssistenteB({
  size = 24,
  structure = "#2A1F2F",
  star = "#CCA863",
  ...props
}: ConceptProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      {...CONCEPT_ATTR}
      {...props}
    >
      <path
        d="M5.2 6.4 C5.2 5.3 6.1 4.4 7.2 4.4 H16.8 C17.9 4.4 18.8 5.3 18.8 6.4 V13.2 C18.8 14.3 17.9 15.2 16.8 15.2 H11.2 L7.6 18.4 V15.2 H7.2 C6.1 15.2 5.2 14.3 5.2 13.2 Z"
        stroke={structure}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Star above curve — visible gap, not a face */}
      <path
        d="M12 6.85c.14.95.32 1.6.78 2.2.46.6 1.2.86 2.25 1-.95.14-1.63.4-2.09.95-.46.55-.64 1.2-.78 2.15-.14-.95-.32-1.6-.78-2.15-.46-.55-1.14-.81-2.09-.95 1.05-.14 1.79-.4 2.25-1 .46-.6.64-1.25.78-2.2z"
        fill={star}
        stroke="none"
      />
      <path
        d="M8.6 12.35 C9.8 11.35 11.3 10.95 12.6 11.3 C13.9 11.65 15 12.55 15.5 13.55"
        stroke={structure}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
