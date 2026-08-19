import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { StarRating } from "@/components/star-rating";
import { getProduct, getPurchase } from "@/lib/commerce";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createProductReview } from "../../actions";

const scoreFields = [
  { name: "quality_score", legend: "Qualidade" },
  { name: "acceptance_score", legend: "Aceitação dos pets" },
  { name: "cost_benefit_score", legend: "Custo-benefício" },
] as const;

export default async function NewReviewPage({ searchParams }: { searchParams: Promise<{ purchase?: string; error?: string }> }) {
  const flags = await searchParams;
  if (!hasSupabaseEnv()) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Modo demonstração.</div>;
  if (!flags.purchase) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Informe a compra para avaliar.</div>;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Entre na conta.</div>;

  const household = await ensureHousehold(supabase, data.user.id);
  const [purchase, pets] = await Promise.all([
    getPurchase(supabase, household.id, flags.purchase),
    listPets(supabase, household.id),
  ]);
  if (!purchase) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Compra não encontrada.</div>;

  const product = await getProduct(supabase, household.id, purchase.product_id);
  const save = createProductReview.bind(null, purchase.id);
  const defaultPetIds = purchase.pet_ids ?? (purchase.pet_id ? [purchase.pet_id] : []);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/shopping" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Voltar às compras
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <Star size={20} className="text-[var(--lavender-strong)]" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Avaliar compra</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">{product?.name ?? "Produto"}</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatShortDate(purchase.purchased_at)} • {purchase.store_name} • {formatCurrency(purchase.amount_cents)}
          </p>
        </div>
      </div>

      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

      <form action={save} className="cat-card mt-6 space-y-5 p-5 md:p-7">
        <p className="text-xs text-[var(--muted)]">As três notas alimentam o comparador da família e liberam recomendações.</p>
        <div className="grid gap-5 sm:grid-cols-3">
          {scoreFields.map((field) => (
            <StarRating key={field.name} name={field.name} legend={field.legend} required />
          ))}
        </div>
        <PetMultiSelect
          pets={pets.map((pet) => ({ id: pet.id, name: pet.name }))}
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
      </form>
    </div>
  );
}
