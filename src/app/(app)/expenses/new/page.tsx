import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { PetMultiSelect } from "@/components/pet-multi-select";
import { ensureHousehold } from "@/lib/households";
import { demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createExpense } from "../actions";

async function loadPetsForForm() {
  if (!hasSupabaseEnv()) return { pets: demoPets, configured: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], configured: true };
  const household = await ensureHousehold(supabase, data.user.id);
  return { pets: await listPets(supabase, household.id), configured: true };
}

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ pets, configured }, flags] = await Promise.all([loadPetsForForm(), searchParams]);
  return <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
    <Link href="/expenses" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar aos gastos</Link>
    <div className="mt-4 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[18px] bg-[var(--lavender-soft)]"><ReceiptText size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Novo lançamento</p><h1 className="text-3xl font-bold tracking-[-0.04em]">Adicionar gasto</h1></div></div>
    {!configured && <div className="mt-6 rounded-[20px] bg-[var(--peach)] px-4 py-3 text-sm">O formulário está visível para comparação. <Link href="/login" className="font-bold underline">Conecte uma conta</Link> para salvar de verdade.</div>}
    {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
    <form action={createExpense} className="cat-card mt-6 space-y-5 p-5 md:p-7">
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Descrição<input disabled={!configured} required name="description" className="field mt-2" placeholder="Ex.: Consulta de retorno" /></label><label className="text-sm font-bold">Valor total (R$)<input disabled={!configured} required name="amount" type="number" min="0" step="0.01" inputMode="decimal" className="field mt-2" placeholder="0,00" /></label></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Categoria<select disabled={!configured} required name="category" className="field mt-2"><option value="veterinary">Veterinário</option><option value="food">Alimentação</option><option value="medication">Medicamentos</option><option value="hygiene">Higiene</option><option value="accessory">Acessórios</option><option value="transport">Transporte</option><option value="other">Outros</option></select></label><label className="text-sm font-bold">Data<input disabled={!configured} required name="occurred_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="field mt-2" /></label></div>
      <PetMultiSelect pets={pets.map((pet) => ({ id: pet.id, name: pet.name }))} defaultSelectedIds={[]} disabled={!configured} required={false} legend="Gatinhos relacionados" hint="Opcional — escolha um ou mais gatinhos. Vários selecionados viram gasto compartilhado." />
      <label className="flex items-center gap-3 rounded-2xl bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold"><input disabled={!configured} type="checkbox" name="shared" className="size-4 accent-[var(--lavender)]" /> Este gasto é compartilhado entre os gatos</label>
      <label className="block text-sm font-bold">Observações<textarea disabled={!configured} name="notes" rows={3} className="field mt-2 resize-none" placeholder="Clínica, cupom, parcelamento ou qualquer contexto" /></label>
      <button disabled={!configured} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white"><ReceiptText size={17} /> Salvar gasto</button>
    </form>
  </div>;
}
