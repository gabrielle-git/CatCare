import Link from "next/link";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { ensureHousehold } from "@/lib/households";
import { demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createReminder } from "../actions";

async function loadPetsForForm() {
  if (!hasSupabaseEnv()) return { pets: demoPets, configured: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], configured: true };
  const household = await ensureHousehold(supabase, data.user.id);
  return { pets: await listPets(supabase, household.id), configured: true };
}

export default async function NewReminderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ pets, configured }, flags] = await Promise.all([loadPetsForForm(), searchParams]);
  return <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
    <Link href="/agenda" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar à agenda</Link>
    <div className="mt-4 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[18px] bg-[var(--lavender-soft)]"><CalendarPlus size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Organizar a rotina</p><h1 className="text-3xl font-bold tracking-[-0.04em]">Novo lembrete</h1></div></div>
    {!configured && <div className="mt-6 rounded-[20px] bg-[var(--peach)] px-4 py-3 text-sm">O formulário fica disponível para teste visual. <Link href="/login" className="font-bold underline">Conecte uma conta</Link> para salvar.</div>}
    {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
    <form action={createReminder} className="cat-card mt-6 space-y-5 p-5 md:p-7">
      <label className="block text-sm font-bold">O que precisa ser feito?<input disabled={!configured} required name="title" className="field mt-2" placeholder="Ex.: Dar a segunda dose da vacina" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Categoria<select disabled={!configured} name="category" className="field mt-2"><option value="vaccine">Vacina</option><option value="medication">Medicamento</option><option value="consultation">Consulta</option><option value="weight">Pesagem</option><option value="feeding">Alimentação / mamada</option><option value="hygiene">Higiene</option><option value="purchase">Compra</option><option value="other">Outro</option></select></label><label className="text-sm font-bold">Data e hora<input disabled={!configured} required name="due_at" type="datetime-local" className="field mt-2" /></label></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Gatinho<select disabled={!configured} name="pet_id" className="field mt-2"><option value="">Família / todos</option>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label><label className="text-sm font-bold">Repetição<select disabled={!configured} name="recurrence" className="field mt-2"><option value="none">Não repetir</option><option value="daily">Todos os dias</option><option value="weekly">Toda semana</option><option value="monthly">Todo mês</option></select></label></div>
      <label className="block text-sm font-bold">Detalhes<textarea disabled={!configured} name="notes" rows={3} className="field mt-2 resize-none" placeholder="Dose, quantidade, endereço ou algo que ajude na hora" /></label>
      <button disabled={!configured} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white"><CalendarPlus size={18} /> Salvar lembrete</button>
    </form>
  </div>;
}
