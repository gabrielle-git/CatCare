import Link from "next/link";
import { ArrowLeft, ShoppingBasket } from "lucide-react";
import { CreatePurchaseForm } from "@/components/create-purchase-form";
import { listActiveMembershipsForShopping } from "@/lib/benefit-memberships";
import { listCommerce } from "@/lib/commerce";
import { ensureHousehold } from "@/lib/households";
import { demoBenefitMemberships, demoPets, demoProducts } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { isLiveData } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";
import { createPurchase } from "../actions";

async function loadForm() {
  if (!(await isLiveData())) {
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

export default async function NewPurchasePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ products, pets, memberships, configured }, flags] = await Promise.all([loadForm(), searchParams]);
  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/shopping" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Voltar às compras
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[18px] bg-[var(--mint-soft)]">
          <ShoppingBasket size={20} />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Preço + experiência</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">Registrar compra</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">Uma única entrada atualiza a comparação de preços e também cria o gasto correspondente.</p>
      <CreatePurchaseForm
        action={createPurchase}
        products={products}
        pets={pets.map((pet) => ({ id: pet.id, name: pet.name }))}
        memberships={memberships}
        configured={configured}
        initialError={flags.error}
      />
    </div>
  );
}
