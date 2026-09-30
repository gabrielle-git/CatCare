/**
 * CONCEPT REFERENCE — Illustrator construction diagrams.
 * NOT PRODUCTION ASSETS.
 */

import type { SVGProps } from "react";

const PURPLE = "#2A1F2F";
const GOLD = "#CCA863";
const CREME = "#FCFAF5";
const MUTED = "#9C8CA3";

/** 24×24 master board: grid, safe area, stroke sample, caps. */
export function ConstructionBoard({ size = 280 }: { size?: number }) {
  const cell = 10;
  const origin = 20;
  const box = 24 * cell; // 240
  const safe = 2 * cell;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 280 280"
      fill="none"
      aria-label="Illustrator construction board 24 by 24"
      data-concept="reference"
    >
      <rect width="280" height="280" fill={CREME} rx="16" />
      {/* Grid */}
      {Array.from({ length: 25 }).map((_, i) => (
        <g key={i}>
          <line
            x1={origin}
            y1={origin + i * cell}
            x2={origin + box}
            y2={origin + i * cell}
            stroke={MUTED}
            strokeWidth={i === 0 || i === 24 ? 1.25 : 0.4}
            opacity={i === 0 || i === 24 ? 0.55 : 0.25}
          />
          <line
            x1={origin + i * cell}
            y1={origin}
            x2={origin + i * cell}
            y2={origin + box}
            stroke={MUTED}
            strokeWidth={i === 0 || i === 24 ? 1.25 : 0.4}
            opacity={i === 0 || i === 24 ? 0.55 : 0.25}
          />
        </g>
      ))}
      {/* Safe area inset */}
      <rect
        x={origin + safe}
        y={origin + safe}
        width={box - safe * 2}
        height={box - safe * 2}
        stroke={GOLD}
        strokeWidth={1.5}
        strokeDasharray="4 3"
        fill="none"
        opacity={0.9}
      />
      {/* Bounding box label */}
      <text x={origin} y={14} fill={PURPLE} fontSize="9" fontWeight="700" fontFamily="system-ui">
        24×24 master
      </text>
      <text
        x={origin + safe}
        y={origin + safe - 4}
        fill={GOLD}
        fontSize="8"
        fontWeight="700"
        fontFamily="system-ui"
      >
        safe ~2px
      </text>
      {/* Example organic stroke in center */}
      <path
        d={`M${origin + 6 * cell} ${origin + 14 * cell}
            C${origin + 9 * cell} ${origin + 8 * cell},
             ${origin + 15 * cell} ${origin + 8 * cell},
             ${origin + 18 * cell} ${origin + 14 * cell}`}
        stroke={PURPLE}
        strokeWidth={2 * (cell / 12)}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Round cap callout */}
      <circle cx={origin + 6 * cell} cy={origin + 14 * cell} r={cell * 0.35} fill={GOLD} />
      <circle cx={origin + 18 * cell} cy={origin + 14 * cell} r={cell * 0.35} fill={GOLD} />
      <text x={origin + 4} y={origin + box + 16} fill={PURPLE} fontSize="8" fontFamily="system-ui">
        stroke 2px · round cap/join · organic curve
      </text>
    </svg>
  );
}

/** Side-by-side correct vs wrong curve. */
export function StrokeDoDont({ width = 320 }: { width?: number }) {
  return (
    <svg
      width={width}
      height={120}
      viewBox="0 0 320 120"
      fill="none"
      aria-label="Stroke do and don't"
      data-concept="reference"
    >
      <rect width="150" height="120" rx="12" fill={CREME} stroke="#E4DEE6" />
      <text x="16" y="22" fill={PURPLE} fontSize="9" fontWeight="800" fontFamily="system-ui">
        DO · round / organic
      </text>
      <path
        d="M28 70 C48 40, 90 40, 120 70"
        stroke={PURPLE}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <rect x="170" y="0" width="150" height="120" rx="12" fill="#F4F1F5" stroke="#E4DEE6" />
      <text x="186" y="22" fill={PURPLE} fontSize="9" fontWeight="800" fontFamily="system-ui">
        {"DON'T · square / mechanical"}
      </text>
      <path
        d="M198 78 L230 42 L258 42 L290 78"
        stroke={PURPLE}
        strokeWidth="4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/** Color application chips for light/dark. */
export function ColorApplicationDemo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width={220} height={72} viewBox="0 0 220 72" fill="none" aria-hidden {...props}>
      <rect width="100" height="72" rx="10" fill={CREME} stroke="#E4DEE6" />
      <circle cx="36" cy="36" r="14" fill="none" stroke={PURPLE} strokeWidth="3" />
      <path d="M58 28 L72 36 L58 44" fill={GOLD} />
      <text x="12" y="64" fill={MUTED} fontSize="8" fontFamily="system-ui">
        Light
      </text>

      <rect x="120" width="100" height="72" rx="10" fill={PURPLE} />
      <circle cx="156" cy="36" r="14" fill="none" stroke={CREME} strokeWidth="3" />
      <path d="M178 28 L192 36 L178 44" fill={GOLD} />
      <text x="132" y="64" fill="#E4DEE6" fontSize="8" fontFamily="system-ui">
        Dark
      </text>
    </svg>
  );
}
