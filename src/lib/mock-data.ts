import { formatWeight } from "@/lib/format";
import { DEFAULT_PETLOVE_LEVE_COVERAGE } from "@/lib/health-plan-templates";
import { PETLOVE_LEVE_PROCEDURE_GROUPS, PETLOVE_LEVE_REFERENCE } from "@/lib/petlove-health-reference";
import type { BenefitMembership, Expense, HealthPlanGuideWithServices, HealthPlanWithCopays, MemoryWithMediaUrl, PetWithPhotoUrl, Product, ProductReview, Purchase, Reminder, TimelineItem } from "@/types/database";
import type { HealthPlanGuideService } from "@/types/database";

export const demoPets: PetWithPhotoUrl[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    household_id: "00000000-0000-4000-8000-000000000000",
    name: "Dobby",
    sex: "male",
    birth_date: "2026-03-31",
    birth_date_estimated: false,
    species: "cat",
    breed: "SRD",
    color: "Branca",
    photo_path: null,
    photo_url: null,
    current_weight_grams: null,
    neutered: true,
    neutered_at: "2026-08-05",
    neutered_place: "Clínica Vet Vida",
    has_microchip: true,
    microchip_number: "900123456789012",
    microchip_implanted_at: "2026-04-15",
    microchip_location: "Pescoço esquerdo",
    notes: "Branquinho, com heterocromia: um olho verde e o outro azul. Irmão da Crystal. Castrado em agosto de 2026, com data aproximada.",
    archived_at: null,
    created_at: "2026-08-01T12:00:00.000Z",
    updated_at: "2026-08-16T12:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    household_id: "00000000-0000-4000-8000-000000000000",
    name: "Crystal",
    sex: "female",
    birth_date: "2026-03-31",
    birth_date_estimated: false,
    species: "cat",
    breed: "SRD",
    color: "Branca",
    photo_path: null,
    photo_url: null,
    current_weight_grams: null,
    neutered: false,
    neutered_at: null,
    neutered_place: null,
    has_microchip: false,
    microchip_number: null,
    microchip_implanted_at: null,
    microchip_location: null,
    notes: "Branquinha, com os dois olhos azuis. Irmã do Dobby.",
    archived_at: null,
    created_at: "2026-08-01T12:00:00.000Z",
    updated_at: "2026-08-15T12:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    household_id: "00000000-0000-4000-8000-000000000000",
    name: "Bebê 1",
    sex: "unknown",
    birth_date: "2026-08-07",
    birth_date_estimated: true,
    species: "cat",
    breed: null,
    color: null,
    photo_path: null,
    photo_url: null,
    current_weight_grams: null,
    neutered: false,
    neutered_at: null,
    neutered_place: null,
    has_microchip: false,
    microchip_number: null,
    microchip_implanted_at: null,
    microchip_location: null,
    notes: "Nome ainda não definido. Data de nascimento provisória e pendente de confirmação.",
    archived_at: null,
    created_at: "2026-08-06T12:00:00.000Z",
    updated_at: "2026-08-16T18:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    household_id: "00000000-0000-4000-8000-000000000000",
    name: "Bebê 2",
    sex: "unknown",
    birth_date: "2026-08-07",
    birth_date_estimated: true,
    species: "cat",
    breed: null,
    color: null,
    photo_path: null,
    photo_url: null,
    current_weight_grams: null,
    neutered: false,
    neutered_at: null,
    neutered_place: null,
    has_microchip: false,
    microchip_number: null,
    microchip_implanted_at: null,
    microchip_location: null,
    notes: "Nome ainda não definido. Data de nascimento provisória e pendente de confirmação.",
    archived_at: null,
    created_at: "2026-08-07T12:00:00.000Z",
    updated_at: "2026-08-16T18:00:00.000Z",
  },
];

export const demoWeights: Record<string, { date: string; grams: number }[]> = {
  [demoPets[0].id]: [
    { date: "2026-06-20T10:00:00-03:00", grams: 3200 },
    { date: "2026-07-05T10:00:00-03:00", grams: 3550 },
    { date: "2026-07-22T10:00:00-03:00", grams: 3900 },
    { date: "2026-08-08T10:00:00-03:00", grams: 4100 },
    { date: "2026-08-16T10:00:00-03:00", grams: 4250 },
  ],
  [demoPets[1].id]: [
    { date: "2026-06-20T10:00:00-03:00", grams: 2900 },
    { date: "2026-07-12T10:00:00-03:00", grams: 3300 },
    { date: "2026-08-10T10:00:00-03:00", grams: 3600 },
  ],
};

export const demoTimeline: TimelineItem[] = [
  { id: "demo-1", pet_id: demoPets[2].id, source: "neonatal", kind: "feeding", title: "Mamada", detail: "8 ml • pegou bem", occurred_at: "2026-08-16T21:10:00-03:00", tone: "rose" },
  { id: "demo-3", pet_id: demoPets[0].id, source: "health", kind: "surgery", title: "Castração", detail: "Data aproximada • cerca de 12 dias atrás", occurred_at: "2026-08-05T12:00:00-03:00", tone: "mint" },
  { id: "demo-4", pet_id: demoPets[2].id, source: "neonatal", kind: "urine", title: "Fez xixi", detail: "Normal", occurred_at: "2026-08-16T18:15:00-03:00", tone: "peach" },
];

export const demoReminders: Reminder[] = [
  { id: "rem-1", household_id: demoPets[0].household_id, pet_id: demoPets[0].id, health_record_id: null, title: "Segunda dose da vacina", category: "vaccine", due_at: "2026-08-17T09:00:00-03:00", recurrence_rule: null, status: "pending", completed_at: null, notes: null, created_at: "2026-08-10T12:00:00.000Z", updated_at: "2026-08-10T12:00:00.000Z" },
  { id: "rem-2", household_id: demoPets[0].household_id, pet_id: demoPets[2].id, health_record_id: null, title: "Pesagem da manhã", category: "weight", due_at: "2026-08-17T08:00:00-03:00", recurrence_rule: null, status: "pending", completed_at: null, notes: null, created_at: "2026-08-10T12:00:00.000Z", updated_at: "2026-08-10T12:00:00.000Z" },
  { id: "rem-3", household_id: demoPets[0].household_id, pet_id: demoPets[2].id, health_record_id: null, title: "Mamada da madrugada", category: "feeding", due_at: "2026-08-18T01:00:00-03:00", recurrence_rule: "FREQ=DAILY", status: "pending", completed_at: null, notes: "8 ml", created_at: "2026-08-10T12:00:00.000Z", updated_at: "2026-08-10T12:00:00.000Z" },
  { id: "rem-4", household_id: demoPets[0].household_id, pet_id: demoPets[0].id, health_record_id: null, title: "Vacina V4", category: "vaccine", due_at: "2026-08-24T15:00:00-03:00", recurrence_rule: null, status: "pending", completed_at: null, notes: "Levar carteirinha", created_at: "2026-08-10T12:00:00.000Z", updated_at: "2026-08-10T12:00:00.000Z" },
];

export const demoProducts: Product[] = [
  { id: "prod-1", household_id: demoPets[0].household_id, name: "Ração Menu Gatos", brand: "GranPlus", category: "dry_food", package_size: "3 kg", notes: "Boa adaptação e grãos pequenos.", created_at: "2026-07-20T12:00:00.000Z", updated_at: "2026-08-14T12:00:00.000Z" },
  { id: "prod-2", household_id: demoPets[0].household_id, name: "Sachezinho Frango", brand: "Fancy Feast", category: "wet_food", package_size: "85 g", notes: "Preferido do Dobby.", created_at: "2026-08-01T12:00:00.000Z", updated_at: "2026-08-12T12:00:00.000Z" },
  { id: "prod-3", household_id: demoPets[0].household_id, name: "Areia biodegradável", brand: "Viva Verde", category: "litter", package_size: "4 kg", notes: "Forma torrões firmes e espalha pouco.", created_at: "2026-07-10T12:00:00.000Z", updated_at: "2026-08-05T12:00:00.000Z" },
];

export const demoBenefitMemberships: BenefitMembership[] = [
  {
    id: "membership-petlove",
    household_id: demoPets[0].household_id,
    kind: "petlove_club",
    custom_name: null,
    active: true,
    monthly_fee_cents: 990,
    renews_at: "2026-09-12",
    notes: null,
    created_at: "2026-01-01T12:00:00.000Z",
    updated_at: "2026-08-01T12:00:00.000Z",
  },
];

export const demoPurchases: Purchase[] = [
  { id: "buy-1", household_id: demoPets[0].household_id, product_id: "prod-1", pet_id: null, pet_ids: [demoPets[0].id, demoPets[1].id], expense_id: "exp-2", store_name: "Petz", channel: "online_store", quantity: 1, amount_cents: 8990, subtotal_cents: 9990, discount_cents: 1000, coupon_code: "PET10", petlove_club: false, membership_id: null, purchased_at: "2026-08-14T14:00:00-03:00", product_url: null, notes: null, created_at: "2026-08-14T14:00:00-03:00" },
  { id: "buy-2", household_id: demoPets[0].household_id, product_id: "prod-2", pet_id: demoPets[0].id, pet_ids: [demoPets[0].id], expense_id: "exp-3", store_name: "Petlove", channel: "online_store", quantity: 6, amount_cents: 3954, subtotal_cents: null, discount_cents: 0, coupon_code: null, petlove_club: false, membership_id: "membership-petlove", purchased_at: "2026-08-12T17:00:00-03:00", product_url: null, notes: null, created_at: "2026-08-12T17:00:00-03:00" },
  { id: "buy-3", household_id: demoPets[0].household_id, product_id: "prod-3", pet_id: null, pet_ids: [], expense_id: "exp-4", store_name: "Amazon", channel: "marketplace", quantity: 2, amount_cents: 8390, subtotal_cents: null, discount_cents: 0, coupon_code: null, petlove_club: false, membership_id: null, purchased_at: "2026-08-05T09:00:00-03:00", product_url: null, notes: "Compra recorrente", created_at: "2026-08-05T09:00:00-03:00" },
  { id: "buy-4", household_id: demoPets[0].household_id, product_id: "prod-1", pet_id: null, pet_ids: [], expense_id: null, store_name: "Cobasi", channel: "physical_store", quantity: 1, amount_cents: 9490, subtotal_cents: null, discount_cents: 0, coupon_code: null, petlove_club: false, membership_id: null, purchased_at: "2026-07-18T11:00:00-03:00", product_url: null, notes: null, created_at: "2026-07-18T11:00:00-03:00" },
];

const demoGuideId = "guide-petlove-leve";
const demoGuideServices: HealthPlanGuideService[] = PETLOVE_LEVE_PROCEDURE_GROUPS.flatMap((group, groupIndex) =>
  group.procedures.map((proc, procIndex) => ({
    id: `svc-${group.id}-${procIndex}`,
    guide_id: demoGuideId,
    group_key: group.id,
    group_title: group.title,
    name: proc.name,
    copay_cents: proc.copayCents,
    annual_limit: proc.annualLimit,
    waiting_days: proc.waitingDays,
    notes: proc.notes ?? null,
    sort_order: groupIndex * 10 + procIndex,
    created_at: "2026-08-01T12:00:00.000Z",
  })),
);

export const demoHealthPlanGuides: HealthPlanGuideWithServices[] = [
  {
    id: demoGuideId,
    household_id: demoPets[0].household_id,
    slug: "petlove-leve",
    title: "Serviços e coparticipação Petlove Leve",
    provider: "petlove",
    base_monthly_fee_cents: 1790,
    official_url: PETLOVE_LEVE_REFERENCE.officialUrl,
    notes: PETLOVE_LEVE_REFERENCE.regionNote,
    payment_notes: null,
    waiting_notes: null,
    show_multi_pet_discount: true,
    created_at: "2026-08-01T12:00:00.000Z",
    updated_at: "2026-08-01T12:00:00.000Z",
    services: demoGuideServices,
  },
];

export const demoHealthPlans: HealthPlanWithCopays[] = [
  {
    id: "plan-dobby",
    household_id: demoPets[0].household_id,
    pet_id: demoPets[0].id,
    provider: "petlove",
    plan_name: "Petlove Leve",
    monthly_fee_cents: 1790,
    started_at: "2026-06-01",
    active: true,
    notes: null,
    coverage_summary: DEFAULT_PETLOVE_LEVE_COVERAGE,
    template_id: "template-petlove-leve",
    promo_coupon_code: "PROMO-CARENCIA",
    zero_waiting_consultation: true,
    zero_waiting_vaccine: true,
    promo_notes: "Cupom na contratação — carência zero em consultas e vacinas.",
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-08-01T12:00:00.000Z",
    copay_rules: [],
  },
  {
    id: "plan-crystal",
    household_id: demoPets[1].household_id,
    pet_id: demoPets[1].id,
    provider: "petlove",
    plan_name: "Petlove Leve",
    monthly_fee_cents: 1611,
    started_at: "2026-06-01",
    active: true,
    notes: "2º pet — 10% de desconto na mensalidade.",
    coverage_summary: DEFAULT_PETLOVE_LEVE_COVERAGE,
    template_id: "template-petlove-leve",
    promo_coupon_code: "PROMO-CARENCIA",
    zero_waiting_consultation: true,
    zero_waiting_vaccine: true,
    promo_notes: "Mesmo cupom da contratação em lote.",
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-08-01T12:00:00.000Z",
    copay_rules: [],
  },
];

export const demoProductReviews: ProductReview[] = [
  { id: "review-1", household_id: demoPets[0].household_id, product_id: "prod-1", pet_id: null, pet_ids: [demoPets[0].id, demoPets[1].id], quality_score: 4, acceptance_score: 4, cost_benefit_score: 5, would_buy_again: true, notes: "Todos comeram bem e o pacote rende.", reviewed_at: "2026-08-15T12:00:00-03:00", created_at: "2026-08-15T12:00:00-03:00", updated_at: "2026-08-15T12:00:00-03:00" },
  { id: "review-2", household_id: demoPets[0].household_id, product_id: "prod-2", pet_id: demoPets[0].id, pet_ids: [demoPets[0].id], quality_score: 5, acceptance_score: 5, cost_benefit_score: 3, would_buy_again: true, notes: "Dobby lambe o potinho inteiro.", reviewed_at: "2026-08-13T12:00:00-03:00", created_at: "2026-08-13T12:00:00-03:00", updated_at: "2026-08-13T12:00:00-03:00" },
  { id: "review-3", household_id: demoPets[0].household_id, product_id: "prod-3", pet_id: null, pet_ids: [], quality_score: 5, acceptance_score: 4, cost_benefit_score: 4, would_buy_again: true, notes: "Segura bem o cheiro e faz pouco pó.", reviewed_at: "2026-08-06T12:00:00-03:00", created_at: "2026-08-06T12:00:00-03:00", updated_at: "2026-08-06T12:00:00-03:00" },
];

export const demoExpenses: Expense[] = [
  { id: "exp-1", household_id: demoPets[0].household_id, pet_id: demoPets[0].id, pet_ids: [demoPets[0].id], health_record_id: null, category: "veterinary", description: "Consulta veterinária", amount_cents: 15000, occurred_at: "2026-08-15T10:00:00-03:00", shared: false, receipt_path: null, notes: "Retorno em 30 dias", created_at: "2026-08-15T10:00:00-03:00" },
  { id: "exp-2", household_id: demoPets[0].household_id, pet_id: null, pet_ids: [demoPets[0].id, demoPets[1].id], health_record_id: null, category: "food", description: "GranPlus • Ração Menu Gatos", amount_cents: 8990, occurred_at: "2026-08-14T14:00:00-03:00", shared: true, receipt_path: null, notes: "Compra na Petz", created_at: "2026-08-14T14:00:00-03:00" },
  { id: "exp-3", household_id: demoPets[0].household_id, pet_id: demoPets[0].id, pet_ids: [demoPets[0].id], health_record_id: null, category: "food", description: "Fancy Feast • Sachezinho Frango", amount_cents: 3954, occurred_at: "2026-08-12T17:00:00-03:00", shared: false, receipt_path: null, notes: "6 unidades", created_at: "2026-08-12T17:00:00-03:00" },
  { id: "exp-4", household_id: demoPets[0].household_id, pet_id: null, pet_ids: [], health_record_id: null, category: "hygiene", description: "Viva Verde • Areia biodegradável", amount_cents: 8390, occurred_at: "2026-08-05T09:00:00-03:00", shared: true, receipt_path: null, notes: "2 pacotes", created_at: "2026-08-05T09:00:00-03:00" },
];

const demoMemoryMedia = (memoryId: string, urls: string[]) => urls.map((url, position) => ({
  id: `${memoryId}-photo-${position + 1}`,
  household_id: demoPets[0].household_id,
  memory_id: memoryId,
  storage_path: url,
  position,
  created_at: "2026-08-16T18:00:00-03:00",
  url,
}));

export const demoMemories: MemoryWithMediaUrl[] = [
  { id: "memory-1", household_id: demoPets[0].household_id, pet_id: demoPets[2].id, pet_ids: [demoPets[2].id, demoPets[3].id], type: "milestone", title: "Abriram os olhinhos", body: "Bebê 1 abriu primeiro; no fim da tarde o Bebê 2 também começou a espiar o mundo.", occurred_at: "2026-08-16T17:40:00-03:00", media_path: null, media_url: "/demo-memories/olhinhos.svg", media: demoMemoryMedia("memory-1", ["/demo-memories/olhinhos.svg", "/demo-memories/patinhas.svg"]), archived_at: null, created_at: "2026-08-16T18:00:00-03:00", updated_at: "2026-08-16T18:00:00-03:00" },
  { id: "memory-2", household_id: demoPets[0].household_id, pet_id: demoPets[0].id, pet_ids: [demoPets[0].id, demoPets[1].id], type: "diary", title: "Dobby e Crystal na janela", body: "Passaram a manhã inteira acompanhando os passarinhos, cada um de um lado da cortina.", occurred_at: "2026-08-14T10:20:00-03:00", media_path: null, media_url: "/demo-memories/janela.svg", media: demoMemoryMedia("memory-2", ["/demo-memories/janela.svg", "/demo-memories/soneca.svg", "/demo-memories/caixa.svg"]), archived_at: null, created_at: "2026-08-14T10:30:00-03:00", updated_at: "2026-08-14T10:30:00-03:00" },
  { id: "memory-3", household_id: demoPets[0].household_id, pet_id: demoPets[1].id, pet_ids: [demoPets[1].id], type: "photo", title: "A melhor caixa da casa", body: "A caixa do pedido ganhou da caminha nova por unanimidade.", occurred_at: "2026-08-11T15:10:00-03:00", media_path: null, media_url: "/demo-memories/caixa.svg", media: demoMemoryMedia("memory-3", ["/demo-memories/caixa.svg"]), archived_at: null, created_at: "2026-08-11T15:20:00-03:00", updated_at: "2026-08-11T15:20:00-03:00" },
];

export const demoArchivedMemories: MemoryWithMediaUrl[] = [
  { id: "memory-4", household_id: demoPets[0].household_id, pet_id: demoPets[0].id, pet_ids: [demoPets[0].id], type: "milestone", title: "Primeiro dia em casa", body: "Ainda tímido, mas já escolheu o cantinho favorito.", occurred_at: "2026-04-20T19:00:00-03:00", media_path: null, media_url: "/demo-memories/primeiro-dia.svg", media: demoMemoryMedia("memory-4", ["/demo-memories/primeiro-dia.svg"]), archived_at: "2026-08-10T12:00:00-03:00", created_at: "2026-04-20T20:00:00-03:00", updated_at: "2026-08-10T12:00:00-03:00" },
];

export const mockPets = demoPets.map((pet) => ({ name: pet.name, detail: pet.current_weight_grams ? formatWeight(pet.current_weight_grams) : "Sem peso" }));
export const mockUpcoming = demoReminders.map((reminder) => reminder.title);
