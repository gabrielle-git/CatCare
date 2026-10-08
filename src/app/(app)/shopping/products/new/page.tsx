import Link from "next/link";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { CreateProductForm } from "@/components/create-product-form";
import { isLiveData } from "@/lib/demo-mode";
import { createProduct } from "../../actions";

export default async function NewProductPage() {
  const configured = await isLiveData();
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/shopping" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Voltar às compras
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[18px] bg-[var(--lavender-soft)]">
          <PackagePlus size={20} />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Catálogo</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">Cadastrar produto</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Produto é o item que você acompanha. Compras registram quando, onde e por quanto ele foi comprado.
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Aqui você cadastra só o item — nenhum gasto é lançado. Para registrar data, loja e preço, use{" "}
        <Link href="/shopping/new" className="font-bold underline">Registrar compra</Link>.
      </p>
      <CreateProductForm action={createProduct} configured={configured} />
    </div>
  );
}
