import type { AssetStatus } from "@/components/brand/cuidadim/logo-assets";

/** Static icon files under public/brand/cuidadim/icons */
export const CUIDADIM_STATIC_ICONS: {
  id: string;
  label: string;
  path: string;
  status: AssetStatus;
  note?: string;
}[] = [
  {
    id: "estrela",
    label: "Estrela (marca)",
    path: "/brand/cuidadim/final/brand/four-point-star.svg",
    status: "APPROVED ASSET",
    note: "APPROVED MOTIF ASSET · assets finais/estrela.svg → four-point-star.svg",
  },
];

/**
 * Nav / UI candidates from cuidadim-icons-v2 React package.
 * Compared against Lucide in Brand Lab only — not wired to real BottomNav.
 */
export const CUIDADIM_ICON_CANDIDATES = [
  { id: "home", label: "Início", component: "IconHome" },
  { id: "pets", label: "Pets", component: "IconPets" },
  { id: "agenda", label: "Agenda", component: "IconAgenda" },
  { id: "memorias", label: "Memórias", component: "IconMemorias" },
  { id: "despesas", label: "Despesas", component: "IconDespesas" },
] as const;
