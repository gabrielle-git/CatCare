import {
  Bath,
  CircleDot,
  Droplet,
  FlaskConical,
  NotebookPen,
  Pill,
  Scale,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Thermometer,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * Architecture V2 · M0.1R · Brand Lab mock data only.
 * Fields and options mirror the current CatCare (record-fields / records/new).
 * Anything that does not exist today is marked in the UI (FUTURE …, REQUIRES …).
 */

export type AdultId = "dobby" | "anya" | "gwen" | "hinata";
export type KittenId = "pingo" | "nina" | "tico";
export type PetId = AdultId | KittenId;
export type Tone = "ok" | "today" | "warn" | "late";

/* —— Prototype navigation (local state, no real routes) —— */

export type CareTab = "overview" | "saude" | "alimhig" | "agenda" | "rotinas" | "historico" | "neonatal";

/** A = shell visual atual (Visual Freeze / 4B). B = M0 funcional. */
export type ShellId = "A" | "B";

export type FinTab = "resumo" | "gastos" | "compras" | "planos";

export type PetSub = "saude" | "historico" | "perfil";

export type ProtoView =
  | {
      area: "cuidados";
      tab: CareTab;
      saudeCat?: SaudeCat;
      /** Specific record opened inside a category (FUTURE NAVIGATION when coming from a pet). */
      highlight?: string;
      fromPet?: PetId;
      neonatalHistory?: boolean;
      /** Histórico aberto já com um tipo escolhido. */
      historyType?: RecordTypeId;
    }
  | { area: "registrar"; types?: RecordTypeId[]; pets?: PetId[]; saved?: boolean }
  | { area: "pets"; petId?: PetId; sub?: PetSub }
  | { area: "memorias"; petId?: PetId }
  | { area: "financas"; tab: FinTab; fromPet?: PetId }
  | { area: "agora" }
  | { area: "mais" }
  | { area: "assistente" };

export type Go = (view: ProtoView) => void;

export type ProtoVariant = "desktop" | "mobile";

/* —— Dates (mock "today" = qua, 07 out 2026) —— */

export const TODAY = "2026-10-07";

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTHS_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function daysAgo(iso: string) {
  return Math.round((Date.parse(TODAY) - Date.parse(iso)) / 86_400_000);
}

export function dayLabel(iso: string) {
  const d = daysAgo(iso);
  if (d === 0) return "Hoje";
  if (d === 1) return "Ontem";
  if (d === -1) return "Amanhã";
  const [, m, day] = iso.split("-");
  return `${day} ${MONTHS_SHORT[Number(m) - 1]}`;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/* —— Pets —— */

/* Mirrors formatPetAge / formatHumanEquivalentAge / getPetLifeStage (src/lib/format.ts) against the mock TODAY. */

export function petAgeLabel(birthDate: string, estimated = false) {
  const days = Math.max(0, daysAgo(birthDate));
  const prefix = estimated ? "cerca de " : "";
  if (days < 56) return `${prefix}${days} ${days === 1 ? "dia" : "dias"}`;
  const months = Math.max(1, Math.floor(days / 30.44));
  if (months < 24) return `${prefix}${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${prefix}${years} ${years === 1 ? "ano" : "anos"}`;
}

export function humanAgeLabel(birthDate: string) {
  const days = Math.max(0, daysAgo(birthDate));
  if (days < 30) return "menos de 1 ano humano";
  const months = days / 30.44;
  const humanYears =
    months <= 12
      ? Math.max(1, Math.round((months / 12) * 15))
      : months <= 24
        ? Math.round(15 + ((months - 12) / 12) * 9)
        : Math.round(24 + ((months - 24) / 12) * 4);
  return `≈ ${humanYears} ${humanYears === 1 ? "ano humano" : "anos humanos"}`;
}

export function lifeStageLabel(birthDate: string) {
  const days = daysAgo(birthDate);
  if (days < 56) return "Fase neonatal";
  if (days < 365) return "Filhote";
  if (days < 365 * 7) return "Adulto";
  if (days < 365 * 11) return "Maduro";
  return "Sênior";
}

export function longDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} de ${MONTHS_LONG[Number(m) - 1].toLowerCase()} de ${y}`;
}

export type ArchPet = {
  id: PetId;
  name: string;
  /** Idade de vida, calculada da data de nascimento. */
  meta: string;
  tone: Tone;
  statusLabel: string;
  weight: string;
  weights: number[];
  /** Campos reais do perfil (pets): espécie, raça, cor, sexo, nascimento, castração, microchip, descrição. */
  species: string;
  breed?: string;
  color?: string;
  sex?: "Macho" | "Fêmea";
  birthDate: string;
  birthEstimated?: boolean;
  neutered?: { at?: string; place?: string };
  microchip?: { number?: string; implantedAt?: string; location?: string };
  notes?: string;
  documents: number;
  /** Neonatal = até 55 dias (getPetLifeStage). */
  kitten?: { feeds: number; pees: number; poops: number; last: string };
};

function pet(p: Omit<ArchPet, "meta">): ArchPet {
  return { ...p, meta: petAgeLabel(p.birthDate, p.birthEstimated) };
}

export const ADULT_PETS: ArchPet[] = [
  pet({
    id: "dobby",
    name: "Dobby",
    tone: "ok",
    statusLabel: "Em dia",
    weight: "5,2 kg",
    weights: [5.0, 5.1, 5.1, 5.2, 5.2, 5.2],
    species: "Gato",
    breed: "SRD",
    color: "Branca",
    sex: "Macho",
    birthDate: "2020-09-12",
    neutered: { at: "2021-02-18", place: "Clínica Vet Vida" },
    microchip: { number: "900123456789012", implantedAt: "2021-03-15", location: "Pescoço esquerdo" },
    notes: "Branquinho, com heterocromia: um olho verde e o outro azul.",
    documents: 3,
  }),
  pet({
    id: "anya",
    name: "Anya",
    tone: "today",
    statusLabel: "Hoje",
    weight: "4,1 kg",
    weights: [3.9, 4.0, 4.0, 4.1, 4.1, 4.1],
    species: "Gato",
    breed: "Siamês",
    color: "Seal point",
    sex: "Fêmea",
    birthDate: "2023-05-20",
    neutered: { at: "2023-12-02" },
    notes: "Curiosa, adora caixas e janelas.",
    documents: 1,
  }),
  pet({
    id: "gwen",
    name: "Gwen",
    tone: "warn",
    statusLabel: "Vacina pendente",
    weight: "3,4 kg",
    weights: [3.1, 3.2, 3.3, 3.3, 3.4, 3.4],
    species: "Gato",
    breed: "SRD",
    color: "Tricolor",
    sex: "Fêmea",
    birthDate: "2025-07-01",
    microchip: { number: "900987654321098", implantedAt: "2025-11-10" },
    documents: 0,
  }),
  pet({
    id: "hinata",
    name: "Hinata",
    tone: "late",
    statusLabel: "Atrasado",
    weight: "4,6 kg",
    weights: [4.9, 4.8, 4.8, 4.7, 4.6, 4.6],
    species: "Gato",
    breed: "Persa",
    color: "Creme",
    sex: "Fêmea",
    birthDate: "2018-02-10",
    birthEstimated: true,
    neutered: {},
    microchip: { number: "900555000111222" },
    notes: "Calma, gosta de colo. Atenção às articulações.",
    documents: 2,
  }),
];

export const KITTENS: ArchPet[] = [
  pet({
    id: "pingo",
    name: "Pingo",
    tone: "ok",
    statusLabel: "Neonatal",
    weight: "268 g",
    weights: [180, 196, 212, 228, 241, 255, 268],
    species: "Gato",
    sex: "Macho",
    birthDate: "2026-09-22",
    documents: 0,
    kitten: { feeds: 6, pees: 4, poops: 2, last: "17h40" },
  }),
  pet({
    id: "nina",
    name: "Nina",
    tone: "ok",
    statusLabel: "Neonatal",
    weight: "244 g",
    weights: [170, 182, 195, 207, 220, 232, 244],
    species: "Gato",
    sex: "Fêmea",
    birthDate: "2026-09-22",
    documents: 0,
    kitten: { feeds: 5, pees: 3, poops: 1, last: "17h20" },
  }),
  pet({
    id: "tico",
    name: "Tico",
    tone: "warn",
    statusLabel: "Neonatal",
    weight: "221 g",
    weights: [175, 181, 190, 199, 207, 214, 221],
    species: "Gato",
    sex: "Macho",
    birthDate: "2026-09-22",
    documents: 0,
    kitten: { feeds: 4, pees: 3, poops: 0, last: "16h50" },
  }),
];

export function petsOf(neonatal: boolean): ArchPet[] {
  return neonatal ? [...ADULT_PETS, ...KITTENS] : ADULT_PETS;
}

export function findPet(id: PetId): ArchPet {
  return [...ADULT_PETS, ...KITTENS].find((p) => p.id === id) ?? ADULT_PETS[0];
}

export function petName(id: PetId) {
  return findPet(id).name;
}

export function namesOf(ids: PetId[]) {
  const names = ids.map(petName);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export function isKitten(id: PetId) {
  return KITTENS.some((k) => k.id === id);
}

/* —— Registrar · tipos reais do CatCare —— */

export type RecordTypeId =
  | "consulta"
  | "vacina"
  | "medicamento"
  | "vermifugo"
  | "exame"
  | "peso"
  | "alimentacao"
  | "higiene"
  | "xixi"
  | "coco"
  | "temperatura"
  | "nota";

export type RecordTypeMeta = {
  label: string;
  action: string;
  done: string;
  icon: LucideIcon;
  /** Campo “Clínica ou veterinário” existe para o tipo. */
  clinic?: boolean;
  /** “Lembrar novamente em” — só com um único tipo selecionado. */
  reminder?: boolean;
  /** Anexos por pet × tipo. */
  attach?: boolean;
  /** Só filhotes (< 56 dias). */
  puppyOnly?: boolean;
};

export const RECORD_TYPES: Record<RecordTypeId, RecordTypeMeta> = {
  consulta: { label: "Consulta", action: "Registrar consulta", done: "Consulta registrada", icon: Stethoscope, clinic: true, reminder: true, attach: true },
  vacina: { label: "Vacina", action: "Registrar vacina", done: "Vacina registrada", icon: Syringe, clinic: true, reminder: true, attach: true },
  medicamento: { label: "Medicamento", action: "Registrar medicamento", done: "Medicamento registrado", icon: Pill, reminder: true, attach: true },
  vermifugo: { label: "Vermífugo", action: "Registrar vermífugo", done: "Vermífugo registrado", icon: ShieldCheck, clinic: true, reminder: true, attach: true },
  exame: { label: "Exame", action: "Registrar exame", done: "Exame registrado", icon: FlaskConical, clinic: true, attach: true },
  peso: { label: "Peso", action: "Registrar peso", done: "Peso registrado", icon: Scale },
  alimentacao: { label: "Alimentação", action: "Registrar alimentação", done: "Alimentação registrada", icon: UtensilsCrossed },
  higiene: { label: "Higiene", action: "Registrar higiene", done: "Higiene registrada", icon: Bath, attach: true },
  xixi: { label: "Xixi", action: "Registrar xixi", done: "Xixi registrado", icon: Droplet, puppyOnly: true },
  coco: { label: "Cocô", action: "Registrar cocô", done: "Cocô registrado", icon: CircleDot, puppyOnly: true },
  temperatura: { label: "Temperatura", action: "Registrar temperatura", done: "Temperatura registrada", icon: Thermometer, puppyOnly: true },
  nota: { label: "Observação", action: "Registrar observação", done: "Observação registrada", icon: NotebookPen, attach: true },
};

export const RECORD_GROUPS: { id: string; label: string; note?: string; types: RecordTypeId[] }[] = [
  { id: "saude", label: "Saúde", types: ["consulta", "vacina", "medicamento", "vermifugo", "exame"] },
  { id: "medidas", label: "Medidas", types: ["peso"] },
  { id: "alimhig", label: "Alimentação e higiene", types: ["alimentacao", "higiene"] },
  { id: "filhotes", label: "Só filhotes", note: "até 8 semanas", types: ["xixi", "coco", "temperatura"] },
  { id: "outros", label: "Outros", types: ["nota"] },
];

/* Opções reais (record-fields.tsx) */

export const FEEDING_PRESETS = [
  "Leite / mamadeira",
  "Sachê / alimento úmido",
  "Papinha",
  "Ração seca",
  "Petisco",
  "Comida caseira",
  "Outro",
];
export const FEEDING_UNITS = ["ml", "g", "colher", "outra"];
export const QUALITY_OPTIONS = ["Não informar", "Normal", "Foi bem", "Pouquinho", "Com dificuldade", "Precisa de atenção"];
export const HYGIENE_PRESETS = [
  "Banho",
  "Banho a seco",
  "Escovação da pelagem",
  "Tosa",
  "Tosa higiênica",
  "Corte de unhas",
  "Limpeza das orelhas",
  "Higiene dental",
  "Limpeza dos olhos",
  "Outro",
];
/** Protocolo preventivo (v3 · v4 · v5 · antirrábica), filtrado pela espécie do pet. */
export const VACCINE_PROTOCOL = ["V3", "V4", "V5", "Antirrábica"];

/* —— Saúde —— */

export type RecordItem = {
  id: string;
  pet: PetId;
  title: string;
  meta: string;
  tone?: Tone;
  status?: string;
  place?: string;
  notes?: string;
  attachment?: string;
};

export type SaudeCat = "consultas" | "vacinas" | "medicamentos" | "vermifugos" | "exames" | "peso" | "temperatura";

export const SAUDE_CATS: {
  id: SaudeCat;
  label: string;
  record: RecordTypeId;
  group: "clinico" | "medidas";
  summary: string;
  puppyOnly?: boolean;
  /** Lembrete real (criado por “Lembrar novamente em”) — aparece na Agenda. */
  reminder?: string;
  items: RecordItem[];
}[] = [
  {
    id: "consultas",
    label: "Consultas",
    record: "consulta",
    group: "clinico",
    summary: "Última: Dobby · 30 set",
    reminder: "Retorno de Dobby · 20 out, 10h30",
    items: [
      {
        id: "s-con-dobby",
        pet: "dobby",
        title: "Check-up anual",
        meta: "30 set · Clínica Bem-Estar",
        place: "Clínica Bem-Estar",
        notes: "Tudo normal. Retorno em 3 semanas para revisar a pele.",
        attachment: "receita.pdf",
      },
      { id: "s-con-hinata", pet: "hinata", title: "Consulta veterinária", meta: "12 ago · Dra. Ana", place: "Dra. Ana", notes: "Avaliação da articulação." },
    ],
  },
  {
    id: "vacinas",
    label: "Vacinas",
    record: "vacina",
    group: "clinico",
    summary: "Última: Anya · V4 · 2ª dose",
    items: [
      { id: "s-vac-anya", pet: "anya", title: "V4 · 2ª dose", meta: "02 out · Clínica Bem-Estar", place: "Clínica Bem-Estar", attachment: "carteirinha.jpg" },
      { id: "s-vac-dobby", pet: "dobby", title: "Antirrábica · dose anual", meta: "14 mai · Clínica Bem-Estar", place: "Clínica Bem-Estar" },
    ],
  },
  {
    id: "medicamentos",
    label: "Medicamentos",
    record: "medicamento",
    group: "clinico",
    summary: "Último: Hinata · Antipulgas",
    items: [
      { id: "s-med-hinata", pet: "hinata", title: "Antipulgas · 1 pipeta", meta: "01 out", notes: "Dose no título, como hoje." },
      { id: "s-med-dobby", pet: "dobby", title: "Anti-inflamatório", meta: "30 set", notes: "1 comprimido por 5 dias." },
    ],
  },
  {
    id: "vermifugos",
    label: "Vermífugos",
    record: "vermifugo",
    group: "clinico",
    summary: "Último: Gwen · 01 set",
    items: [
      { id: "s-ver-gwen", pet: "gwen", title: "Vermífugo", meta: "01 set" },
      { id: "s-ver-anya", pet: "anya", title: "Vermífugo", meta: "07 jul" },
    ],
  },
  {
    id: "exames",
    label: "Exames",
    record: "exame",
    group: "clinico",
    summary: "Último: Dobby · Hemograma",
    items: [
      { id: "s-exa-dobby", pet: "dobby", title: "Hemograma", meta: "28 set · Laboratório Vida Animal", place: "Laboratório Vida Animal", attachment: "hemograma.pdf" },
    ],
  },
  {
    id: "peso",
    label: "Peso",
    record: "peso",
    group: "medidas",
    summary: "4 pets com peso atual",
    items: [
      { id: "s-pes-anya", pet: "anya", title: "4,1 kg", meta: "Hoje · 08h00" },
      { id: "s-pes-dobby", pet: "dobby", title: "5,2 kg", meta: "30 set" },
      { id: "s-pes-hinata", pet: "hinata", title: "4,6 kg", meta: "12 set" },
    ],
  },
  {
    id: "temperatura",
    label: "Temperatura",
    record: "temperatura",
    group: "medidas",
    summary: "Só filhotes · registro existe, sem card próprio",
    puppyOnly: true,
    items: [{ id: "s-tem-tico", pet: "tico", title: "37,4 °C", meta: "Hoje · 07h30" }],
  },
];

/** Prevenção = status derivado do protocolo preventivo existente, não categoria. */
export const PREVENTION_STATUS: { pet: PetId; text: string; tone: Tone; cat: SaudeCat }[] = [
  { pet: "gwen", text: "V4 · 2ª dose pendente", tone: "warn", cat: "vacinas" },
  { pet: "anya", text: "Vermífugo no prazo de hoje", tone: "today", cat: "vermifugos" },
];

/* —— Alimentação e higiene (registros já ocorridos) —— */

export type DiaCat = "alimentacao" | "higiene";

export const DIA_CATS: {
  id: DiaCat;
  label: string;
  record: RecordTypeId;
  summary: string;
  today: string;
  items: RecordItem[];
}[] = [
  {
    id: "alimentacao",
    label: "Alimentação",
    record: "alimentacao",
    summary: "Último: Anya e Gwen · sachê · 18h10",
    today: "3 refeições",
    items: [
      { id: "d-ali-1", pet: "anya", title: "Sachê / alimento úmido · 85 g", meta: "Hoje · 18h10 · Foi bem" },
      { id: "d-ali-2", pet: "gwen", title: "Sachê / alimento úmido · 85 g", meta: "Hoje · 18h10 · Normal" },
      { id: "d-ali-3", pet: "dobby", title: "Ração seca · 40 g", meta: "Hoje · 07h30" },
    ],
  },
  {
    id: "higiene",
    label: "Higiene",
    record: "higiene",
    summary: "Último: Hinata · escovação da pelagem",
    today: "1 cuidado",
    items: [
      { id: "d-hig-1", pet: "hinata", title: "Escovação da pelagem", meta: "Hoje · 09h00" },
      { id: "d-hig-2", pet: "dobby", title: "Corte de unhas", meta: "03 out" },
      { id: "d-hig-3", pet: "dobby", title: "Limpeza das orelhas", meta: "03 out" },
    ],
  },
];

/* —— Rotinas (tarefas livres, status por pet) —— */

export type RotinaSection = "hoje" | "proximas" | "necessario" | "pausadas";

export const ROTINA_SECTIONS: { id: RotinaSection; label: string }[] = [
  { id: "hoje", label: "Hoje / Atrasadas" },
  { id: "proximas", label: "Próximas" },
  { id: "necessario", label: "Quando necessário" },
  { id: "pausadas", label: "Pausadas" },
];

export const ROTINAS: {
  id: string;
  title: string;
  freq: string;
  time?: string;
  section: RotinaSection;
  pets: { pet: AdultId; status: string; tone?: Tone }[];
}[] = [
  { id: "r-dental", title: "Higiene dental", freq: "Todos os dias", time: "21h", section: "hoje", pets: [{ pet: "dobby", status: "Para hoje", tone: "today" }] },
  {
    id: "r-pelagem",
    title: "Escovação da pelagem",
    freq: "A cada 2 dias",
    time: "19h30",
    section: "hoje",
    pets: [
      { pet: "hinata", status: "Atrasada", tone: "late" },
      { pet: "gwen", status: "Concluído hoje", tone: "ok" },
    ],
  },
  { id: "r-areia", title: "Trocar a areia toda", freq: "Toda semana", section: "proximas", pets: [{ pet: "anya", status: "Próxima", tone: "warn" }] },
  { id: "r-unhas", title: "Corte de unhas", freq: "A cada 15 dias", section: "proximas", pets: [{ pet: "dobby", status: "Em dia", tone: "ok" }] },
  {
    id: "r-tosa",
    title: "Tosa higiênica",
    freq: "Quando necessário",
    section: "necessario",
    pets: [
      { pet: "gwen", status: "Quando necessário" },
      { pet: "hinata", status: "Quando necessário" },
    ],
  },
  { id: "r-banho", title: "Banho", freq: "A cada 30 dias", section: "pausadas", pets: [{ pet: "anya", status: "Pausada" }] },
];

/* —— Agenda = compromissos e lembretes temporais (tabela reminders) —— */

export type AgendaGroup = "Atrasados" | "Hoje" | "Amanhã" | "Próximos dias";

export const AGENDA_GROUPS: AgendaGroup[] = ["Atrasados", "Hoje", "Amanhã", "Próximos dias"];

export const AGENDA_REMINDERS: {
  id: string;
  title: string;
  category: string;
  record: RecordTypeId | null;
  date: string;
  time: string;
  group: AgendaGroup;
  pet?: AdultId;
  repeat?: string;
  tone?: Tone;
}[] = [
  { id: "a-racao", title: "Comprar ração", category: "Compra", record: null, date: "2026-10-06", time: "18h00", group: "Atrasados", repeat: "Todo mês", tone: "late" },
  { id: "a-verm", title: "Próximo vermífugo de Anya", category: "Vermífugo", record: "vermifugo", date: "2026-10-07", time: "21h00", group: "Hoje", pet: "anya", tone: "today" },
  { id: "a-med", title: "Medicamento de Hinata", category: "Medicamento", record: "medicamento", date: "2026-10-08", time: "09h00", group: "Amanhã", pet: "hinata", repeat: "Todos os dias" },
  { id: "a-peso", title: "Pesar a Gwen", category: "Pesagem", record: "peso", date: "2026-10-10", time: "08h00", group: "Próximos dias", pet: "gwen" },
  { id: "a-banho", title: "Banho e tosa", category: "Higiene", record: "higiene", date: "2026-10-14", time: "14h00", group: "Próximos dias", pet: "hinata" },
  { id: "a-retorno", title: "Retorno de Dobby", category: "Consulta", record: "consulta", date: "2026-10-20", time: "10h30", group: "Próximos dias", pet: "dobby" },
];

export const AGENDA_WEEK = [
  { day: "seg", date: "05", iso: "2026-10-05" },
  { day: "ter", date: "06", iso: "2026-10-06" },
  { day: "qua", date: "07", iso: "2026-10-07", today: true },
  { day: "qui", date: "08", iso: "2026-10-08" },
  { day: "sex", date: "09", iso: "2026-10-09" },
  { day: "sáb", date: "10", iso: "2026-10-10" },
  { day: "dom", date: "11", iso: "2026-10-11" },
];

/* —— Histórico (família, sem filtro por pet) —— */

export type HistoryPeriod = 7 | 30 | 90 | "custom";

export const HISTORY_PERIODS: { id: HistoryPeriod; label: string }[] = [
  { id: 7, label: "7 dias" },
  { id: 30, label: "30 dias" },
  { id: 90, label: "90 dias" },
  { id: "custom", label: "Personalizado" },
];

export const HISTORY: { id: string; pet: PetId; type: RecordTypeId; title: string; date: string; time: string; detail?: string }[] = [
  { id: "h1", pet: "anya", type: "alimentacao", title: "Sachê / alimento úmido · 85 g", date: "2026-10-07", time: "18h10" },
  { id: "h2", pet: "gwen", type: "alimentacao", title: "Sachê / alimento úmido · 85 g", date: "2026-10-07", time: "18h10" },
  { id: "h3", pet: "hinata", type: "higiene", title: "Escovação da pelagem", date: "2026-10-07", time: "09h00" },
  { id: "h4", pet: "anya", type: "peso", title: "4,1 kg", date: "2026-10-07", time: "08h00" },
  { id: "h4b", pet: "dobby", type: "alimentacao", title: "Ração seca · 40 g", date: "2026-10-07", time: "07h30" },
  { id: "h4c", pet: "dobby", type: "higiene", title: "Corte de unhas", date: "2026-10-03", time: "19h00" },
  { id: "h5", pet: "anya", type: "vacina", title: "V4 · 2ª dose", date: "2026-10-02", time: "10h00", detail: "Clínica Bem-Estar" },
  { id: "h6", pet: "hinata", type: "medicamento", title: "Antipulgas · 1 pipeta", date: "2026-10-01", time: "20h00" },
  { id: "h7", pet: "dobby", type: "consulta", title: "Check-up anual", date: "2026-09-30", time: "10h30", detail: "Clínica Bem-Estar" },
  { id: "h7b", pet: "dobby", type: "peso", title: "5,2 kg", date: "2026-09-30", time: "10h20" },
  { id: "h7c", pet: "dobby", type: "medicamento", title: "Anti-inflamatório", date: "2026-09-30", time: "11h00" },
  { id: "h8", pet: "dobby", type: "exame", title: "Hemograma", date: "2026-09-28", time: "09h00", detail: "Laboratório Vida Animal" },
  { id: "h9", pet: "gwen", type: "nota", title: "Espirrou algumas vezes depois do banho", date: "2026-09-20", time: "21h00" },
  { id: "h10", pet: "hinata", type: "peso", title: "4,6 kg", date: "2026-09-12", time: "08h30" },
  { id: "h11", pet: "gwen", type: "vermifugo", title: "Vermífugo", date: "2026-09-01", time: "20h00" },
  { id: "h12", pet: "hinata", type: "consulta", title: "Consulta veterinária", date: "2026-08-12", time: "15h00", detail: "Dra. Ana" },
  { id: "h13", pet: "dobby", type: "vacina", title: "Antirrábica · dose anual", date: "2026-05-14", time: "10h00", detail: "Clínica Bem-Estar" },
];

export const HISTORY_NEONATAL: typeof HISTORY = [
  { id: "hn1", pet: "pingo", type: "alimentacao", title: "Leite / mamadeira · 8 ml", date: "2026-10-07", time: "17h40" },
  { id: "hn2", pet: "pingo", type: "xixi", title: "Xixi · Normal", date: "2026-10-07", time: "17h45" },
  { id: "hn3", pet: "tico", type: "temperatura", title: "37,4 °C", date: "2026-10-07", time: "07h30" },
];

/** Chips de tipo do Histórico (família). Xixi/Cocô/Temperatura só com filhote no cenário. */
export const HISTORY_TYPES: RecordTypeId[] = [
  "alimentacao",
  "xixi",
  "coco",
  "temperatura",
  "peso",
  "vacina",
  "vermifugo",
  "medicamento",
  "consulta",
  "exame",
  "higiene",
  "nota",
];

/* —— Neonatal —— */

export const NEONATAL_HISTORY: { day: string; time: string; pet: KittenId; type: RecordTypeId; title: string }[] = [
  { day: "Hoje", time: "17h40", pet: "pingo", type: "alimentacao", title: "Leite / mamadeira · 8 ml" },
  { day: "Hoje", time: "17h45", pet: "pingo", type: "xixi", title: "Xixi · Normal" },
  { day: "Hoje", time: "17h20", pet: "nina", type: "alimentacao", title: "Leite / mamadeira · 7 ml" },
  { day: "Hoje", time: "08h00", pet: "tico", type: "peso", title: "221 g" },
  { day: "Hoje", time: "07h30", pet: "tico", type: "temperatura", title: "37,4 °C" },
  { day: "Ontem", time: "23h10", pet: "nina", type: "coco", title: "Cocô · Normal" },
  { day: "Ontem", time: "22h50", pet: "tico", type: "alimentacao", title: "Leite / mamadeira · 6 ml · Pouquinho" },
];

/* —— Plano de saúde (health_plans.pet_id único: um plano = um pet) —— */

export type HealthPlan = {
  pet: AdultId;
  provider: string;
  planName: string;
  active: boolean;
  fee: string;
  since: string;
  coverage: string;
  copay: { service: string; value: string; status: "coberto" | "parcial" | "não coberto" }[];
};

export const HEALTH_PLANS: HealthPlan[] = [
  {
    pet: "dobby",
    provider: "Petlove",
    planName: "Leve",
    active: true,
    fee: "R$ 89,90/mês",
    since: "mar 2025",
    coverage: "Consultas, vacinas e exames laboratoriais",
    copay: [
      { service: "Consulta clínico geral", value: "R$ 30,00", status: "coberto" },
      { service: "Vacinas", value: "sem coparticipação", status: "coberto" },
      { service: "Exames laboratoriais", value: "R$ 15,00", status: "parcial" },
      { service: "Cirurgias", value: "—", status: "não coberto" },
    ],
  },
  {
    pet: "anya",
    provider: "Petlove",
    planName: "Leve",
    active: true,
    fee: "R$ 80,91/mês",
    since: "jun 2025",
    coverage: "Consultas, vacinas e exames laboratoriais",
    copay: [
      { service: "Consulta clínico geral", value: "R$ 30,00", status: "coberto" },
      { service: "Vacinas", value: "sem coparticipação", status: "coberto" },
      { service: "Exames laboratoriais", value: "R$ 15,00", status: "parcial" },
      { service: "Cirurgias", value: "—", status: "não coberto" },
    ],
  },
];

export function planOf(pet: PetId) {
  return HEALTH_PLANS.find((p) => p.pet === pet);
}

/* —— Finanças —— */

export const FIN_TABS: { id: FinTab; label: string; role: string; today: "exists" | "new" }[] = [
  { id: "resumo", label: "Resumo", role: "Visão do mês: gastos, compras e planos juntos.", today: "new" },
  { id: "gastos", label: "Gastos", role: "Despesas com os pets (hoje em /expenses).", today: "exists" },
  { id: "compras", label: "Compras", role: "Lista de compras (hoje em /shopping).", today: "exists" },
  { id: "planos", label: "Planos", role: "Planos de saúde, um por pet (hoje em /health-plan).", today: "exists" },
];
