export type AssetStatus =
  | "APPROVED"
  | "APPROVED ASSET"
  | "APPROVED PICTOGRAM"
  | "ALTERNATE ASSET"
  | "CANDIDATE"
  | "MISSING"
  | "DEFERRED"
  | "LEGACY"
  | "AMBIGUOUS";

export type BrandAssetEntry = {
  id: string;
  label: string;
  path: string;
  status: AssetStatus;
  note?: string;
  family: "final-3c" | "visual-atualizado" | "wordmark-r1";
};

/**
 * Logo — Fase 3C APPROVED ASSET (Illustrator vector, geometria fechada).
 * Fonte: assets finais → public/brand/cuidadim/final/logo/
 */
export const CUIDADIM_LOGO_COMPARE: BrandAssetEntry[] = [
  {
    id: "final-primary",
    label: "PRIMARY · roxo + estrelas douradas",
    path: "/brand/cuidadim/final/logo/logo-primary.svg",
    status: "APPROVED ASSET",
    family: "final-3c",
  },
  {
    id: "final-reverse",
    label: "REVERSE · creme + estrelas douradas",
    path: "/brand/cuidadim/final/logo/logo-reverse.svg",
    status: "APPROVED ASSET",
    family: "final-3c",
  },
  {
    id: "final-mono-dark",
    label: "MONO DARK · roxo",
    path: "/brand/cuidadim/final/logo/logo-mono-dark.svg",
    status: "APPROVED ASSET",
    family: "final-3c",
  },
  {
    id: "final-mono-light",
    label: "MONO LIGHT · creme",
    path: "/brand/cuidadim/final/logo/logo-mono-light.svg",
    status: "APPROVED ASSET",
    family: "final-3c",
  },
  {
    id: "final-tagline-primary",
    label: "TAGLINE PRIMARY",
    path: "/brand/cuidadim/final/logo/logo-tagline-primary.svg",
    status: "APPROVED ASSET",
    family: "final-3c",
  },
  {
    id: "final-tagline-reverse",
    label: "TAGLINE REVERSE",
    path: "/brand/cuidadim/final/logo/logo-tagline-reverse.svg",
    status: "APPROVED ASSET",
    family: "final-3c",
  },
  {
    id: "final-tagline-alt-purple-stars",
    label: "EXTRA · tagline + estrelas roxas",
    path: "/brand/cuidadim/final/logo/archive/logo-tagline-primary-stars-purple.svg",
    status: "ALTERNATE ASSET",
    family: "final-3c",
    note: "ALTERNATE — não papel principal",
  },
  {
    id: "final-tagline-alt-creme-stars",
    label: "EXTRA · tagline + estrelas creme",
    path: "/brand/cuidadim/final/logo/archive/logo-tagline-reverse-stars-creme.svg",
    status: "ALTERNATE ASSET",
    family: "final-3c",
    note: "ALTERNATE — não papel principal",
  },
];

/** Shell / Home V2 light. */
export const CUIDADIM_LOGO_PREVIEW_PRIMARY = "/brand/cuidadim/final/logo/logo-primary.svg";
/** Shell / Home V2 dark. */
export const CUIDADIM_LOGO_PREVIEW_REVERSE = "/brand/cuidadim/final/logo/logo-reverse.svg";
export const CUIDADIM_LOGO_PREVIEW_REDUCED = "/brand/cuidadim/final/logo/logo-mono-dark.svg";

export const CUIDADIM_LOGO_RESOLUTION = "APPROVED ASSET" as const;
