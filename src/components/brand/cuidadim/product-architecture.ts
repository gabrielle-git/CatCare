/**
 * Cuidadim Product Architecture — Phase 1 (correção final)
 * Conceptual domains only. NOT navigation. NOT a visual mock.
 */

export type FeatureStatus = "surface" | "embedded" | "backend-ready";

export type FunctionalFeature = {
  id: string;
  name: string;
  userGoal: string;
  evidence: string;
  status: FeatureStatus;
  currentEntry?: string;
};

/**
 * Inventário técnico preservado (Fase 1 anterior).
 * Não refeito nesta correção — só a arquitetura conceitual muda.
 */
export const FUNCTIONAL_INVENTORY: FunctionalFeature[] = [
  {
    id: "pets-roster",
    name: "Lista de pets",
    userGoal: "Ver e escolher os pets da casa",
    evidence: "Rotas /pets, listPets",
    status: "surface",
    currentEntry: "/pets",
  },
  {
    id: "pet-profile",
    name: "Perfil do pet",
    userGoal: "Conhecer identidade, idade, espécie e dados do pet",
    evidence: "/pets/[id]",
    status: "surface",
    currentEntry: "/pets/[id]",
  },
  {
    id: "pet-photo",
    name: "Foto de perfil do pet",
    userGoal: "Reconhecer o pet visualmente",
    evidence: "create/edit pet FormData File; icons-v2 IconFotoPet",
    status: "embedded",
    currentEntry: "/pets/new · /pets/[id]/edit",
  },
  {
    id: "pet-microchip",
    name: "Microchip",
    userGoal: "Guardar identificação permanente",
    evidence: "migration 0016",
    status: "embedded",
    currentEntry: "perfil / edição",
  },
  {
    id: "pet-neutering",
    name: "Castração",
    userGoal: "Registrar status reprodutivo",
    evidence: "migration 0017",
    status: "embedded",
  },
  {
    id: "pet-documents",
    name: "Documentos do pet",
    userGoal: "Guardar papéis e anexos por pet",
    evidence: "migrations 0033–0034 · /pets/[id]/documents",
    status: "surface",
    currentEntry: "/pets/[id]/documents",
  },
  {
    id: "pet-archive",
    name: "Arquivar pet",
    userGoal: "Tirar pet ativo sem apagar história",
    evidence: "edit flow archived",
    status: "embedded",
  },
  {
    id: "home-alerts",
    name: "Alertas",
    userGoal: "Saber o que está atrasado ou próximo",
    evidence: "HomeCareAlerts + schedules",
    status: "surface",
    currentEntry: "/",
  },
  {
    id: "home-activity",
    name: "Atividade recente",
    userGoal: "Ver o que aconteceu por último",
    evidence: "timeline preview na Home",
    status: "surface",
    currentEntry: "/",
  },
  {
    id: "register-care",
    name: "Registrar cuidado",
    userGoal: "Anotar um fato agora",
    evidence: "/records/new · createRecord",
    status: "surface",
    currentEntry: "/records/new",
  },
  {
    id: "health-records",
    name: "Registros de saúde",
    userGoal: "Registrar vacina, consulta, exame, medicação, cirurgia, alergia, doença, outro",
    evidence: "health_records types",
    status: "surface",
    currentEntry: "/records/new",
  },
  {
    id: "hygiene",
    name: "Higiene",
    userGoal: "Registrar banho, tosa e cuidados de higiene",
    evidence: "migration 0031 · health_records.type=hygiene",
    status: "embedded",
    currentEntry: "/records/new (tipo higiene)",
  },
  {
    id: "weight",
    name: "Peso",
    userGoal: "Acompanhar evolução de peso",
    evidence: "weight_records · gráfico no perfil",
    status: "surface",
  },
  {
    id: "deworming",
    name: "Vermífugo",
    userGoal: "Controlar doses e prazos",
    evidence: "migration 0018 + schedule UI",
    status: "surface",
  },
  {
    id: "vaccines-ledger",
    name: "Vacinas",
    userGoal: "Registrar aplicações reais",
    evidence: "vaccine_doses · migration 0028",
    status: "surface",
  },
  {
    id: "preventive-protocol",
    name: "Protocolo preventivo",
    userGoal: "Saber o calendário esperado e exceções por pet",
    evidence: "migration 0029 · preventive-protocol.ts",
    status: "embedded",
  },
  {
    id: "health-attachments",
    name: "Anexos clínicos",
    userGoal: "Anexar laudos/fotos a um registro de saúde",
    evidence: "migration 0035",
    status: "embedded",
  },
  {
    id: "family-history",
    name: "Histórico da família",
    userGoal: "Revisar linha do tempo filtrável",
    evidence: "/historico · family-history",
    status: "surface",
    currentEntry: "/historico",
  },
  {
    id: "pet-history",
    name: "Histórico por pet",
    userGoal: "Ver linha do tempo de um pet",
    evidence: "/pets/[id]/historico",
    status: "surface",
  },
  {
    id: "neonatal",
    name: "Modo neonatal",
    userGoal: "Acompanhar filhotes",
    evidence: "/neonatal · neonatal_records",
    status: "surface",
    currentEntry: "/neonatal",
  },
  {
    id: "neonatal-feeding-legacy",
    name: "Alimentação neonatal",
    userGoal: "Registrar mamadas com subtipos/volumes",
    evidence: "migration 0030",
    status: "embedded",
  },
  {
    id: "feeding-sessions",
    name: "feeding_sessions",
    userGoal: "Registrar refeições (sessão + itens)",
    evidence: "migration 0032 · sem experiência de tela própria",
    status: "backend-ready",
  },
  {
    id: "routines",
    name: "Rotinas",
    userGoal: "Cuidados que se repetem e marcar como feitos",
    evidence: "migration 0027 · /routines",
    status: "surface",
    currentEntry: "/routines",
  },
  {
    id: "agenda",
    name: "Agenda",
    userGoal: "Saber o que vem pela frente",
    evidence: "/agenda · reminders",
    status: "surface",
    currentEntry: "/agenda",
  },
  {
    id: "health-plan",
    name: "Plano de saúde",
    userGoal: "Saber operadora, cobertura e coparticipação",
    evidence: "migrations 0019–0025 · /health-plan",
    status: "surface",
    currentEntry: "/health-plan",
  },
  {
    id: "health-plan-guides",
    name: "Guias / copay",
    userGoal: "Consultar o que o plano cobre e quanto custa",
    evidence: "migrations 0023–0024 · /health-plan/guides",
    status: "surface",
  },
  {
    id: "benefit-memberships",
    name: "Benefícios",
    userGoal: "Guardar assinaturas e benefícios",
    evidence: "migrations 0021, 0026",
    status: "surface",
  },
  {
    id: "expenses",
    name: "Gastos",
    userGoal: "Ver quanto a família investe nos pets",
    evidence: "/expenses · commerce",
    status: "surface",
    currentEntry: "/expenses",
  },
  {
    id: "shopping",
    name: "Compras / shopping",
    userGoal: "Registrar compras, preços e aceitação",
    evidence: "/shopping · purchase+review",
    status: "surface",
    currentEntry: "/shopping",
  },
  {
    id: "memories",
    name: "Memórias",
    userGoal: "Guardar momentos, marcos e fotos",
    evidence: "migrations 0003–0004 · /memories",
    status: "surface",
    currentEntry: "/memories",
  },
  {
    id: "assistant",
    name: "Assistente",
    userGoal: "Perguntar sobre o que já está registrado",
    evidence: "/assistant",
    status: "surface",
    currentEntry: "/assistant",
  },
  {
    id: "household-members",
    name: "Membros",
    userGoal: "Convidar e gerir quem cuida junto",
    evidence: "invites 0008–0015 · /settings/members",
    status: "surface",
    currentEntry: "/settings/members",
  },
  {
    id: "household-switch",
    name: "Household",
    userGoal: "Alternar entre casas/households",
    evidence: "0011 active household · settings",
    status: "surface",
    currentEntry: "/settings",
  },
  {
    id: "export-privacy",
    name: "Exportação",
    userGoal: "Baixar dados da família",
    evidence: "/api/export · settings",
    status: "surface",
    currentEntry: "/settings",
  },
  {
    id: "settings",
    name: "Configurações",
    userGoal: "Ajustar conta e preferências",
    evidence: "/settings",
    status: "surface",
    currentEntry: "/settings",
  },
  {
    id: "demo-mode",
    name: "Modo demonstração",
    userGoal: "Experimentar sem conta/dados reais",
    evidence: "demo cookie · AppShell banner — técnico apenas; fora do mapa de produto",
    status: "surface",
    currentEntry: "/demo",
  },
];

export type ModulePriority = "primary" | "secondary" | "support";

export type ArchitectureModule = {
  id: string;
  /** Canonical domain name */
  name: string;
  /** Optional UI label (e.g. Meus pets) */
  uiLabel?: string;
  purpose: string;
  priority: ModulePriority;
  /** Explicit naming gate — not final branding */
  namingStatus?: "NAMING TO RESOLVE";
  /** Extra note shown in lab (e.g. secondary ≠ hidden) */
  priorityNote?: string;
  contentTypes: string[];
  suggestedPatterns: string[];
  featureIds: string[];
  justification: string;
  /** Tree lines for the conceptual map */
  tree: string[];
};

/** Ação primária — não é módulo. */
export const PRIMARY_ACTIONS = [
  {
    id: "register-care",
    name: "Registrar cuidado",
    classification: "AÇÃO PRIMÁRIA" as const,
    livesIn: "Agora",
    note: "Não é domínio conceitual independente. Ação prioritária dentro de Agora / fluxos de cuidado.",
  },
];

/** Utilidades transversais — não são módulos de domínio. */
export const TRANSVERSAL_UTILITIES = [
  {
    id: "assistant",
    name: "Assistente",
    classification: "UTILIDADE TRANSVERSAL" as const,
    note: "Pode ser acessível de vários contextos. Onde aparece na navegação fica para a Fase 2.",
  },
];

/**
 * Domínios conceituais do produto.
 * NÃO significam itens permanentes de sidebar / bottom nav.
 */
export const ARCHITECTURE_MODULES: ArchitectureModule[] = [
  {
    id: "agora",
    name: "Agora",
    purpose: "O que exige atenção ou ação neste momento.",
    priority: "primary",
    contentTypes: ["alertas", "próximos cuidados", "atividade recente", "registrar cuidado (ação)"],
    suggestedPatterns: ["summary strip", "lista compacta", "faixa de ação", "não grid de cards"],
    featureIds: ["home-alerts", "home-activity"],
    justification:
      "Lugar mental para urgência e atenção. Registrar cuidado é ação primária aqui — não um módulo à parte.",
    tree: [
      "alertas",
      "próximos cuidados",
      "atividade recente",
      "registrar cuidado [AÇÃO PRIMÁRIA]",
    ],
  },
  {
    id: "pets",
    name: "Pets",
    uiLabel: "Meus pets",
    purpose: "Identidade e contexto individual de cada pet (roster + perfil).",
    priority: "primary",
    contentTypes: [
      "lista de pets",
      "perfil",
      "foto",
      "identificação/microchip",
      "castração",
      "documentos",
      "arquivamento",
    ],
    suggestedPatterns: ["rail horizontal de pets", "painel contextual", "perfil editorial"],
    featureIds: [
      "pets-roster",
      "pet-profile",
      "pet-photo",
      "pet-microchip",
      "pet-neutering",
      "pet-documents",
      "pet-archive",
    ],
    justification:
      "Nome de domínio = Pets (ou Meus pets na UI). 'Quem você cuida' pode ser copy editorial no futuro, não o nome principal do domínio.",
    tree: [
      "lista de pets",
      "contexto individual",
      "  ├── perfil",
      "  ├── identificação",
      "  ├── documentos",
      "  └── dados do pet",
    ],
  },
  {
    id: "cuidados",
    name: "Cuidados",
    purpose:
      "Saúde, registros, prevenção, rotina, agenda, neonatal, alimentação e plano de saúde/cobertura.",
    priority: "primary",
    contentTypes: [
      "saúde e registros",
      "histórico",
      "vacinas / medicações / consultas / exames",
      "peso / higiene / vermífugo / preventivos",
      "rotinas / agenda",
      "neonatal / alimentação",
      "plano de saúde (cobertura, benefícios, guias, copay)",
    ],
    suggestedPatterns: [
      "timeline",
      "lista filtrável",
      "destaque de protocolo",
      "empty state com pictograma Cuidado",
    ],
    featureIds: [
      "health-records",
      "hygiene",
      "weight",
      "deworming",
      "vaccines-ledger",
      "preventive-protocol",
      "health-attachments",
      "family-history",
      "pet-history",
      "neonatal",
      "neonatal-feeding-legacy",
      "feeding-sessions",
      "routines",
      "agenda",
      "health-plan",
      "health-plan-guides",
      "benefit-memberships",
    ],
    justification:
      "Plano de saúde/cobertura/copay pertence a Cuidados (não a um agrupamento 'Plano & casa'). feeding_sessions fica sob Alimentação até existir experiência de tela — sem destino de nav só por schema.",
    tree: [
      "saúde e registros",
      "histórico",
      "vacinas",
      "medicações",
      "consultas/exames",
      "peso",
      "higiene",
      "preventivos",
      "rotinas",
      "agenda",
      "neonatal",
      "alimentação",
      "  └── feeding_sessions (sem tela própria ainda)",
      "plano de saúde",
      "  ├── cobertura",
      "  ├── benefícios",
      "  ├── guias",
      "  └── copay",
    ],
  },
  {
    id: "memorias",
    name: "Memórias",
    purpose: "Afeto, marcos e álbum — identidade emocional do Cuidadim.",
    priority: "secondary",
    priorityNote:
      "Secondary não significa escondido ou pouco importante. Pode ter destino próprio, aparecer na Home e contribuir fortemente para a identidade emocional do Cuidadim.",
    contentTypes: ["galeria", "marcos", "diário"],
    suggestedPatterns: [
      "destaque editorial",
      "rail horizontal",
      "empty state com pictograma Memórias",
    ],
    featureIds: ["memories"],
    justification:
      "Módulo próprio. Prioridade operacional secondary ≠ esconder. Pictograma Memórias já é linguagem de marca.",
    tree: ["destino próprio · teaser na Home · identidade emocional"],
  },
  {
    id: "casa-financas",
    name: "Casa / Finanças",
    purpose: "Gastos e compras — domínio secundário provisório.",
    priority: "secondary",
    namingStatus: "NAMING TO RESOLVE",
    contentTypes: ["gastos", "compras/shopping"],
    suggestedPatterns: ["lista compacta", "summary strip financeiro"],
    featureIds: ["expenses", "shopping"],
    justification:
      "Nome provisório. Não misturar com plano de saúde. Não tratar como branding final.",
    tree: ["gastos", "compras/shopping"],
  },
  {
    id: "conta-e-familia",
    name: "Conta e Família",
    purpose: "Conta, membros, household, configurações e exportação.",
    priority: "support",
    contentTypes: ["membros", "household", "configurações", "exportação"],
    suggestedPatterns: ["settings list", "painel de conta"],
    featureIds: ["household-members", "household-switch", "settings", "export-privacy"],
    justification:
      "Assistente não fica aqui (é utilidade transversal). Demo não é domínio de produto.",
    tree: ["membros", "household", "configurações", "exportação"],
  },
];

/** IDs fora do mapa de produto (existem tecnicamente). */
export const OUTSIDE_PRODUCT_MAP = [
  {
    id: "demo-mode",
    name: "Demo",
    reason: "Pode existir tecnicamente; não é domínio nem módulo do produto.",
  },
] as const;

export type HomePriority = {
  order: number;
  question: string;
  mapsTo: string;
  do: string;
  dont: string;
};

/** Home hierarchy — reasoning only; no mock. */
export const HOME_PRIORITIES: HomePriority[] = [
  {
    order: 1,
    question: "O que importa agora?",
    mapsTo: "Agora · alertas, atenção do dia, ação registrar cuidado",
    do: "Abrir com urgência/atenção em lista ou faixa; tipografia clara; poucos itens.",
    dont: "Começar com grade de módulos ou saudação genérica sem conteúdo acionável.",
  },
  {
    order: 2,
    question: "Qual pet/contexto está envolvido?",
    mapsTo: "Pets · âncora/contexto (não a listagem completa como trabalho principal)",
    do: "Âncora visual leve (foto/nome) ligada ao que está em Agora.",
    dont: "Repetir a listagem completa de pets como se fosse o trabalho principal da Home.",
  },
  {
    order: 3,
    question: "O que está próximo?",
    mapsTo: "Próximos cuidados (Agora + subset de Cuidados: agenda/rotina)",
    do: "Próximos 1–3 eventos com tempo relativo; link para Agenda/Cuidados.",
    dont: "Calendário completo ou lista longa de todas as rotinas.",
  },
  {
    order: 4,
    question: "O que aconteceu recentemente?",
    mapsTo: "Atividade recente e/ou teaser de Memórias",
    do: "Timeline curta OU um momento afetivo — um dos dois em destaque, não ambos competindo.",
    dont: "Dois blocos de cards 'Atividade' + 'Memórias' + 'Assistente' no mesmo peso.",
  },
  {
    order: 5,
    question: "Onde encontro o restante?",
    mapsTo: "Atalhos discretos / overflow para Cuidados, Memórias, Casa/Finanças, Conta e Família",
    do: "Links textuais ou teaser mínimo; pictograma só se empty/onboarding.",
    dont: "Transformar a Home num dashboard de todos os módulos.",
  },
];

export const ARCHITECTURE_NOTES = {
  logo: "FINAL ASSET TO RESOLVE — não usar Wordmark R1 como proposta; não inventar branding nesta fase.",
  catCare: "Inventário funcional apenas. Arquitetura visual e nomes de módulos são Cuidadim.",
  domainsAreNotNav:
    "ESTES SÃO DOMÍNIOS CONCEITUAIS. Não significa que todos virarão itens permanentes de sidebar ou bottom navigation. A arquitetura de navegação será decidida visualmente na Fase 2.",
  removed: [
    "Quem (renomeado para Pets)",
    "Plano & casa (desfeito: plano → Cuidados; gastos/compras → Casa / Finanças)",
    "Demo como módulo/domínio",
    "Assistente dentro de Família (agora UTILIDADE TRANSVERSAL)",
  ] as const,
  phase2Gate:
    "Shells desktop A/B, nav mobile A/B, Home V2 e limpeza visual do lab ficam para Fase 2 após aprovação desta arquitetura.",
} as const;
