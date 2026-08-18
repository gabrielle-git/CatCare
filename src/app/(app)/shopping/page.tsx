import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BadgeCheck, Brain, Minus, PackageOpen, Pencil, Plus, ReceiptText, ShoppingBasket, Sparkles, Star, Store, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { PetNameChips } from "@/components/pet-name-chips";
import { listCommerce } from "@/lib/commerce";
import { formatCurrency, formatShortDate, getPetLifeStage, isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoPets, demoProductReviews, demoProducts, demoPurchases } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { canEdit, getMyRole } from "@/lib/roles";
import { bestFoodRecommendation, bestLitterRecommendation, rankProductRecommendations } from "@/lib/recommendations";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ProductCategory, PurchaseChannel } from "@/types/database";
import { deleteProduct, deletePurchase } from "./actions";

const categoryLabels: Record<ProductCategory, string> = {
  dry_food: "Ração seca", wet_food: "Sachê / úmido", litter: "Areia", treat: "Petisco", hygiene: "Higiene", medicine: "Medicamento", accessory: "Acessório", other: "Outro",
};
const channelLabels: Record<PurchaseChannel, string> = {
  physical_store: "loja física", online_store: "loja online", marketplace: "marketplace", delivery: "delivery", veterinary: "clínica", other: "outro canal",
};
const tones: Record<ProductCategory, string> = {
  dry_food: "bg-[var(--peach)]", wet_food: "bg-[var(--rose-soft)]", litter: "bg-[var(--mint-soft)]", treat: "bg-[var(--lavender-soft)]", hygiene: "bg-[var(--mint-soft)]", medicine: "bg-[var(--lavender-soft)]", accessory: "bg-[var(--cream)]", other: "bg-[var(--cream)]",
};

async function loadPage() {
  if (!hasSupabaseEnv()) return { products: demoProducts, purchases: demoPurchases, reviews: demoProductReviews, pets: demoPets, configured: false, editable: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { products: [], purchases: [], reviews: [], pets: [], configured: true, editable: false };
  const household = await ensureHousehold(supabase, data.user.id);
  const role = await getMyRole(supabase);
  const [commerce, pets] = await Promise.all([listCommerce(supabase, household.id), listPets(supabase, household.id)]);
  return { ...commerce, pets, configured: true, editable: canEdit(role) };
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export default async function ShoppingPage({ searchParams }: { searchParams: Promise<{ saved?: string; review?: string }> }) {
  const [{ products, purchases, reviews, pets, configured, editable }, flags] = await Promise.all([loadPage(), searchParams]);
  const now = new Date();
  const monthPurchases = purchases.filter((item) => { const date = new Date(item.purchased_at); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); });
  const monthTotal = monthPurchases.reduce((sum, item) => sum + item.amount_cents, 0);
  const names = new Map(pets.map((pet) => [pet.id, pet.name]));
  const productNames = new Map(products.map((product) => [product.id, [product.brand, product.name].filter(Boolean).join(" • ")]));
  const insights = products.map((product) => {
    const productPurchases = purchases.filter((item) => item.product_id === product.id).sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime());
    const productReviews = reviews.filter((item) => item.product_id === product.id);
    const latest = productPurchases[0];
    const previous = productPurchases[1];
    const latestUnit = latest ? latest.amount_cents / latest.quantity : 0;
    const previousUnit = previous ? previous.amount_cents / previous.quantity : 0;
    const priceChange = previousUnit ? ((latestUnit - previousUnit) / previousUnit) * 100 : 0;
    return {
      product, latest, priceChange,
      quality: average(productReviews.map((item) => item.quality_score)),
      acceptance: average(productReviews.map((item) => item.acceptance_score)),
      value: average(productReviews.map((item) => item.cost_benefit_score)),
      reviews: productReviews.length,
      buyAgain: productReviews.filter((item) => item.would_buy_again).length,
      latestReview: productReviews[0] ?? null,
    };
  });
  const bestValue = [...insights].filter((item) => item.reviews > 0).sort((a, b) => b.value - a.value)[0];
  const rankedProducts = rankProductRecommendations(products, purchases, reviews);
  const foodRecommendation = bestFoodRecommendation(rankedProducts);
  const litterRecommendation = bestLitterRecommendation(rankedProducts);
  const recommendations = [foodRecommendation, litterRecommendation].filter((item) => item !== null);
  const hasNeonatal = pets.some(isNeonatalPet);
  const hasKittens = pets.some((pet) => getPetLifeStage(pet.birth_date) === "kitten");

  return <div className="mx-auto w-full max-w-[1120px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Casa e consumo</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Compras e avaliações</h1><p className="mt-2 max-w-[680px] text-sm text-[var(--muted)]">Compare preço e aceitação dos produtos. Cada compra registrada vira gasto automaticamente em Gastos da família.</p></div>{editable && <Link href="/shopping/new" className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white"><Plus size={18} /> Registrar compra</Link>}</header>
    {!configured && <div className="mt-6 rounded-[20px] bg-[var(--lavender-soft)] px-4 py-3 text-sm"><strong>Modo de demonstração.</strong> Estes produtos ilustram como suas próprias comparações aparecerão.</div>}
    {flags.saved && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Compra salva, gasto lançado e comparações atualizadas.</div>}
    {flags.review === "partial" && <div className="mt-3 rounded-[20px] bg-[var(--peach)] px-4 py-3 text-sm">A compra foi salva; a avaliação ficou para depois porque faltou uma das três notas.</div>}

    <section className="mt-6 grid gap-3 sm:grid-cols-3">
      <div className="cat-card p-5"><span className="grid size-9 place-items-center rounded-[14px] bg-[var(--lavender-soft)]"><ShoppingBasket size={17} /></span><p className="mt-4 text-xs font-semibold text-[var(--muted)]">Compras neste mês</p><p className="mt-1 text-2xl font-bold tracking-[-0.04em]">{formatCurrency(monthTotal)}</p></div>
      <div className="cat-card p-5"><span className="grid size-9 place-items-center rounded-[14px] bg-[var(--rose-soft)]"><PackageOpen size={17} /></span><p className="mt-4 text-xs font-semibold text-[var(--muted)]">Produtos acompanhados</p><p className="mt-1 text-2xl font-bold tracking-[-0.04em]">{products.length}</p></div>
      <div className="cat-card p-5"><span className="grid size-9 place-items-center rounded-[14px] bg-[var(--mint-soft)]"><BadgeCheck size={17} /></span><p className="mt-4 text-xs font-semibold text-[var(--muted)]">Melhor custo-benefício</p><p className="mt-1 truncate text-lg font-bold">{bestValue ? bestValue.product.name : "Avalie para descobrir"}</p>{bestValue && <p className="mt-1 text-xs text-[var(--muted)]">{bestValue.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/5</p>}</div>
    </section>

    <section className="mt-7 overflow-hidden rounded-[26px] border border-[#d9cfee] bg-[linear-gradient(135deg,var(--lavender-soft),#fff)]">
      <div className="flex flex-col gap-3 border-b border-[#d9cfee] p-5 sm:flex-row sm:items-center sm:justify-between md:p-6"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-[17px] bg-white text-[var(--lavender-strong)]"><Brain size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Recomendação inteligente</p><h2 className="mt-1 text-xl font-bold">O histórico da família escolheria</h2><p className="mt-1 text-xs text-[var(--muted)]">Ranking baseado nas suas notas e recompras — nunca em publicidade.</p></div></div><Link href="/assistant" className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-xs font-bold text-[var(--lavender-strong)]"><Sparkles size={14} /> Perguntar ao assistente</Link></div>
      {recommendations.length === 0 ? <p className="p-6 text-sm text-[var(--muted)]">Avalie ao menos um alimento ou areia para liberar recomendações confiáveis.</p> : <div className="grid gap-px bg-[#d9cfee] md:grid-cols-2">{recommendations.map((recommendation) => <div key={recommendation.product.id} className="bg-white p-5 md:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{recommendation.product.category === "litter" ? "Areia recomendada" : "Alimento recomendado"}</p><h3 className="mt-1 text-lg font-bold">{recommendation.product.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">{recommendation.product.brand || "Sem marca"} • {recommendation.reviewCount} {recommendation.reviewCount === 1 ? "avaliação" : "avaliações"}</p></div><span className="rounded-full bg-[var(--mint-soft)] px-2.5 py-1 text-xs font-bold text-[var(--success)]">{recommendation.score.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/5</span></div><p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">Recomendada por {recommendation.reason}.</p>{recommendation.latest && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold"><Store size={14} /> {formatCurrency(Math.round(recommendation.latest.amount_cents / recommendation.latest.quantity))} por pacote • {recommendation.latest.store_name}</p>}</div>)}</div>}
      {(hasNeonatal || hasKittens) && <p className="border-t border-[#d9cfee] bg-[var(--peach)] px-5 py-3 text-[11px] leading-relaxed text-[var(--muted)]"><strong className="text-[var(--foreground)]">Atenção à fase de vida:</strong> {hasNeonatal ? "as recomendações de ração não se aplicam aos bebês neonatais; mantenha a orientação veterinária para eles. " : ""}{hasKittens ? "Para os filhotes maiores, confira no rótulo se a fórmula é própria para filhotes." : ""}</p>}
    </section>

    <div className="mt-8 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Comparador da família</p><h2 className="mt-1 text-2xl font-bold tracking-[-0.03em]">O que vale repetir</h2></div><span className="hidden text-xs text-[var(--muted)] sm:block">Preço por pacote na compra mais recente</span></div>
    <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{insights.length === 0 ? <div className="cat-card p-6 text-sm text-[var(--muted)]">Registre a primeira compra para iniciar sua comparação.</div> : insights.map(({ product, latest, priceChange, quality, acceptance, value, reviews: reviewCount, buyAgain, latestReview }) => {
      const TrendIcon = priceChange < -0.1 ? ArrowDownRight : priceChange > 0.1 ? ArrowUpRight : Minus;
      const trendTone = priceChange < -0.1 ? "text-[var(--success)]" : priceChange > 0.1 ? "text-[var(--danger)]" : "text-[var(--muted)]";
      return <article key={product.id} className="cat-card overflow-hidden"><div className="p-5"><div className="flex items-start justify-between gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-[17px] ${tones[product.category]}`}><PackageOpen size={20} /></span><span className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-[10px] font-bold">{categoryLabels[product.category]}</span></div><p className="mt-4 text-xs font-semibold text-[var(--muted)]">{product.brand || "Sem marca"}</p><h3 className="mt-0.5 text-lg font-bold">{product.name}</h3><p className="mt-1 text-xs text-[var(--muted)]">{product.package_size || "Tamanho não informado"}</p>
        <div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold text-[var(--muted)]">Último preço por pacote</p><p className="mt-1 text-xl font-bold">{latest ? formatCurrency(Math.round(latest.amount_cents / latest.quantity)) : "—"}</p></div>{latest && <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${trendTone}`}><TrendIcon size={14} />{Math.abs(priceChange).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>}</div>
        {latest && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--muted)]"><Store size={13} /> {latest.store_name} • {channelLabels[latest.channel]}</p>}
      </div>
      <div className="grid grid-cols-3 border-t border-[var(--border)] bg-[var(--cream)]"><div className="p-3 text-center"><p className="text-[10px] text-[var(--muted)]">Qualidade</p><p className="mt-1 text-sm font-bold">{reviewCount ? quality.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</p></div><div className="border-x border-[var(--border)] p-3 text-center"><p className="text-[10px] text-[var(--muted)]">Aceitação</p><p className="mt-1 text-sm font-bold">{reviewCount ? acceptance.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</p></div><div className="p-3 text-center"><p className="text-[10px] text-[var(--muted)]">Custo-benefício</p><p className="mt-1 text-sm font-bold">{reviewCount ? value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "—"}</p></div></div>
      {reviewCount > 0 && <div className="border-t border-[var(--border)] px-5 py-3"><p className="text-[10px] text-[var(--muted)]"><Star size={11} className="mr-1 inline fill-[var(--lavender)] text-[var(--lavender)]" /> {buyAgain} de {reviewCount} avaliações comprariam novamente</p>{editable && latestReview && <Link href={`/shopping/reviews/${latestReview.id}/edit`} className="focus-ring mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[var(--lavender-strong)]"><Pencil size={12} /> Editar avaliação</Link>}</div>}
      {editable && <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-5 py-3"><Link href={`/shopping/products/${product.id}/edit`} className="focus-ring inline-flex items-center gap-1 rounded-xl bg-[var(--lavender-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--lavender-strong)]"><Pencil size={12} /> Editar produto</Link><form action={deleteProduct.bind(null, product.id)}><ConfirmButton message="Apagar este produto e todo o histórico dele?" className="focus-ring inline-flex items-center gap-1 rounded-xl border border-red-200 px-2.5 py-1 text-[10px] font-bold text-[var(--danger)]"><Trash2 size={12} /> Apagar</ConfirmButton></form></div>}
    </article>;})}</section>

    <section className="cat-card mt-8 min-w-0 p-5 md:p-6"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Histórico de preços</p><h2 className="mt-1 text-xl font-bold">Compras recentes</h2><p className="mt-1 text-xs text-[var(--muted)]">Cada compra com gasto vinculado aparece também em Gastos da família.</p></div><Link href="/expenses" className="focus-ring shrink-0 rounded-xl px-2 py-1.5 text-xs font-bold text-[var(--lavender-strong)]">Ver gastos</Link></div><div className="mt-4 grid min-w-0 gap-2.5 lg:grid-cols-2">{purchases.slice(0, 8).map((purchase) => {
      const remove = deletePurchase.bind(null, purchase.id);
      return <div key={purchase.id} className="rounded-[18px] border border-[var(--border)] p-3.5"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[15px] bg-[var(--mint-soft)]"><ShoppingBasket size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{productNames.get(purchase.product_id) || "Produto"}</p>{purchase.expense_id && <span className="rounded-full bg-[var(--mint-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--success)]">Em gastos</span>}</div><p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{formatShortDate(purchase.purchased_at)} • {purchase.store_name} • <PetNameChips petIds={purchase.pet_ids ?? (purchase.pet_id ? [purchase.pet_id] : [])} names={names} /></p></div><strong className="shrink-0 text-sm">{formatCurrency(purchase.amount_cents)}</strong></div>{editable && <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3"><Link href={`/shopping/purchases/${purchase.id}/edit`} className="focus-ring inline-flex items-center gap-1 rounded-xl bg-[var(--lavender-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--lavender-strong)]"><Pencil size={12} /> Editar</Link>{purchase.expense_id && <Link href={`/expenses/${purchase.expense_id}/edit`} className="focus-ring inline-flex items-center gap-1 rounded-xl bg-[var(--mint-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--success)]"><ReceiptText size={12} /> Ver gasto</Link>}<form action={remove}><ConfirmButton message="Apagar esta compra e o gasto vinculado?" className="focus-ring inline-flex items-center gap-1 rounded-xl border border-red-200 px-2.5 py-1 text-[10px] font-bold text-[var(--danger)]"><Trash2 size={12} /> Apagar</ConfirmButton></form></div>}</div>;
    })}</div></section>
  </div>;
}
