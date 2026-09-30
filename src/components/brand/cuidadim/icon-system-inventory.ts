/**
 * Fase 3C — Inventário de iconografia (Brand Lab).
 * Wave 1 = APPROVED ASSET (assets finais). Wave 2/3 bloqueadas.
 * Brand ≠ icon family. Selected/Especial ≠ glifos novos.
 */

export type IconRole =
  | "brand-mark"
  | "primary-nav"
  | "secondary-module"
  | "care-health"
  | "action"
  | "status-feedback"
  | "ui-state"
  | "pictogram";

export type IconInventoryStatus =
  | "APPROVED"
  | "APPROVED ASSET"
  | "APPROVED BRAND ASSET"
  | "APPROVED MOTIF ASSET"
  | "APPROVED MOTIF"
  | "APPROVED BEHAVIOR"
  | "CANDIDATE"
  | "TO DESIGN"
  | "LEGACY"
  | "MISSING"
  | "PENDING ASSET"
  | "NEUTRAL UTILITY"
  | "ALTERNATE ASSET"
  | "MISSING FROM FINAL FOLDER"
  | "DEFERRED — NO FINAL ASSET PROVIDED";

export type IconNeed =
  | "custom-cuidadim"
  | "neutral-utility"
  | "deferred"
  | "brand-asset"
  | "ui-motif";

/** null = fora das waves de desenho de ícones (brand / states). */
export type IconWave = 1 | 2 | 3 | null;

export type IconInventoryEntry = {
  id: string;
  name: string;
  role: IconRole;
  where: string;
  frequency: "high" | "med" | "low";
  importance: "essential" | "important" | "nice";
  currentIcon?: string;
  currentOrigin?: "lucide" | "custom" | "pictogram" | "none";
  status: IconInventoryStatus;
  need: IconNeed;
  wave: IconWave;
  notes?: string;
};

/** Únicos glifos custom da Wave 1 (3B.1). */
export const WAVE_1_CUSTOM_IDS = [
  "nav-agora",
  "nav-pets",
  "nav-cuidados",
  "nav-memorias",
  "mod-assistente",
] as const;

/**
 * Briefing para futuros navigation icons — documentado, não desenhado.
 */
export const NAV_ICON_BRIEFING = {
  master: "24 × 24 preferencial",
  opticalSizes: "Boa leitura em 20 / 24 / 32",
  color: "Monocromático · currentColor · Light/Dark via currentColor",
  geometry:
    "Curvas suaves · caps/joins arredondados · espessura consistente entre os cinco",
  constraints:
    "Sem estrela embutida por padrão · sem fills complexos no navigation glyph · selected state pela UI, não pelo SVG",
  identity: "A identidade deve vir da geometria.",
} as const;

export const ICON_INVENTORY: IconInventoryEntry[] = [
  /* —— A. Brand marks (fora da Wave de ícones) —— */
  {
    id: "pawmark",
    name: "Pawmark (pata + estrela acima)",
    role: "brand-mark",
    where: "Brand Lab · futuro app icon / favicon (ainda NÃO no produto)",
    frequency: "med",
    importance: "essential",
    currentIcon: "final/brand/pawmark.svg",
    currentOrigin: "custom",
    status: "APPROVED BRAND ASSET",
    need: "brand-asset",
    wave: null,
    notes:
      "APPROVED BRAND ASSET · fonte assets finais. ≠ Pets nav. PWA/favicon ainda não substituídos.",
  },
  {
    id: "logo-final",
    name: "Logo final oficial",
    role: "brand-mark",
    where: "Brand Lab Home / Identity · produto futuro",
    frequency: "high",
    importance: "essential",
    currentIcon: "final/logo/*",
    currentOrigin: "custom",
    status: "APPROVED ASSET",
    need: "brand-asset",
    wave: null,
    notes: "APPROVED ASSET · Illustrator vector · geometria fechada. PRIMARY/REVERSE/MONO/TAGLINE.",
  },
  {
    id: "estrela-4-pontas",
    name: "Estrela 4 pontas (Cozy Celestial)",
    role: "brand-mark",
    where: "Selected · Especial/marco · feedback · Line+gold",
    frequency: "high",
    importance: "essential",
    currentIcon: "final/brand/four-point-star.svg",
    currentOrigin: "custom",
    status: "APPROVED MOTIF ASSET",
    need: "ui-motif",
    wave: null,
    notes:
      "APPROVED MOTIF ASSET · assets finais/estrela.svg. FourPointStar React só nos selected states aprovados.",
  },

  /* —— B. Primary navigation — Wave 1 APPROVED ASSET —— */
  {
    id: "nav-agora",
    name: "Agora",
    role: "primary-nav",
    where: "Home V2 dock/rail",
    frequency: "high",
    importance: "essential",
    currentIcon: "final/icons/icon-agora-on-light|dark.svg",
    currentOrigin: "custom",
    status: "APPROVED ASSET",
    need: "custom-cuidadim",
    wave: 1,
    notes: "APPROVED ASSET · assets finais. Light/Dark entregues.",
  },
  {
    id: "nav-pets",
    name: "Pets",
    role: "primary-nav",
    where: "Dock/rail Home V2",
    frequency: "high",
    importance: "essential",
    currentIcon: "final/icons/icon-pets.svg (+ impl on-dark)",
    currentOrigin: "custom",
    status: "APPROVED ASSET",
    need: "custom-cuidadim",
    wave: 1,
    notes:
      "APPROVED ASSET · pata SEM estrela. Dark = cópia impl (#FCFAF5). ≠ Pawmark.",
  },
  {
    id: "nav-cuidados",
    name: "Cuidados",
    role: "primary-nav",
    where: "Home V2 / shell lab",
    frequency: "high",
    importance: "essential",
    currentIcon: "final/icons/icon-cuidados-on-light|dark.svg",
    currentOrigin: "custom",
    status: "APPROVED ASSET",
    need: "custom-cuidadim",
    wave: 1,
    notes:
      "APPROVED ASSET. ACCEPTED SOURCE VARIATION · on-light star #CDA963 (não normalizado).",
  },
  {
    id: "nav-memorias",
    name: "Memórias",
    role: "primary-nav",
    where: "Home V2 dock/rail",
    frequency: "high",
    importance: "essential",
    currentIcon: "final/icons/icon-memorias.svg",
    currentOrigin: "custom",
    status: "APPROVED ASSET",
    need: "custom-cuidadim",
    wave: 1,
    notes:
      "APPROVED ASSET · NAV only (≠ pictogram Memórias). Single multi-color · sem transform.",
  },

  /* —— C. Secondary / modules —— */
  {
    id: "mod-assistente",
    name: "Assistente",
    role: "secondary-module",
    where: "Utility shell · Home V2 header/rail",
    frequency: "high",
    importance: "essential",
    currentIcon: "final/icons/icon-assistente-on-light|dark.svg",
    currentOrigin: "custom",
    status: "APPROVED ASSET",
    need: "custom-cuidadim",
    wave: 1,
    notes: "APPROVED ASSET · Wave 1. Light/Dark entregues.",
  },
  {
    id: "mod-casa-financas",
    name: "Casa / Finanças",
    role: "secondary-module",
    where: "Mais overflow · Também nesta casa · /expenses+/shopping",
    frequency: "med",
    importance: "important",
    currentIcon: "Wallet / ReceiptText (temporário)",
    currentOrigin: "lucide",
    status: "MISSING",
    need: "custom-cuidadim",
    wave: 2,
    notes: "NAMING TO RESOLVE. Ícone dedicado Finanças MISSING.",
  },
  {
    id: "mod-conta-familia",
    name: "Conta e Família",
    role: "secondary-module",
    where: "Mais · settings · members",
    frequency: "med",
    importance: "important",
    currentIcon: "Users / Settings",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
  },
  {
    id: "mod-agenda",
    name: "Agenda",
    role: "secondary-module",
    where: "/agenda · contextual Cuidados · bottom-nav legado",
    frequency: "high",
    importance: "important",
    currentIcon: "CalendarDays",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
  },
  {
    id: "mod-rotina",
    name: "Rotinas",
    role: "secondary-module",
    where: "/routines · more-menu · Home V2 (MISSING placeholder)",
    frequency: "med",
    importance: "important",
    currentIcon: "Repeat2 (app)",
    currentOrigin: "lucide",
    status: "MISSING",
    need: "custom-cuidadim",
    wave: 2,
    notes: "Ícone dedicado Cuidadim MISSING. Pictograma Rotina MISSING.",
  },
  {
    id: "mod-historico",
    name: "Histórico",
    role: "secondary-module",
    where: "/historico · pet historico · more-menu",
    frequency: "med",
    importance: "important",
    currentIcon: "History",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
  },
  {
    id: "mod-neonatal",
    name: "Neonatal",
    role: "secondary-module",
    where: "/neonatal · more-menu · contextual",
    frequency: "med",
    importance: "important",
    currentIcon: "App: HeartPulse · Lab: Baby",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
    notes: "Mismatch HeartPulse vs Baby.",
  },
  {
    id: "mod-plano-saude",
    name: "Plano de saúde",
    role: "secondary-module",
    where: "/health-plan · more-menu · contextual",
    frequency: "med",
    importance: "important",
    currentIcon: "HeartHandshake / Shield / HandCoins",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
    notes: "Três metáforas Lucide diferentes — sem sistema.",
  },
  {
    id: "mod-alimentacao",
    name: "Alimentação",
    role: "secondary-module",
    where: "Cuidados · register · Home V2",
    frequency: "med",
    importance: "important",
    currentIcon: "UtensilsCrossed / Milk (neonatal)",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
  },
  {
    id: "mod-gastos",
    name: "Gastos",
    role: "secondary-module",
    where: "/expenses · more-menu",
    frequency: "med",
    importance: "important",
    currentIcon: "ReceiptText / Wallet",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
    notes: "Pode fundir visualmente com Casa/Finanças após naming.",
  },
  {
    id: "mod-compras",
    name: "Compras",
    role: "secondary-module",
    where: "/shopping · more-menu",
    frequency: "med",
    importance: "nice",
    currentIcon: "ShoppingBasket",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
  },
  {
    id: "mod-viagens",
    name: "Viagens",
    role: "secondary-module",
    where: "Architecture / pictogram catalog only",
    frequency: "low",
    importance: "nice",
    currentOrigin: "none",
    status: "MISSING",
    need: "deferred",
    wave: 3,
    notes: "Sem rota live ainda.",
  },
  {
    id: "mod-config",
    name: "Configurações / preferências",
    role: "secondary-module",
    where: "Conta e Família · /settings",
    frequency: "med",
    importance: "nice",
    currentIcon: "Settings / Settings2",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
    notes: "Pode permanecer neutro se Conta/Família tiver mark próprio.",
  },

  /* —— D. Care / health —— */
  {
    id: "care-vacina",
    name: "Vacina",
    role: "care-health",
    where: "register · timeline · schedules · Home Agora",
    frequency: "high",
    importance: "essential",
    currentIcon: "Syringe",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
  },
  {
    id: "care-vermifugo",
    name: "Vermífugo",
    role: "care-health",
    where: "register · schedules · Home Agora · alerts",
    frequency: "high",
    importance: "essential",
    currentIcon: "Bug vs Pill (inconsistente)",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
    notes: "Unificar metáfora na Wave 2.",
  },
  {
    id: "care-medicacao",
    name: "Medicação",
    role: "care-health",
    where: "register · timeline · pet",
    frequency: "high",
    importance: "essential",
    currentIcon: "Pill",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
  },
  {
    id: "care-consulta",
    name: "Consulta",
    role: "care-health",
    where: "register · timeline · Home Próximos",
    frequency: "med",
    importance: "important",
    currentIcon: "Stethoscope",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
  },
  {
    id: "care-exame",
    name: "Exame",
    role: "care-health",
    where: "register · attachments",
    frequency: "med",
    importance: "important",
    currentIcon: "FlaskConical",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 3,
  },
  {
    id: "care-peso",
    name: "Peso",
    role: "care-health",
    where: "register · chart · neonatal · Home",
    frequency: "high",
    importance: "important",
    currentIcon: "Scale",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 2,
  },
  {
    id: "care-higiene",
    name: "Higiene",
    role: "care-health",
    where: "register · timeline",
    frequency: "med",
    importance: "important",
    currentIcon: "Bath",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 3,
  },
  {
    id: "care-higiene-subtipos",
    name: "Higiene · subtipos (banho, tosa, unhas…)",
    role: "care-health",
    where: "hygiene presets",
    frequency: "low",
    importance: "nice",
    currentOrigin: "none",
    status: "MISSING",
    need: "deferred",
    wave: 3,
  },
  {
    id: "care-preventivo",
    name: "Protocolo preventivo",
    role: "care-health",
    where: "pet preventive card",
    frequency: "med",
    importance: "important",
    currentIcon: "ShieldCheck / mix",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 3,
  },
  {
    id: "care-mamada",
    name: "Mamada / alimentação neonatal",
    role: "care-health",
    where: "neonatal · register",
    frequency: "med",
    importance: "important",
    currentIcon: "Milk",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 3,
  },
  {
    id: "care-xixi-coco",
    name: "Xixi / Cocô",
    role: "care-health",
    where: "neonatal · register",
    frequency: "med",
    importance: "important",
    currentIcon: "Droplets (mesmo para ambos)",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 3,
    notes: "Hoje compartilham ícone — decidir se precisam distinguir.",
  },
  {
    id: "care-temperatura",
    name: "Temperatura",
    role: "care-health",
    where: "neonatal · register",
    frequency: "med",
    importance: "nice",
    currentIcon: "Thermometer",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 3,
  },
  {
    id: "care-observacao",
    name: "Observação / nota",
    role: "care-health",
    where: "register · timeline",
    frequency: "med",
    importance: "nice",
    currentIcon: "ClipboardPlus",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "neutral-utility",
    wave: 3,
  },
  {
    id: "care-doenca-alergia-cirurgia",
    name: "Doença / Alergia / Cirurgia",
    role: "care-health",
    where: "schema health_records · sem quick-register icons",
    frequency: "low",
    importance: "nice",
    currentOrigin: "none",
    status: "MISSING",
    need: "deferred",
    wave: 3,
  },

  /* —— E. Actions —— */
  {
    id: "act-registrar",
    name: "Registrar / adicionar (ação primária)",
    role: "action",
    where: "Registrar cuidado · bottom-nav Plus legado",
    frequency: "high",
    importance: "essential",
    currentIcon: "Plus (legado) · Soft/Line text (lab)",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: null,
    notes: "Não entra na família custom. Home V2 = botão textual Soft.",
  },
  {
    id: "act-editar",
    name: "Editar",
    role: "action",
    where: "Listas / forms em todo o app",
    frequency: "high",
    importance: "essential",
    currentIcon: "Pencil",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
  },
  {
    id: "act-excluir",
    name: "Excluir",
    role: "action",
    where: "Forms / confirms",
    frequency: "high",
    importance: "essential",
    currentIcon: "Trash2",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
  },
  {
    id: "act-fechar",
    name: "Fechar",
    role: "action",
    where: "Sheets · dialogs · flash",
    frequency: "high",
    importance: "essential",
    currentIcon: "X",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
  },
  {
    id: "act-voltar",
    name: "Voltar",
    role: "action",
    where: "Form pages",
    frequency: "high",
    importance: "essential",
    currentIcon: "ArrowLeft",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
  },
  {
    id: "act-buscar",
    name: "Buscar / filtrar",
    role: "action",
    where: "Histórico · pickers",
    frequency: "med",
    importance: "important",
    currentIcon: "Search / ListFilter",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
  },
  {
    id: "act-anexar",
    name: "Anexar arquivo",
    role: "action",
    where: "Documents · health attachments",
    frequency: "med",
    importance: "important",
    currentIcon: "FilePlus2",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
  },
  {
    id: "act-foto",
    name: "Câmera / foto",
    role: "action",
    where: "Pet photo · memories",
    frequency: "med",
    importance: "important",
    currentIcon: "Camera / ImagePlus",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
    notes: "Quando puramente funcional → NEUTRAL UTILITY. Sem identidade autoral forte.",
  },
  {
    id: "act-export",
    name: "Download / export",
    role: "action",
    where: "/api/export · settings",
    frequency: "low",
    importance: "nice",
    currentIcon: "Download",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
  },
  {
    id: "act-expandir",
    name: "Expandir / recolher",
    role: "action",
    where: "Pets collapse · schedules · accordions",
    frequency: "high",
    importance: "essential",
    currentIcon: "ChevronDown / ChevronUp",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: null,
    notes: "Não entra na família custom Wave 1.",
  },
  {
    id: "act-mais",
    name: "Mais / overflow",
    role: "action",
    where: "Shell Mais · overflow secundário",
    frequency: "high",
    importance: "essential",
    currentIcon: "MoreHorizontal / ChevronRight",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: null,
    notes: "Não entra na família custom Wave 1. Destino estrutural ≠ glifo de marca.",
  },
  {
    id: "act-completar",
    name: "Completar / check",
    role: "action",
    where: "Rotinas · agenda",
    frequency: "med",
    importance: "important",
    currentIcon: "Check",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
    notes: "Check/sucesso utilitário — neutro.",
  },

  /* —— F. Status / feedback —— */
  {
    id: "status-em-dia",
    name: "Em dia / sucesso",
    role: "status-feedback",
    where: "Status chips · schedules · Home",
    frequency: "high",
    importance: "essential",
    currentIcon: "Check ou chip textual",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
    notes: "Sucesso utilitário. Home V2 = status chip textual.",
  },
  {
    id: "status-atencao",
    name: "Atenção / atraso",
    role: "status-feedback",
    where: "Alerts · schedules · chips",
    frequency: "high",
    importance: "essential",
    currentIcon: "AlertTriangle / Clock",
    currentOrigin: "lucide",
    status: "LEGACY",
    need: "custom-cuidadim",
    wave: 3,
    notes: "Wave 3 bloqueada. Tom Cuidadim pode suavizar AlertTriangle genérico.",
  },
  {
    id: "status-hoje",
    name: "Hoje / na hora",
    role: "status-feedback",
    where: "Status chips · Home Agora",
    frequency: "high",
    importance: "important",
    currentIcon: "chip textual · Clock",
    currentOrigin: "lucide",
    status: "NEUTRAL UTILITY",
    need: "neutral-utility",
    wave: 3,
  },
  {
    id: "status-info",
    name: "Informação",
    role: "status-feedback",
    where: "Flash / banners",
    frequency: "med",
    importance: "nice",
    currentOrigin: "none",
    status: "MISSING",
    need: "neutral-utility",
    wave: 3,
    notes: "Flash hoje é só cor + X. Neutro quando existir.",
  },

  /* —— F2. UI states / motifs (não são glifos de família) —— */
  {
    id: "state-selected",
    name: "Selected (nav / pet)",
    role: "ui-state",
    where: "Shell · Pet Row · dock",
    frequency: "high",
    importance: "essential",
    currentIcon: "FourPointStar + gold glow (UI)",
    currentOrigin: "custom",
    status: "APPROVED BEHAVIOR",
    need: "ui-motif",
    wave: null,
    notes: "APPROVED DIRECTION · Option B: estrela fora do chip, pequena, glow sutil. Sem estrela no chip / na borda.",
  },
  {
    id: "state-especial",
    name: "Especial / marco",
    role: "ui-state",
    where: "Badge Especial · Memórias",
    frequency: "med",
    importance: "important",
    currentIcon: "FourPointStar (reuse)",
    currentOrigin: "custom",
    status: "APPROVED MOTIF",
    need: "ui-motif",
    wave: null,
    notes: "STATUS / MOTIF — reutilizar estrela Cozy Celestial. Não criar ícone 'Especial'.",
  },

  /* —— G. Pictograms —— */
  {
    id: "picto-cuidado",
    name: "Pictograma Cuidado Pet",
    role: "pictogram",
    where: "Empty states · storytelling",
    frequency: "med",
    importance: "important",
    currentIcon: "pictogram-care.svg (prior)",
    currentOrigin: "pictogram",
    status: "DEFERRED — NO FINAL ASSET PROVIDED",
    need: "custom-cuidadim",
    wave: 2,
    notes:
      "DEFERRED — NO FINAL ASSET PROVIDED. Não bloqueia Visual Freeze V1. Prior candidate não promovido.",
  },
  {
    id: "picto-casal",
    name: "Pictograma Vida a Dois / Sempre Juntos",
    role: "pictogram",
    where: "Empty / onboarding · Brand Lab",
    frequency: "low",
    importance: "nice",
    currentIcon: "final/pictograms/pictogram-couple.svg",
    currentOrigin: "pictogram",
    status: "APPROVED ASSET",
    need: "custom-cuidadim",
    wave: 3,
    notes: "APPROVED PICTOGRAM · assets finais/icon sempre juntos.svg · multicolor · Freeze V1.",
  },
  {
    id: "picto-memorias",
    name: "Pictograma Memórias",
    role: "pictogram",
    where: "Home V2 teaser · empty states",
    frequency: "med",
    importance: "important",
    currentIcon: "none (deferred)",
    currentOrigin: "none",
    status: "DEFERRED — NO FINAL ASSET PROVIDED",
    need: "custom-cuidadim",
    wave: 2,
    notes:
      "DEFERRED — NO FINAL ASSET PROVIDED · illustration. Não bloqueia Freeze V1. Prior não promovido.",
  },
  {
    id: "picto-financas",
    name: "Pictograma Finanças",
    role: "pictogram",
    where: "Catalog only",
    frequency: "low",
    importance: "nice",
    currentOrigin: "none",
    status: "MISSING",
    need: "deferred",
    wave: 3,
  },
  {
    id: "picto-rotina",
    name: "Pictograma Rotina",
    role: "pictogram",
    where: "Catalog only",
    frequency: "low",
    importance: "nice",
    currentOrigin: "none",
    status: "MISSING",
    need: "deferred",
    wave: 3,
  },
  {
    id: "picto-viagens",
    name: "Pictograma Viagens",
    role: "pictogram",
    where: "Catalog only",
    frequency: "low",
    importance: "nice",
    currentOrigin: "none",
    status: "MISSING",
    need: "deferred",
    wave: 3,
  },
];

export const ICON_INVENTORY_NOTES = {
  principle:
    "3C: Brand ≠ icon family. Wave 1 = 5 glifos APPROVED ASSET (assets finais). Utilities = neutros. Selected/Especial = UI/motif.",
  approved:
    "Wave 1 nav + Assistente = APPROVED ASSET. Pawmark = APPROVED BRAND ASSET. Estrela = APPROVED MOTIF ASSET. Sempre Juntos pictogram = APPROVED ASSET.",
  pawSplit:
    "Pawmark = APPROVED BRAND ASSET (estrela acima). Pets nav = APPROVED ASSET (pata sem estrela). Centro = ALTERNATE ASSET em archive/.",
  waveLock:
    "Wave 2 / Wave 3 CONTINUAM BLOQUEADAS. Não criar Finanças, Rotinas, Viagens, Agenda, Plano, Vacina, etc.",
  noDraw: "Fase 3C não redesenha SVG. Fonte = assets finais (intacta). Sem Lucide nos cinco.",
} as const;

export function entriesByStatus(status: IconInventoryStatus) {
  return ICON_INVENTORY.filter((e) => e.status === status);
}

export function entriesByWave(wave: 1 | 2 | 3) {
  return ICON_INVENTORY.filter((e) => e.wave === wave);
}

export function entriesWave1Custom() {
  return ICON_INVENTORY.filter((e) =>
    (WAVE_1_CUSTOM_IDS as readonly string[]).includes(e.id)
  );
}

export function entriesBrand() {
  return ICON_INVENTORY.filter((e) => e.role === "brand-mark");
}

export function entriesUiStates() {
  return ICON_INVENTORY.filter((e) => e.role === "ui-state");
}

export function entriesCustomNeeded() {
  return ICON_INVENTORY.filter((e) => e.need === "custom-cuidadim");
}

export function entriesNeutralOk() {
  return ICON_INVENTORY.filter((e) => e.need === "neutral-utility");
}

export const ROLE_LABELS: Record<IconRole, string> = {
  "brand-mark": "A · Brand marks",
  "primary-nav": "B · Primary navigation",
  "secondary-module": "C · Secondary / modules",
  "care-health": "D · Care / health",
  action: "E · Actions",
  "status-feedback": "F · Status / feedback",
  "ui-state": "F2 · UI states / motifs",
  pictogram: "G · Pictograms",
};
