import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, ShoppingBasket, Star } from "lucide-react";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { StarRating } from "@/components/star-rating";
import { isUuid } from "@/lib/attachments";
import { findPurchaseProductReviewId, getProduct, getPurchase, loadProductReviewContext } from "@/lib/commerce";
import { existingReviewEditPath } from "@/lib/product-review-link";
import { isProductArchived } from "@/lib/product-lifecycle";
import {
  PRODUCT_ARCHIVED_REVIEW_MESSAGE,
  productPurchaseReviewPath,
  productReviewPath,
  productStandaloneReviewPath,
  resolveProductReviewOrigin,
} from "@/lib/product-review-entry";
import { resolvePurchaseReviewProductId } from "@/lib/purchase-read-model";
import { formatCurrency, formatFullDate, formatShortDate } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { listPets } from "@/lib/pets";
import { isLiveData } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";
import { createProductReview, createStandaloneProductReview } from "../../actions";

const scoreFields = [
  { name: "quality_score", legend: "Qualidade" },
  { name: "acceptance_score", legend: "Aceitação dos pets" },
  { name: "cost_benefit_score", legend: "Custo-benefício" },
] as const;

type PetOption = { id: string; name: string };

function Message({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">{children}</div>;
}

function BackLink() {
  return (
    <Link href="/shopping" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
      <ArrowLeft size={17} /> Voltar às compras
    </Link>
  );
}

function ReviewHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <Star size={20} className="text-[var(--lavender-strong)]" />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">{eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em]">{title}</h1>
        {subtitle && <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p>}
      </div>
    </div>
  );
}

function ReviewFields({ pets, defaultPetIds }: { pets: PetOption[]; defaultPetIds: string[] }) {
  return (
    <>
      <p className="text-xs text-[var(--muted)]">As três notas alimentam o comparador da família e liberam recomendações.</p>
      <div className="grid gap-5 sm:grid-cols-3">
        {scoreFields.map((field) => (
          <StarRating key={field.name} name={field.name} legend={field.legend} required />
        ))}
      </div>
      <PetMultiSelect
        pets={pets}
        defaultSelectedIds={defaultPetIds}
        required={false}
        legend="Quais pets avaliaram?"
        hint="Opcional — quem experimentou o produto."
      />
      <label className="flex items-center gap-3 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold">
        <input type="checkbox" name="would_buy_again" className="size-4 accent-[var(--lavender)]" /> Eu compraria novamente
      </label>
      <label className="block text-sm font-bold">
        Comentário
        <textarea name="review_notes" rows={3} className="field mt-2 resize-none" placeholder="Rendimento, cheiro, textura, reação dos pets..." />
      </label>
      <button className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white">
        Salvar avaliação
      </button>
    </>
  );
}

/** Product-level entry: standalone, the single eligible Purchase, or an explicit choice. */
async function ProductReviewEntry({
  supabase,
  householdId,
  productId,
  standalone,
  error,
  pets,
}: {
  supabase: SupabaseClient;
  householdId: string;
  productId: string;
  standalone: boolean;
  error?: string;
  pets: PetOption[];
}) {
  if (!isUuid(productId)) return <Message>Produto não encontrado.</Message>;
  const product = await getProduct(supabase, householdId, productId);
  if (!product) return <Message>Produto não encontrado.</Message>;
  if (isProductArchived(product)) {
    return (
      <Message>
        {PRODUCT_ARCHIVED_REVIEW_MESSAGE}{" "}
        <Link href={`/shopping/products/${productId}/edit`} className="font-bold underline">Abrir produto</Link>
      </Message>
    );
  }

  const context = await loadProductReviewContext(supabase, householdId, productId);
  const origin = resolveProductReviewOrigin(productId, context.purchases, context.linkedReviews);
  if (!standalone && origin.kind === "single") {
    redirect(productPurchaseReviewPath(origin.candidate.purchase.id, productId));
  }

  const petNames = new Map(pets.map((pet) => [pet.id, pet.name]));
  const productTitle = [product.brand, product.name].filter(Boolean).join(" • ") || product.name;

  if (!standalone && origin.kind === "choose") {
    return (
      <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
        <BackLink />
        <ReviewHeader eyebrow="Avaliar produto" title={product.name} />
        {error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        <section className="cat-card mt-6 p-5 md:p-7">
          <h2 className="text-lg font-bold">Qual compra você quer avaliar?</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Este produto aparece em mais de uma compra ainda sem avaliação. Escolha a compra ou faça uma avaliação geral.</p>
          <div className="mt-4 grid gap-2.5">
            {origin.candidates.map(({ purchase, line }) => {
              const lineAmount = purchase.lines.length === 1
                ? formatCurrency(purchase.amount_cents)
                : `${formatCurrency(line.line_subtotal_cents)} neste item • compra com ${purchase.lines.length} itens`;
              const petLabel = line.effective_pet_ids.map((id) => petNames.get(id)).filter(Boolean).join(", ");
              return (
                <Link
                  key={purchase.id}
                  href={productPurchaseReviewPath(purchase.id, productId)}
                  className="focus-ring flex items-center gap-3 rounded-[18px] border border-[var(--border)] p-3.5 hover:bg-[var(--cream)]"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-[15px] bg-[var(--mint-soft)]"><ShoppingBasket size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{formatFullDate(purchase.purchased_at)} • {purchase.store_name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
                      {[line.brand, line.product_name].filter(Boolean).join(" • ")} • {lineAmount}{petLabel ? ` • ${petLabel}` : ""}
                    </span>
                  </span>
                </Link>
              );
            })}
            <Link
              href={productStandaloneReviewPath(productId)}
              className="focus-ring flex items-center gap-3 rounded-[18px] border border-dashed border-[var(--border)] p-3.5 hover:bg-[var(--cream)]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-[15px] bg-[var(--lavender-soft)]"><Star size={17} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Avaliação geral do produto</span>
                <span className="mt-0.5 block text-[11px] text-[var(--muted)]">Sem relacionar a uma compra específica.</span>
              </span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const hasEligiblePurchase = origin.kind !== "standalone";
  const save = createStandaloneProductReview.bind(null, productId);
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <BackLink />
      <ReviewHeader eyebrow="Avaliação geral do produto" title={product.name} subtitle={productTitle !== product.name ? productTitle : undefined} />
      {error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <div className="mt-6 rounded-[20px] bg-[var(--lavender-soft)] px-4 py-3 text-sm">
        Esta avaliação não fica relacionada a nenhuma compra.
        {hasEligiblePurchase && <> <Link href={productReviewPath(productId)} className="font-bold underline">Relacionar a uma compra</Link></>}
      </div>
      <form action={save} className="cat-card mt-6 space-y-5 p-5 md:p-7">
        <input type="hidden" name="review_id" value={crypto.randomUUID()} />
        <ReviewFields pets={pets} defaultPetIds={[]} />
      </form>
    </div>
  );
}

export default async function NewReviewPage({ searchParams }: { searchParams: Promise<{ purchase?: string; product?: string; origin?: string; from?: string; error?: string }> }) {
  const flags = await searchParams;
  if (!(await isLiveData())) return <Message>Modo demonstração.</Message>;
  if (!flags.purchase && !flags.product) return <Message>Escolha um produto ou uma compra para avaliar.</Message>;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <Message>Entre na conta.</Message>;

  const household = await ensureHousehold(supabase, data.user.id);
  const petRows = await listPets(supabase, household.id);
  const pets = petRows.map((pet) => ({ id: pet.id, name: pet.name }));

  if (!flags.purchase) {
    return (
      <ProductReviewEntry
        supabase={supabase}
        householdId={household.id}
        productId={flags.product as string}
        standalone={flags.origin === "standalone"}
        error={flags.error}
        pets={pets}
      />
    );
  }

  const purchase = await getPurchase(supabase, household.id, flags.purchase);
  if (!purchase) return <Message>Compra não encontrada.</Message>;

  const target = resolvePurchaseReviewProductId(purchase, flags.product ?? null);
  if (!target.ok) return <Message>{target.error}</Message>;
  const existingReviewId = await findPurchaseProductReviewId(supabase, household.id, purchase.id, target.productId);
  if (existingReviewId) redirect(existingReviewEditPath(existingReviewId));

  const product = await getProduct(supabase, household.id, target.productId);
  const save = createProductReview.bind(null, purchase.id);
  const defaultPetIds = purchase.pet_ids ?? (purchase.pet_id ? [purchase.pet_id] : []);
  const offerStandalone = flags.from === "product" && product != null && !isProductArchived(product);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <BackLink />
      <ReviewHeader
        eyebrow="Avaliar compra"
        title={product?.name ?? "Produto"}
        subtitle={`${formatShortDate(purchase.purchased_at)} • ${purchase.store_name} • ${formatCurrency(purchase.amount_cents)}`}
      />

      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

      <div className="mt-6 rounded-[20px] bg-[var(--lavender-soft)] px-4 py-3 text-sm">
        Esta avaliação será relacionada à compra de {formatFullDate(purchase.purchased_at)} na {purchase.store_name}.
        {offerStandalone && <> <Link href={productStandaloneReviewPath(target.productId)} className="font-bold underline">Avaliar sem relacionar a uma compra</Link></>}
      </div>

      <form action={save} className="cat-card mt-6 space-y-5 p-5 md:p-7">
        <input type="hidden" name="product_id" value={target.productId} />
        <ReviewFields pets={pets} defaultPetIds={defaultPetIds} />
      </form>
    </div>
  );
}
