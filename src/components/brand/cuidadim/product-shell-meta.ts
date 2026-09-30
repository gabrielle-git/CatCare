/**
 * Product Shell 2C.3 — Desktop A + Mobile A APPROVED; Desktop B archived.
 */

export const SHELL_2B_NOTES = {
  lightOnly: "Light e Dark reais no Brand Lab (Fase 2C). App real ainda sem Dark.",
  logo: "APPROVED ASSET · final/logo (Brand Lab). Produto real ainda não wired.",
  naming: "Casa / Finanças · NAMING TO RESOLVE",
  noHome: "Sem Home V2 — área de conteúdo permanece placeholder.",
  adaptive:
    "Desktop A (rail) = APPROVED DIRECTION. Mobile A = APPROVED DIRECTION. Desktop B (header) = histórico / exploração.",
  mobile: "Mobile A. Assistente só no topo (utility). Não duplicar em Mais.",
  desktopA:
    "Rail: util Assistente → nav (Agora/Pets/Cuidados/Memórias/Mais) → Registrar → Conta (perfil/preferências). Tema Light/Dark não é item de nav.",
  iconsCandidate:
    "Wave 1 = APPROVED ASSET no Brand Lab. Shell real ainda usa candidatos/legado até implementação.",
  iconsMissing: ["Finanças (ícone dedicado)", "Rotina", "Viagens"],
} as const;

export type RegisterTreatment = {
  id: "register-soft" | "register-line";
  label: string;
  note: string;
};

export const REGISTER_TREATMENTS: RegisterTreatment[] = [
  {
    id: "register-soft",
    label: "Soft",
    note: "Massa baixa, integrado ao shell — não pílula SaaS branca.",
  },
  {
    id: "register-line",
    label: "Line + gold mote",
    note: "Outline estrutural + estrela gold — SPECIAL CASE da ação primária.",
  },
];

/** Star path before 2C.3 gap tweak — QA only, not product. */
export const PAWMARK_STAR_BEFORE =
  "M21.2 2.4c.25 1.9.5 2.2 2.2 2.5-1.7.3-1.95.6-2.2 2.5-.25-1.9-.5-2.2-2.2-2.5 1.7-.3 1.95-.6 2.2-2.5z";
