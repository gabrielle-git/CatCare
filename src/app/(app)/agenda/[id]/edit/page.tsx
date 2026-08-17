import Link from "next/link";
import { ArrowLeft, CalendarPlus, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { ensureHousehold } from "@/lib/households";
import { getReminder } from "@/lib/commerce";
import { listPets } from "@/lib/pets";
import { toLocalDateTimeInput } from "@/lib/record-form";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { deleteReminder, updateReminder } from "../../actions";

function recurrenceValue(rule: string | null) {
  if (rule === "FREQ=DAILY") return "daily";
  if (rule === "FREQ=WEEKLY") return "weekly";
  if (rule === "FREQ=MONTHLY") return "monthly";
  return "none";
}

export default async function EditReminderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const flags = await searchParams;
  if (!hasSupabaseEnv()) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Modo demonstração.</div>;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Entre na conta.</div>;

  const household = await ensureHousehold(supabase, data.user.id);
  const [reminder, pets] = await Promise.all([getReminder(supabase, household.id, id), listPets(supabase, household.id)]);
  if (!reminder) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Lembrete não encontrado.</div>;

  const save = updateReminder.bind(null, id);
  const remove = deleteReminder.bind(null, id);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/agenda" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar à agenda</Link>
      <div className="mt-4 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[18px] bg-[var(--lavender-soft)]"><CalendarPlus size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Editar lembrete</p><h1 className="text-3xl font-bold tracking-[-0.04em]">{reminder.title}</h1></div></div>
      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
      <form action={save} className="cat-card mt-6 space-y-5 p-5 md:p-7">
        <label className="block text-sm font-bold">O que precisa ser feito?<input required name="title" defaultValue={reminder.title} className="field mt-2" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Categoria<select name="category" defaultValue={reminder.category} className="field mt-2"><option value="vaccine">Vacina</option><option value="medication">Medicamento</option><option value="consultation">Consulta</option><option value="weight">Pesagem</option><option value="feeding">Alimentação / mamada</option><option value="hygiene">Higiene</option><option value="purchase">Compra</option><option value="other">Outro</option></select></label>
          <label className="text-sm font-bold">Data e hora<input required name="due_at" type="datetime-local" defaultValue={toLocalDateTimeInput(reminder.due_at)} className="field mt-2" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">Gatinho<select name="pet_id" defaultValue={reminder.pet_id ?? ""} className="field mt-2"><option value="">Família / todos</option>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name}</option>)}</select></label>
          <label className="text-sm font-bold">Repetição<select name="recurrence" defaultValue={recurrenceValue(reminder.recurrence_rule)} className="field mt-2"><option value="none">Não repetir</option><option value="daily">Todos os dias</option><option value="weekly">Toda semana</option><option value="monthly">Todo mês</option></select></label>
        </div>
        <label className="block text-sm font-bold">Detalhes<textarea name="notes" rows={3} defaultValue={reminder.notes ?? ""} className="field mt-2 resize-none" /></label>
        <button className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white"><CalendarPlus size={18} /> Salvar alterações</button>
      </form>
      <section className="mt-5 rounded-[22px] border border-red-100 bg-white p-5">
        <h2 className="font-bold">Apagar lembrete</h2>
        <form action={remove} className="mt-4"><ConfirmButton message="Apagar este lembrete permanentemente?" className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-bold text-[var(--danger)]"><Trash2 size={15} /> Apagar lembrete</ConfirmButton></form>
      </section>
    </div>
  );
}
