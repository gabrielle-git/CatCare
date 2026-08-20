import Link from "next/link";
import { ArrowLeft, ShoppingBasket, Star } from "lucide-react";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { StarRating } from "@/components/star-rating";
import { listActiveMembershipsForShopping, membershipLabel } from "@/lib/benefit-memberships";
import { listCommerce } from "@/lib/commerce";
import { ensureHousehold } from "@/lib/households";
import { demoBenefitMemberships, demoPets, demoProducts } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createPurchase } from "../actions";

async function loadForm() {
  if (!hasSupabaseEnv()) {
    return {
      products: demoProducts,
      pets: demoPets,
      memberships: demoBenefitMemberships.filter((item) => item.active),
      configured: false,
    };
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { products: [], pets: [], memberships: [], configured: true };
  const household = await ensureHousehold(supabase, data.user.id);
  const [{ products }, pets, memberships] = await Promise.all([
    listCommerce(supabase, household.id),
    listPets(supabase, household.id),
    listActiveMembershipsForShopping(supabase, household.id),
  ]);
  return { products, pets, memberships, configured: true };
}

const scoreFields = [
  { name: "quality_score", legend: "Qualidade" },
  { name: "acceptance_score", legend: "Aceitação dos pets" },
  { name: "cost_benefit_score", legend: "Custo-benefício" },
] as const;

export default async function NewPurchasePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ products, pets, memberships, configured }, flags] = await Promise.all([loadForm(), searchParams]);
  return <div className="mx-auto w-full max-w-[820px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
    <Link href="/shopping" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar às compras</Link>
    <div className="mt-4 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[18px] bg-[var(--mint-soft)]"><ShoppingBasket size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Preço + experiência</p><h1 className="text-3xl font-bold tracking-[-0.04em]">Registrar compra</h1></div></div>
    <p className="mt-3 text-sm text-[var(--muted)]">Uma única entrada atualiza a comparação de preços e também cria o gasto correspondente.</p>
    {!configured && <div className="mt-6 rounded-[20px] bg-[var(--peach)] px-4 py-3 text-sm">O formulário está visível para comparação. <Link href="/login" className="font-bold underline">Conecte uma conta</Link> para salvar.</div>}
    {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

    <form action={createPurchase} className="mt-6 space-y-5">
      <section className="cat-card p-5 md:p-7"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">1. Produto</p><h2 className="mt-1 text-xl font-bold">O que você comprou?</h2>
        <label className="mt-5 block text-sm font-bold">Usar um produto já acompanhado<select disabled={!configured} name="product_id" className="field mt-2"><option value="">Cadastrar um produto novo</option>{products.map((product) => <option key={product.id} value={product.id}>{product.brand ? `${product.brand} • ` : ""}{product.name}{product.package_size ? ` — ${product.package_size}` : ""}</option>)}</select></label>
        <div className="mt-4 rounded-[20px] bg-[var(--cream)] p-4"><p className="text-xs font-bold">Se for um produto novo</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Nome<input disabled={!configured} name="product_name" className="field mt-2" placeholder="Ex.: Sachê de frango" /></label><label className="text-sm font-bold">Marca<input disabled={!configured} name="brand" className="field mt-2" placeholder="Ex.: GranPlus" /></label><label className="text-sm font-bold">Categoria<select disabled={!configured} name="category" className="field mt-2"><option value="dry_food">Ração seca</option><option value="wet_food">Sachê / alimento úmido</option><option value="litter">Areia</option><option value="treat">Petisco</option><option value="hygiene">Higiene</option><option value="medicine">Medicamento</option><option value="accessory">Acessório</option><option value="other">Outro</option></select></label><label className="text-sm font-bold">Tamanho da embalagem<input disabled={!configured} name="package_size" className="field mt-2" placeholder="Ex.: 3 kg ou 85 g" /></label></div></div>
      </section>

      <section className="cat-card p-5 md:p-7"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">2. Compra</p><h2 className="mt-1 text-xl font-bold">Preço e onde encontrou</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Loja ou vendedor<input disabled={!configured} required name="store_name" className="field mt-2" placeholder="Ex.: Cobasi" /></label><label className="text-sm font-bold">Canal<select disabled={!configured} required name="channel" className="field mt-2"><option value="physical_store">Loja física</option><option value="online_store">Loja online</option><option value="marketplace">Marketplace</option><option value="delivery">Aplicativo / delivery</option><option value="veterinary">Clínica veterinária</option><option value="other">Outro</option></select></label><label className="text-sm font-bold">Valor pago (R$)<input disabled={!configured} required name="amount" type="number" min="0" step="0.01" inputMode="decimal" className="field mt-2" placeholder="0,00" /></label><label className="text-sm font-bold">Quantidade de pacotes<input disabled={!configured} required name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" className="field mt-2" /></label><label className="text-sm font-bold">Data<input disabled={!configured} required name="purchased_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="field mt-2" /></label></div>
        <div className="mt-4 rounded-[20px] bg-[var(--cream)] p-4">
          <p className="text-xs font-bold">Cupom e desconto (opcional)</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">Valor antes do desconto (R$)<input disabled={!configured} name="subtotal" type="number" min="0" step="0.01" inputMode="decimal" className="field mt-2" placeholder="Se souber o preço de tabela" /></label>
            <label className="text-sm font-bold">Desconto (R$)<input disabled={!configured} name="discount" type="number" min="0" step="0.01" inputMode="decimal" className="field mt-2" placeholder="0,00" /></label>
            <label className="text-sm font-bold sm:col-span-2">Código do cupom<input disabled={!configured} name="coupon_code" className="field mt-2" placeholder="Ex.: PETLOVE10" /></label>
            {memberships.length > 0 ? (
              <label className="text-sm font-bold sm:col-span-2">
                Desconto de assinatura (opcional)
                <select disabled={!configured} name="membership_id" className="field mt-2" defaultValue="">
                  <option value="">Nenhuma assinatura</option>
                  {memberships.map((item) => (
                    <option key={item.id} value={item.id}>{membershipLabel(item)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="sm:col-span-2 text-xs text-[var(--muted)]">
                Cadastre clubes em <Link href="/health-plan" className="font-bold underline">Plano de saúde</Link> para vincular descontos de assinatura.
              </p>
            )}
          </div>
        </div>
        <div className="mt-4"><PetMultiSelect pets={pets.map((pet) => ({ id: pet.id, name: pet.name }))} defaultSelectedIds={[]} disabled={!configured} required={false} legend="Para quem?" hint="Opcional — um, vários pets ou nenhum (casa toda)." /></div>
        <label className="mt-4 block text-sm font-bold">Link do produto<input disabled={!configured} name="product_url" type="url" className="field mt-2" placeholder="https://... (opcional)" /></label>
      </section>

      <section className="cat-card p-5 md:p-7"><div className="flex items-center gap-2"><Star size={18} className="text-[var(--lavender-strong)]" /><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">3. Avaliação opcional</p><h2 className="mt-1 text-xl font-bold">Valeu a pena?</h2></div></div><p className="mt-2 text-xs text-[var(--muted)]">Preencha as três notas quando já tiver uma opinião; senão, avalie depois.</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">{scoreFields.map((field) => <StarRating key={field.name} name={field.name} legend={field.legend} allowEmpty disabled={!configured} />)}</div>
        <label className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold"><input disabled={!configured} type="checkbox" name="would_buy_again" className="size-4 accent-[var(--lavender)]" /> Eu compraria novamente</label>
        <label className="mt-4 block text-sm font-bold">Comentário da avaliação<textarea disabled={!configured} name="review_notes" rows={3} className="field mt-2 resize-none" placeholder="Rendimento, cheiro, textura, reação dos pets..." /></label>
      </section>
      <button disabled={!configured} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-4 text-sm font-bold text-white"><ShoppingBasket size={18} /> Salvar compra e atualizar comparações</button>
    </form>
  </div>;
}
