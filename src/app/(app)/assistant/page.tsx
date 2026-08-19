import { Bot, ShieldCheck } from "lucide-react";
import { AssistantPanel } from "@/components/assistant-panel";
import { listCommerce, listExpenses } from "@/lib/commerce";
import { formatCurrency, formatDateTime, formatWeight, getPetLifeStage, isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoExpenses, demoPets, demoProductReviews, demoProducts, demoPurchases, demoReminders, demoTimeline } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { listHouseholdTimeline, listUpcomingReminders } from "@/lib/records";
import { bestFoodRecommendation, bestLitterRecommendation, rankProductRecommendations } from "@/lib/recommendations";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadData() {
  if (!hasSupabaseEnv()) return { pets: demoPets, timeline: demoTimeline, reminders: demoReminders, expenses: demoExpenses, products: demoProducts, purchases: demoPurchases, reviews: demoProductReviews, configured: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], timeline: [], reminders: [], expenses: [], products: [], purchases: [], reviews: [], configured: true };
  const household = await ensureHousehold(supabase, data.user.id);
  const [pets, timeline, reminders, expenses, commerce] = await Promise.all([listPets(supabase, household.id), listHouseholdTimeline(supabase, household.id, 80), listUpcomingReminders(supabase, household.id, 30), listExpenses(supabase, household.id), listCommerce(supabase, household.id)]);
  return { pets, timeline, reminders, expenses, ...commerce, configured: true };
}

export default async function AssistantPage() {
  const { pets, timeline, reminders, expenses, products, purchases, reviews, configured } = await loadData();
  const names = new Map(pets.map((pet) => [pet.id, pet.name]));
  const latestVaccine = timeline.find((item) => item.kind === "vaccine");
  const latestWeight = timeline.find((item) => item.kind === "weight");
  const nextReminder = reminders[0];
  const now = new Date();
  const monthExpenses = expenses.filter((item) => { const date = new Date(item.occurred_at); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); });
  const monthTotal = monthExpenses.reduce((sum, item) => sum + item.amount_cents, 0);
  const rankedProducts = rankProductRecommendations(products, purchases, reviews);
  const best = rankedProducts[0] ?? null;
  const food = bestFoodRecommendation(rankedProducts);
  const litter = bestLitterRecommendation(rankedProducts);
  const hasNeonatal = pets.some(isNeonatalPet);
  const hasKittens = pets.some((pet) => getPetLifeStage(pet.birth_date) === "kitten");
  const foodAgeNote = hasNeonatal ? " Essa recomendação não se aplica à alimentação neonatal; para os filhotes, mantenha o protocolo orientado pelo veterinário." : hasKittens ? " Como há filhotes na família, confirme no rótulo se a fórmula é indicada para essa fase." : "";
  const currentWeights = pets.filter((pet) => pet.current_weight_grams != null).map((pet) => `${pet.name}: ${formatWeight(pet.current_weight_grams)}`).join("; ");
  const answers = {
    vaccine: latestVaccine ? `A vacina mais recente registrada foi “${latestVaccine.title}” para ${names.get(latestVaccine.pet_id) ?? "um dos pets"}, em ${formatDateTime(latestVaccine.occurred_at)}.` : "Ainda não encontrei nenhuma vacina registrada. Quando você lançar uma, ela aparecerá aqui com o pet e a data.",
    expenses: `Neste mês há ${monthExpenses.length} lançamentos, somando ${formatCurrency(monthTotal)}. Você pode abrir Gastos para ver a divisão por categoria e por pet.`,
    weight: currentWeights ? `Os pesos atuais registrados são: ${currentWeights}.${latestWeight ? ` A pesagem mais recente foi de ${names.get(latestWeight.pet_id) ?? "um pet"} em ${formatDateTime(latestWeight.occurred_at)}.` : ""}` : "Ainda não há pesos cadastrados. Registre uma pesagem para começar a acompanhar a evolução.",
    reminder: nextReminder ? `O próximo cuidado é “${nextReminder.title}”, para ${names.get(nextReminder.pet_id ?? "") ?? "a família"}, em ${formatDateTime(nextReminder.due_at)}.` : "A agenda está livre: não encontrei lembretes pendentes.",
    food: food ? `Entre os alimentos avaliados pela família, “${food.product.name}” lidera: aceitação ${food.acceptance.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/5 e custo-benefício ${food.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/5. O motivo principal é ${food.reason}.${food.latest ? ` O último preço foi ${formatCurrency(Math.round(food.latest.amount_cents / food.latest.quantity))} por pacote em ${food.latest.store_name}.` : ""}${foodAgeNote}` : "Ainda não há avaliações de ração, sachê ou petisco suficientes. Registre aceitação e custo-benefício para eu comparar sem inventar.",
    litter: litter ? `A areia mais recomendada pelo histórico é “${litter.product.name}”: qualidade ${litter.quality.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/5 e custo-benefício ${litter.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/5. Ela se destaca porque ${litter.reason}.${litter.latest ? ` O último preço foi ${formatCurrency(Math.round(litter.latest.amount_cents / litter.latest.quantity))} por pacote em ${litter.latest.store_name}.` : ""}` : "Ainda não há uma areia avaliada. Depois de registrar qualidade, controle de odor e custo-benefício, eu consigo comparar as opções.",
    shopping: best ? `Pelas avaliações da família, “${best.product.name}” é a compra mais equilibrada agora, com nota calculada de ${best.score.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/5. A indicação vem de ${best.reviewCount} ${best.reviewCount === 1 ? "avaliação" : "avaliações"} registradas, não de publicidade.` : "Ainda não há avaliações suficientes para indicar um produto. Registre qualidade, aceitação e custo-benefício na próxima compra.",
    summary: `A família tem ${pets.length} ${pets.length === 1 ? "pet" : "pets"}, ${reminders.length} lembretes pendentes e ${monthExpenses.length} gastos neste mês. Posso detalhar vacinas, pesos, agenda, gastos ou compras.`,
  };

  return <div className="mx-auto w-full max-w-[900px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
    <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-[19px] bg-[var(--lavender-soft)]"><Bot size={22} /></span><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Assistente</p><h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Pergunte aos seus dados</h1><p className="mt-2 max-w-[680px] text-sm text-[var(--muted)]">Respostas rápidas baseadas exclusivamente no histórico do CatCare — sem diagnóstico e sem inventar informações.</p></div></div>
    {!configured && <div className="mt-6 rounded-[20px] bg-[var(--lavender-soft)] px-4 py-3 text-sm"><strong>Modo de demonstração.</strong> Experimente as perguntas usando os dados de exemplo.</div>}
    <AssistantPanel answers={answers} />
    <p className="mt-4 flex items-start gap-2 rounded-[18px] bg-[var(--mint-soft)] px-4 py-3 text-xs leading-relaxed text-[var(--muted)]"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--success)]" /> O assistente atual faz consultas locais e previsíveis. Uma IA visual para interpretar fotos será uma integração separada, com consentimento explícito antes de enviar qualquer imagem.</p>
  </div>;
}
