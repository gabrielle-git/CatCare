/**
 * Fase 3C — Final visual assets (Brand Lab).
 * SOURCE OF TRUTH: /assets finais (untouched).
 * Implementation copies live under public/brand/cuidadim/final/.
 * Do not redesign, recolor, or normalize ACCEPTED SOURCE VARIATIONS.
 */

export type FinalAssetStatus =
  | "APPROVED ASSET"
  | "APPROVED BRAND ASSET"
  | "APPROVED MOTIF ASSET"
  | "APPROVED PICTOGRAM"
  | "ALTERNATE ASSET"
  | "MISSING FROM FINAL FOLDER"
  | "DEFERRED — NO FINAL ASSET PROVIDED";

export type FinalLogoRole =
  | "PRIMARY"
  | "REVERSE"
  | "MONO DARK"
  | "MONO LIGHT"
  | "TAGLINE PRIMARY"
  | "TAGLINE REVERSE"
  | "EXTRA / ALTERNATE";

export type FinalNavId = "agora" | "pets" | "cuidados" | "memorias" | "assistente";

const BASE = "/brand/cuidadim/final";

/** Byte-identical copies from `assets finais`. */
export const FINAL_LOGOS: {
  role: FinalLogoRole;
  path: string;
  sourceFile: string;
  status: FinalAssetStatus;
  note?: string;
}[] = [
  {
    role: "PRIMARY",
    path: `${BASE}/logo/logo-primary.svg`,
    sourceFile: "logo roxo escuro (s texto grafite) e estrelas douradas.svg",
    status: "APPROVED ASSET",
  },
  {
    role: "REVERSE",
    path: `${BASE}/logo/logo-reverse.svg`,
    sourceFile: "logo creme (s texto) c estrelas douradas.svg",
    status: "APPROVED ASSET",
  },
  {
    role: "MONO DARK",
    path: `${BASE}/logo/logo-mono-dark.svg`,
    sourceFile: "logo roxo escuro (s texto grafite) e estrelas roxas.svg",
    status: "APPROVED ASSET",
  },
  {
    role: "MONO LIGHT",
    path: `${BASE}/logo/logo-mono-light.svg`,
    sourceFile: "logo creme (s texto) c estrelas creme.svg",
    status: "APPROVED ASSET",
  },
  {
    role: "TAGLINE PRIMARY",
    path: `${BASE}/logo/logo-tagline-primary.svg`,
    sourceFile: "logo roxo escuro (c texto grafite) e estrelas douradas.svg",
    status: "APPROVED ASSET",
  },
  {
    role: "TAGLINE REVERSE",
    path: `${BASE}/logo/logo-tagline-reverse.svg`,
    sourceFile: "logo creme (c texto) e estrelas douradas.svg",
    status: "APPROVED ASSET",
  },
  {
    role: "EXTRA / ALTERNATE",
    path: `${BASE}/logo/archive/logo-tagline-primary-stars-purple.svg`,
    sourceFile: "logo roxo escuro (c texto grafite) e estrelas roxas.svg",
    status: "ALTERNATE ASSET",
    note: "Tagline + estrelas roxas — não papel principal",
  },
  {
    role: "EXTRA / ALTERNATE",
    path: `${BASE}/logo/archive/logo-tagline-reverse-stars-creme.svg`,
    sourceFile: "logo creme (c texto) e estrelas creme.svg",
    status: "ALTERNATE ASSET",
    note: "Tagline + estrelas creme — não papel principal",
  },
];

export const FINAL_NAV_ICONS: {
  id: FinalNavId;
  label: string;
  onLight?: string;
  onDark?: string;
  /** Single structural file (theme via CSS color when impl used). */
  single?: string;
  /** Implementation copy only — original untouched. */
  implCurrentColor?: string;
  status: FinalAssetStatus;
  notes: string;
  acceptedVariation?: string;
}[] = [
  {
    id: "agora",
    label: "Agora",
    onLight: `${BASE}/icons/icon-agora-on-light.svg`,
    onDark: `${BASE}/icons/icon-agora-on-dark.svg`,
    status: "APPROVED ASSET",
    notes: "Home/Agora final · light/dark entregues",
  },
  {
    id: "pets",
    label: "Pets",
    single: `${BASE}/icons/icon-pets.svg`,
    implCurrentColor: `${BASE}/icons/impl/icon-pets-on-dark.svg`,
    status: "APPROVED ASSET",
    notes:
      "Pata SEM estrela. SOURCE = #2A1F2F only. Dark Home uses impl copy (#2A1F2F→#FCFAF5). Original + assets finais intact.",
  },
  {
    id: "cuidados",
    label: "Cuidados",
    onLight: `${BASE}/icons/icon-cuidados-on-light.svg`,
    onDark: `${BASE}/icons/icon-cuidados-on-dark.svg`,
    status: "APPROVED ASSET",
    notes: "Saúde/coração final · light/dark com estrela gold",
    acceptedVariation:
      "ACCEPTED SOURCE VARIATION · on-light star #CDA963 (not normalized to #CCA863)",
  },
  {
    id: "memorias",
    label: "Memórias",
    single: `${BASE}/icons/icon-memorias.svg`,
    status: "APPROVED ASSET",
    notes:
      "Navigation only (≠ pictogram). Single multi-color file. No currentColor transform (gold+fills). Used as-is Light/Dark.",
  },
  {
    id: "assistente",
    label: "Assistente",
    onLight: `${BASE}/icons/icon-assistente-on-light.svg`,
    onDark: `${BASE}/icons/icon-assistente-on-dark.svg`,
    status: "APPROVED ASSET",
    notes: "Assistente final · light/dark · mono-light archived as extra",
  },
];

export const FINAL_BRAND = {
  pawmark: {
    path: `${BASE}/brand/pawmark.svg`,
    sourceFile: "icon pata c estrela em cima.svg",
    status: "APPROVED BRAND ASSET" as FinalAssetStatus,
    notes: "Pawmark / Brand Mark / App Icon. PWA/favicon NOT wired yet.",
  },
  pawStarCenter: {
    path: `${BASE}/brand/archive/paw-star-center.svg`,
    sourceFile: "icon pata com estrela no meio.svg",
    status: "ALTERNATE ASSET" as FinalAssetStatus,
    notes: "ALTERNATE — estrela no centro. Não é principal.",
  },
  assistenteMonoLight: {
    path: `${BASE}/icons/icon-assistente-mono-light.svg`,
    status: "ALTERNATE ASSET" as FinalAssetStatus,
    notes: "EXTRA · assistente totalmente claro",
  },
  cuidadosMonoLight: {
    path: `${BASE}/icons/icon-cuidados-mono-light.svg`,
    status: "ALTERNATE ASSET" as FinalAssetStatus,
  },
  cuidadosMonoDark: {
    path: `${BASE}/icons/icon-cuidados-mono-dark.svg`,
    status: "ALTERNATE ASSET" as FinalAssetStatus,
  },
} as const;

/**
 * Estrela 4 pontas — 3C.1 APPROVED MOTIF ASSET.
 * SOURCE: assets finais/estrela.svg → final/brand/four-point-star.svg
 * Selected/UI micro-stars keep FourPointStar (comportamento aprovado).
 */
export const FINAL_ESTRELA = {
  status: "APPROVED MOTIF ASSET" as FinalAssetStatus,
  path: `${BASE}/brand/four-point-star.svg`,
  sourceFile: "estrela.svg",
  notes:
    "APPROVED MOTIF ASSET · assets finais/estrela.svg. FourPointStar React permanece nos selected states aprovados.",
};

/**
 * Pictograms 3C.1 — per-asset status (≠ navigation icons).
 */
export const FINAL_PICTOGRAMS = {
  care: {
    id: "cuidado-pet",
    status: "DEFERRED — NO FINAL ASSET PROVIDED" as FinalAssetStatus,
    path: null as string | null,
    notes:
      "DEFERRED — NO FINAL ASSET PROVIDED. Não bloqueia Visual Freeze V1. Prior candidate não promovido.",
  },
  couple: {
    id: "vida-a-dois",
    status: "APPROVED PICTOGRAM" as FinalAssetStatus,
    path: `${BASE}/pictograms/pictogram-couple.svg`,
    sourceFile: "icon sempre juntos.svg",
    notes: "APPROVED PICTOGRAM · Sempre Juntos / Vida a Dois. Multicolor · sem currentColor.",
  },
  memories: {
    id: "memorias",
    status: "DEFERRED — NO FINAL ASSET PROVIDED" as FinalAssetStatus,
    path: null as string | null,
    notes:
      "DEFERRED — NO FINAL ASSET PROVIDED · illustration. Não bloqueia Freeze V1. Prior candidate não promovido. `icon memórias.svg` na pasta = nav-scale ≠ pictogram.",
  },
} as const;

export const FINAL_PICTOGRAMS_NOTE = {
  status: "DEFERRED — NO FINAL ASSET PROVIDED" as FinalAssetStatus,
  expected: ["Cuidado Pet", "Sempre Juntos / Vida a Dois", "Memórias (pictogram)"] as const,
  notes:
    "Freeze V1: Sempre Juntos = APPROVED PICTOGRAM. Cuidado Pet + Memórias illustration = DEFERRED — NO FINAL ASSET PROVIDED.",
};

/** Visual Freeze V1 — Brand Lab registration (Fase 3D). */
export const VISUAL_FREEZE_V1 = {
  id: "VISUAL FREEZE V1",
  phase: "3D",
  frozen: [
    "palette v2",
    "Fraunces + DM Sans",
    "logo system (PRIMARY / REVERSE / MONO / TAGLINE)",
    "navigation Wave 1 (Agora · Pets · Cuidados · Memórias nav · Assistente)",
    "Pawmark",
    "four-point star (Cozy Celestial motif)",
    "shell direction (Desktop compact rail · Mobile dock 4)",
    "Home V2 Light / Dark",
    "mobile navigation direction (Registrar + Mais separados)",
    "Pet selected B + Cozy Celestial selected behavior",
    "primitives já aprovados",
    "Sempre Juntos / Vida a Dois pictogram",
  ],
  notFrozen: [
    "Wave 2 / Wave 3 icons",
    "Cuidado Pet pictogram",
    "Memórias illustration",
    "telas reais ainda não migradas",
    "aplicação do novo visual no produto real",
  ],
} as const;

export function finalLogoPath(
  theme: "light" | "dark",
  opts?: { tagline?: boolean; mono?: boolean }
): string {
  if (opts?.tagline) {
    return theme === "dark"
      ? `${BASE}/logo/logo-tagline-reverse.svg`
      : `${BASE}/logo/logo-tagline-primary.svg`;
  }
  if (opts?.mono) {
    return theme === "dark"
      ? `${BASE}/logo/logo-mono-light.svg`
      : `${BASE}/logo/logo-mono-dark.svg`;
  }
  return theme === "dark"
    ? `${BASE}/logo/logo-reverse.svg`
    : `${BASE}/logo/logo-primary.svg`;
}

export function finalNavSrc(
  id: FinalNavId,
  theme: "light" | "dark"
): { src: string; color?: string } {
  const entry = FINAL_NAV_ICONS.find((n) => n.id === id)!;
  if (id === "pets") {
    if (theme === "dark" && entry.implCurrentColor) {
      return { src: entry.implCurrentColor };
    }
    return { src: entry.single! };
  }
  if (entry.onLight && entry.onDark) {
    return { src: theme === "dark" ? entry.onDark : entry.onLight };
  }
  return { src: entry.single! };
}
