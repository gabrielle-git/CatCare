import type { AssetStatus } from "@/components/brand/cuidadim/logo-assets";

export type PictogramEntry = {
  id: string;
  label: string;
  path: string;
  rasterPath?: string;
  status: AssetStatus;
  note?: string;
};

/**
 * Pictograms — storytelling / empty states / module highlights.
 * NOT for bottom navigation.
 * 3D Freeze V1: Sempre Juntos APPROVED PICTOGRAM; Cuidado Pet + Memórias = DEFERRED.
 */
export const CUIDADIM_PICTOGRAMS: PictogramEntry[] = [
  {
    id: "cuidado-pet",
    label: "Cuidado Pet",
    path: "/brand/cuidadim/pictograms/pictogram-care.svg",
    status: "DEFERRED",
    note: "DEFERRED — NO FINAL ASSET PROVIDED · não bloqueia Freeze V1 · prior não promovido",
  },
  {
    id: "vida-a-dois",
    label: "Vida a Dois / Sempre Juntos",
    path: "/brand/cuidadim/final/pictograms/pictogram-couple.svg",
    status: "APPROVED PICTOGRAM",
    note: "APPROVED PICTOGRAM · assets finais/icon sempre juntos.svg · multicolor",
  },
  {
    id: "memorias",
    label: "Memórias (pictogram)",
    path: "/brand/cuidadim/pictograms/pictogram-memories.svg",
    status: "DEFERRED",
    note: "DEFERRED — NO FINAL ASSET PROVIDED · illustration · prior não promovido",
  },
  {
    id: "financas",
    label: "Finanças",
    path: "/brand/cuidadim/pictograms/pictogram-finances.svg",
    status: "MISSING",
  },
  {
    id: "rotina",
    label: "Rotina",
    path: "/brand/cuidadim/pictograms/pictogram-routine.svg",
    status: "MISSING",
  },
  {
    id: "viagens",
    label: "Viagens",
    path: "/brand/cuidadim/pictograms/pictogram-travel.svg",
    status: "MISSING",
  },
];
