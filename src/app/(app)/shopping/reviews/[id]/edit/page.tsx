import Link from "next/link";
import { ArrowLeft, Star, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { getProduct, getProductReview } from "@/lib/commerce";
import { ensureHousehold } from "@/lib/households";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { deleteProductReview, updateProductReview } from "../../../actions";

const scoreOptions = [1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>);

export default async function EditReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const flags = await searchParams;
  if (!hasSupabaseEnv()) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Modo demonstração.</div>;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Entre na conta.</div>;

  const household = await ensureHousehold(supabase, data.user.id);
  const [review, pets] = await Promise.all([
    getProductReview(supabase, household.id, id),
    listPets(supabase, household.id),
  ]);
  if (!review) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Avaliação não encontrada.</div>;
  const product = await getProduct(supabase, household.id, review.product_id);

  const save = updateProductReview.bind(null, id);
  const remove = deleteProductReview.bind(null, id);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/shopping" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar às compras</Link>
      <div className="mt-4 flex items-center gap-3"><Star size={20} className="text-[var(--lavender-strong)]" /><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Editar avaliação</p><h1 className="text-3xl font-bold tracking-[-0.04em]">{product?.name ?? "Produto"}</h1></div></div>
      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
      <form action={save} className="cat-card mt-6 space-y-5 p-5 md:p-7">
        <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-bold">Qualidade<select required name="quality_score" defaultValue={review.quality_score} className="field mt-2">{scoreOptions}</select></label><label className="text-sm font-bold">Aceitação<select required name="acceptance_score" defaultValue={review.acceptance_score} className="field mt-2">{scoreOptions}</select></label><label className="text-sm font-bold">Custo-benefício<select required name="cost_benefit_score" defaultValue={review.cost_benefit_score} className="field mt-2">{scoreOptions}</select></label></div>
        <PetMultiSelect pets={pets.map((pet) => ({ id: pet.id, name: pet.name }))} defaultSelectedIds={review.pet_ids ?? (review.pet_id ? [review.pet_id] : [])} required={false} legend="Quais gatos avaliaram?" hint="Opcional — quem experimentou o produto." />
        <label className="flex items-center gap-3 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold"><input type="checkbox" name="would_buy_again" defaultChecked={review.would_buy_again} className="size-4 accent-[var(--lavender)]" /> Eu compraria novamente</label>
        <label className="block text-sm font-bold">Comentário<textarea name="review_notes" rows={3} defaultValue={review.notes ?? ""} className="field mt-2 resize-none" /></label>
        <button className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white">Salvar avaliação</button>
      </form>
      <section className="mt-5 rounded-[22px] border border-red-100 bg-white p-5">
        <form action={remove}><ConfirmButton message="Apagar esta avaliação?" className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-bold text-[var(--danger)]"><Trash2 size={15} /> Apagar avaliação</ConfirmButton></form>
      </section>
    </div>
  );
}
