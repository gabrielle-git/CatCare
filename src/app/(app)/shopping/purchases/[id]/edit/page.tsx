import Link from "next/link";
import { ArrowLeft, ShoppingBasket, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { getProduct, getPurchase } from "@/lib/commerce";
import { ensureHousehold } from "@/lib/households";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { deletePurchase, updatePurchase } from "../../../actions";

export default async function EditPurchasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const flags = await searchParams;
  if (!hasSupabaseEnv()) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Modo demonstração.</div>;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Entre na conta.</div>;

  const household = await ensureHousehold(supabase, data.user.id);
  const [purchase, product, pets] = await Promise.all([
    getPurchase(supabase, household.id, id),
    getPurchase(supabase, household.id, id).then(async (row) => row ? getProduct(supabase, household.id, row.product_id) : null),
    listPets(supabase, household.id),
  ]);
  if (!purchase || !product) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Compra não encontrada.</div>;

  const save = updatePurchase.bind(null, id);
  const remove = deletePurchase.bind(null, id);

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/shopping" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar às compras</Link>
      <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Editar compra</p><h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">{product.name}</h1></div>
      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
      <form action={save} className="cat-card mt-6 space-y-5 p-5 md:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Loja ou vendedor<input required name="store_name" defaultValue={purchase.store_name} className="field mt-2" /></label>
          <label className="text-sm font-bold">Canal<select required name="channel" defaultValue={purchase.channel} className="field mt-2"><option value="physical_store">Loja física</option><option value="online_store">Loja online</option><option value="marketplace">Marketplace</option><option value="delivery">Aplicativo / delivery</option><option value="veterinary">Clínica veterinária</option><option value="other">Outro</option></select></label>
          <label className="text-sm font-bold">Valor total (R$)<input required name="amount" type="number" min="0" step="0.01" defaultValue={(purchase.amount_cents / 100).toFixed(2)} className="field mt-2" /></label>
          <label className="text-sm font-bold">Quantidade de pacotes<input required name="quantity" type="number" min="0.01" step="0.01" defaultValue={purchase.quantity} className="field mt-2" /></label>
          <label className="text-sm font-bold">Data<input required name="purchased_on" type="date" defaultValue={purchase.purchased_at.slice(0, 10)} className="field mt-2" /></label>
          <label className="text-sm font-bold">Para quem?<select name="pet_id" defaultValue={purchase.pet_id ?? ""} className="field mt-2"><option value="">Todos / casa</option>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>
        </div>
        <label className="block text-sm font-bold">Link do produto<input name="product_url" type="url" defaultValue={purchase.product_url ?? ""} className="field mt-2" /></label>
        <label className="block text-sm font-bold">Observações<textarea name="purchase_notes" rows={3} defaultValue={purchase.notes ?? ""} className="field mt-2 resize-none" /></label>
        <button className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-4 text-sm font-bold text-white"><ShoppingBasket size={18} /> Salvar alterações</button>
      </form>
      <section className="mt-5 rounded-[22px] border border-red-100 bg-white p-5">
        <h2 className="font-bold">Apagar compra</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Remove a compra e o gasto vinculado, se existir.</p>
        <form action={remove} className="mt-4"><ConfirmButton message="Apagar esta compra permanentemente?" className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-bold text-[var(--danger)]"><Trash2 size={15} /> Apagar compra</ConfirmButton></form>
      </section>
    </div>
  );
}
