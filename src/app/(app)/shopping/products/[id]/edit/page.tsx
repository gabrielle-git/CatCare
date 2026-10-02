import Link from "next/link";
import { Archive, ArchiveRestore, ArrowLeft, PackageOpen, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { getProduct, loadProductHistoryRefs } from "@/lib/commerce";
import { ensureHousehold } from "@/lib/households";
import { isLiveData } from "@/lib/demo-mode";
import { PRODUCT_DELETE_HISTORY_MESSAGE, productHasCommerceHistory } from "@/lib/product-delete-guard";
import { isProductArchived, productLifecycleOptions } from "@/lib/product-lifecycle";
import { createClient } from "@/lib/supabase/server";
import { archiveProduct, deleteProduct, restoreProduct, updateProduct } from "../../../actions";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; blocked?: string }> }) {
  const { id } = await params;
  const flags = await searchParams;
  if (!(await isLiveData())) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Modo demonstração.</div>;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Entre na conta.</div>;

  const household = await ensureHousehold(supabase, data.user.id);
  const product = await getProduct(supabase, household.id, id);
  if (!product) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Produto não encontrado.</div>;

  const archived = isProductArchived(product);
  const hasHistory = productHasCommerceHistory(await loadProductHistoryRefs(supabase, household.id, id));
  const lifecycle = productLifecycleOptions({ archived, hasHistory });

  const save = updateProduct.bind(null, id);
  const remove = deleteProduct.bind(null, id);
  const archive = archiveProduct.bind(null, id);
  const restore = restoreProduct.bind(null, id);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/shopping" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar às compras</Link>
      <div className="mt-4 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[18px] bg-[var(--mint-soft)]"><PackageOpen size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Editar produto</p><h1 className="text-3xl font-bold tracking-[-0.04em]">{product.name}</h1></div></div>
      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
      {flags.blocked === "history" && <div className="mt-6 rounded-[20px] bg-[var(--peach)] px-4 py-3 text-sm">{PRODUCT_DELETE_HISTORY_MESSAGE} {lifecycle.canArchive ? "Use «Arquivar produto» abaixo para tirá-lo do catálogo sem perder o histórico." : ""}</div>}
      {archived && <div className="mt-6 rounded-[20px] bg-[var(--cream)] px-4 py-3 text-sm">Este produto está arquivado: não aparece no catálogo, em novas compras nem nas recomendações. Compras e avaliações antigas continuam no histórico.</div>}
      <form action={save} className="cat-card mt-6 space-y-5 p-5 md:p-7">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Nome<input required name="product_name" defaultValue={product.name} className="field mt-2" /></label><label className="text-sm font-bold">Marca<input name="brand" defaultValue={product.brand ?? ""} className="field mt-2" /></label><label className="text-sm font-bold">Categoria<select name="category" defaultValue={product.category} className="field mt-2"><option value="dry_food">Ração seca</option><option value="wet_food">Sachê / alimento úmido</option><option value="litter">Areia</option><option value="treat">Petisco</option><option value="hygiene">Higiene</option><option value="medicine">Medicamento</option><option value="accessory">Acessório</option><option value="other">Outro</option></select></label><label className="text-sm font-bold">Tamanho da embalagem<input name="package_size" defaultValue={product.package_size ?? ""} className="field mt-2" /></label></div>
        <label className="block text-sm font-bold">Notas<textarea name="product_notes" rows={3} defaultValue={product.notes ?? ""} className="field mt-2 resize-none" /></label>
        <button className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white">Salvar produto</button>
      </form>
      {lifecycle.canRestore && (
        <section className="mt-5 rounded-[22px] border border-[var(--border)] bg-white p-5">
          <h2 className="font-bold">Restaurar produto</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Ele volta ao catálogo, às novas compras e às recomendações, com o mesmo histórico.</p>
          <form action={restore} className="mt-4"><button type="submit" className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-xs font-bold text-[var(--success)]"><ArchiveRestore size={15} /> Restaurar produto</button></form>
        </section>
      )}
      {lifecycle.canArchive && hasHistory && (
        <section className="mt-5 rounded-[22px] border border-[var(--border)] bg-white p-5">
          <h2 className="font-bold">Arquivar produto</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Este produto tem compras ou avaliações, então não pode ser apagado. Arquivar tira ele do catálogo e das novas compras; o histórico continua visível e você pode restaurar quando quiser.</p>
          <form action={archive} className="mt-4"><ConfirmButton message="Arquivar este produto? Ele sai do catálogo e das novas compras; compras e avaliações antigas continuam no histórico." className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-3 text-xs font-bold text-[var(--muted)]"><Archive size={15} /> Arquivar produto</ConfirmButton></form>
        </section>
      )}
      {lifecycle.canHardDelete && (
        <section className="mt-5 rounded-[22px] border border-red-100 bg-white p-5">
          <h2 className="font-bold">Apagar definitivamente</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Este produto não tem compras nem avaliações. Apagar remove o cadastro e não pode ser desfeito.</p>
          <form action={remove} className="mt-4"><ConfirmButton message="Apagar definitivamente este produto? Esta ação não pode ser desfeita." className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-bold text-[var(--danger)]"><Trash2 size={15} /> Apagar definitivamente</ConfirmButton></form>
        </section>
      )}
    </div>
  );
}
