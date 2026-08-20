/** Referência estática — Petlove Saúde Leve (tabela oficial, ago/2025). Valores podem variar por região/prestador. */

export const PETLOVE_LEVE_REFERENCE = {
  planName: "Petlove Leve",
  baseMonthlyFeeCents: 1790,
  regionNote: "Valores de referência da tabela Petlove Leve. Confira sempre no site ou Espaço do Cliente — podem variar por cidade e prestador.",
  officialUrl: "https://saude.petlove.com.br/plano-de-saude-pet/coberturas/df/brasilia/petlove-leve",
  lastUpdated: "2025-08",
} as const;

export const PETLOVE_MULTI_PET_DISCOUNTS = [
  { position: "1º pet", discountPercent: 0, label: "Valor cheio do plano" },
  { position: "2º pet", discountPercent: 10, label: "10% de desconto na mensalidade deste pet" },
  { position: "3º pet", discountPercent: 20, label: "20% de desconto na mensalidade deste pet" },
  { position: "4º pet em diante", discountPercent: 30, label: "30% de desconto na mensalidade de cada pet adicional" },
] as const;

export const PETLOVE_COPAY_PAYMENT_NOTES = [
  "Consultas, vacinas e procedimentos clínicos: coparticipação paga direto na clínica no atendimento.",
  "Exames laboratoriais simples: cobrados automaticamente pela Petlove no cartão cadastrado após o procedimento.",
  "Anestesias e exames gerais/especiais (em planos que incluem): também cobrados pela Petlove após realização.",
] as const;

export const PETLOVE_WAITING_PERIODS = [
  { group: "Vacinas, procedimentos clínicos e exames laboratoriais simples", days: 45 },
  { group: "Exames complexos e consultas com especialistas", days: 60 },
  { group: "Cirurgias, internação e anestesias", days: 120, note: "Não incluídos no plano Leve" },
] as const;

export type PetloveReferenceProcedure = {
  name: string;
  copayCents: number;
  annualLimit: string;
  waitingDays: number;
  notes?: string;
};

export type PetloveReferenceGroup = {
  id: string;
  title: string;
  subtitle?: string;
  sharedLimitNote?: string;
  procedures: PetloveReferenceProcedure[];
};

export const PETLOVE_LEVE_PROCEDURE_GROUPS: PetloveReferenceGroup[] = [
  {
    id: "consultations",
    title: "Consultas",
    subtitle: "Clínico geral e domiciliar",
    procedures: [
      { name: "Retorno clínico", copayCents: 0, annualLimit: "Ilimitado", waitingDays: 0 },
      { name: "Consulta clínico geral", copayCents: 3000, annualLimit: "Ilimitado", waitingDays: 0 },
      { name: "Retorno domiciliar", copayCents: 3000, annualLimit: "Ilimitado", waitingDays: 0 },
      { name: "Consulta clínico geral — protocolo vacinal", copayCents: 3000, annualLimit: "1/ano", waitingDays: 0 },
      { name: "Consulta domiciliar", copayCents: 4000, annualLimit: "4/ano", waitingDays: 0 },
      { name: "Consulta domiciliar — protocolo vacinal", copayCents: 4000, annualLimit: "1/ano", waitingDays: 0 },
    ],
  },
  {
    id: "vaccines",
    title: "Vacinas",
    procedures: [
      { name: "Vacina da raiva", copayCents: 2500, annualLimit: "1/ano", waitingDays: 0 },
      { name: "Vacina polivalente / V7 / V8 / V10", copayCents: 2500, annualLimit: "3/ano", waitingDays: 0 },
      { name: "Vacina tríplice (V3) / quádrupla (V4)", copayCents: 2500, annualLimit: "3/ano", waitingDays: 0 },
    ],
  },
  {
    id: "lab-simple",
    title: "Exames laboratoriais simples",
    subtitle: "Hemograma, TGP/ALT, creatinina, fosfatase alcalina, uréia…",
    sharedLimitNote: "Grupo compartilhado: até 10 exames simples por ano (contam juntos, não por exame individual).",
    procedures: [
      { name: "Hemograma", copayCents: 1200, annualLimit: "Grupo 10/ano", waitingDays: 45 },
      { name: "Alanina aminotransferase (TGP/ALT)", copayCents: 1200, annualLimit: "Grupo 10/ano", waitingDays: 45 },
      { name: "Creatinina", copayCents: 1200, annualLimit: "Grupo 10/ano", waitingDays: 45 },
      { name: "Fosfatase alcalina (FA)", copayCents: 1200, annualLimit: "Grupo 10/ano", waitingDays: 45 },
      { name: "Uréia", copayCents: 1200, annualLimit: "Grupo 10/ano", waitingDays: 45 },
    ],
  },
  {
    id: "clinical",
    title: "Procedimentos clínicos",
    procedures: [
      { name: "Coleta de material para exames cobertos", copayCents: 1200, annualLimit: "Ilimitado", waitingDays: 45 },
    ],
  },
  {
    id: "services",
    title: "Serviços",
    procedures: [
      { name: "Microchipagem", copayCents: 0, annualLimit: "1 (vida)", waitingDays: 0, notes: "Obrigatória para iniciar carências após contratação." },
    ],
  },
];

export function resolvePetloveLeveBaseFeeCents(householdFeeCents: number | null | undefined) {
  return householdFeeCents ?? PETLOVE_LEVE_REFERENCE.baseMonthlyFeeCents;
}
export function estimatePetloveLeveMonthlyCents(petCount: number, baseMonthlyFeeCents: number = PETLOVE_LEVE_REFERENCE.baseMonthlyFeeCents) {
  if (petCount <= 0) return 0;
  const discounts = [0, 0.1, 0.2, 0.3];
  let total = 0;
  for (let i = 0; i < petCount; i += 1) {
    const discount = discounts[Math.min(i, 3)];
    total += Math.round(baseMonthlyFeeCents * (1 - discount));
  }
  return total;
}
