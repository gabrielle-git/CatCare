import Link from "next/link";
import { ArrowLeft, ReceiptText, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { getExpense } from "@/lib/commerce";
import { ensureHousehold } from "@/lib/households";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { deleteExpense, updateExpense } from "../../actions";

export default async function EditExpensePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const flags = await searchParams;
  if (!hasSupabaseEnv()) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Modo demonstração.</div>;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Entre na conta.</div>;

  const household = await ensureHousehold(supabase, data.user.id);
  const [expense, pets] = await Promise.all([getExpense(supabase, household.id, id), listPets(supabase, household.id)]);
  if (!expense) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Gasto não encontrado.</div>;

  const save = updateExpense.bind(null, id);
  const remove = deleteExpense.bind(null, id);
  const amount = (expense.amount_cents / 100).toFixed(2);
  const date = expense.occurred_at.slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/expenses" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar aos gastos</Link>
      <div className="mt-4 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[18px] bg-[var(--lavender-soft)]"><ReceiptText size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Editar gasto</p><h1 className="text-3xl font-bold tracking-[-0.04em]">{expense.description}</h1></div></div>
      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
      {expense.purchase_id && (
        <div className="mt-6 rounded-[20px] border border-[#cfe8d8] bg-[var(--mint-soft)] px-4 py-3 text-sm leading-relaxed">
          Este gasto veio de uma <strong>compra registrada</strong>. Valor, data e pets ficam sincronizados com{" "}
          <Link href={`/shopping/purchases/${expense.purchase_id}/edit`} className="font-bold text-[var(--success)] underline">Compras e avaliações</Link>.
        </div>
      )}
      <form action={save} className="cat-card mt-6 space-y-5 p-5 md:p-7">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Descrição<input required name="description" defaultValue={expense.description} className="field mt-2" /></label><label className="text-sm font-bold">Valor total (R$)<input required name="amount" type="number" min="0" step="0.01" defaultValue={amount} className="field mt-2" /></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Categoria<select required name="category" defaultValue={expense.category} className="field mt-2"><option value="veterinary">Veterinário</option><option value="food">Alimentação</option><option value="medication">Medicamentos</option><option value="hygiene">Higiene</option><option value="accessory">Acessórios</option><option value="transport">Transporte</option><option value="other">Outros</option></select></label><label className="text-sm font-bold">Data<input required name="occurred_on" type="date" defaultValue={date} className="field mt-2" /></label></div>
        <PetMultiSelect pets={pets.map((pet) => ({ id: pet.id, name: pet.name }))} defaultSelectedIds={expense.pet_ids ?? (expense.pet_id ? [expense.pet_id] : [])} required={false} legend="Pets relacionados" hint="Opcional — escolha um ou mais pets." />
        <label className="block text-sm font-bold">Observações<textarea name="notes" rows={3} defaultValue={expense.notes ?? ""} className="field mt-2 resize-none" /></label>
        <button className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white"><ReceiptText size={17} /> Salvar alterações</button>
      </form>
      <section className="mt-5 rounded-[22px] border border-red-100 bg-white p-5">
        <h2 className="font-bold">Apagar gasto</h2>
        <form action={remove} className="mt-4"><ConfirmButton message={expense.purchase_id ? "Apagar este gasto e a compra vinculada em Compras?" : "Apagar este gasto permanentemente?"} className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-bold text-[var(--danger)]"><Trash2 size={15} /> Apagar gasto</ConfirmButton></form>
      </section>
    </div>
  );
}
