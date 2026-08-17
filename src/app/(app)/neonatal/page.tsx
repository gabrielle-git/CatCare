import Link from "next/link";
import { HeartPulse, Milk, Plus, Scale } from "lucide-react";
import { PetAvatar } from "@/components/pet-avatar";
import { TimelineList } from "@/components/timeline-list";
import { formatHumanEquivalentAge, formatPetAge, formatWeight, isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoPets, demoTimeline } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { listHouseholdTimeline } from "@/lib/records";
import { deleteRecord } from "../records/actions";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadNeonatal() {
  if (!hasSupabaseEnv()) return { pets: demoPets, timeline: demoTimeline, configured: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], timeline: [], configured: true };
  const household = await ensureHousehold(supabase, data.user.id);
  const [pets, timeline] = await Promise.all([listPets(supabase, household.id), listHouseholdTimeline(supabase, household.id, 30)]);
  return { pets, timeline, configured: true };
}

export default async function NeonatalPage() {
  const { pets, timeline, configured } = await loadNeonatal();
  const babies = pets.filter(isNeonatalPet);
  const hasEstimatedBirthDates = babies.some((pet) => pet.birth_date_estimated);
  const babyIds = new Set(babies.map((pet) => pet.id));
  const recent = timeline.filter((item) => babyIds.has(item.pet_id) && ["feeding", "urine", "stool", "temperature", "weight"].includes(item.kind));

  return (
    <div className="mx-auto w-full max-w-[1040px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <header><p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a536c]"><HeartPulse size={15} /> Cuidado intensivo, interface tranquila</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Modo neonatal</h1><p className="mt-2 text-sm text-[var(--muted)]">Registre o essencial sem poluir a rotina dos gatos maiores.</p></header>
      <div className="mt-5 rounded-[20px] border border-[#e3b6c4] bg-[var(--rose-soft)] px-4 py-3 text-sm"><strong>Identificação automática:</strong> todo gatinho com menos de 8 semanas entra neste painel pela data de nascimento e sai dele quando conclui essa fase.</div>
      {!configured && <div className="mt-6 rounded-[20px] bg-[var(--rose-soft)] px-4 py-3 text-sm"><strong>Perfis personalizados.</strong> Os nomes provisórios já estão aplicados; os registros de mamada e higiene abaixo ainda são exemplos.</div>}
      {hasEstimatedBirthDates && <div className="mt-3 rounded-[20px] border border-[#e3b6c4] bg-white px-4 py-3 text-sm"><strong>Data pendente:</strong> a idade dos dois bebês está marcada como estimada. Quando você informar o nascimento correto, o acompanhamento neonatal será recalculado automaticamente.</div>}
      {babies.length === 0 ? <section className="cat-card mt-7 p-8 text-center"><HeartPulse className="mx-auto text-[var(--rose)]" size={30} /><h2 className="mt-3 text-lg font-bold">Nenhum bebê em acompanhamento</h2><p className="mt-2 text-sm text-[var(--muted)]">Gatinhos com até 8 semanas aparecem aqui automaticamente.</p></section> : (
        <div className="mt-7 grid gap-4 sm:grid-cols-2">{babies.map((pet) => <section key={pet.id} className="cat-card overflow-hidden"><div className="flex items-center gap-4 bg-[var(--rose-soft)] p-5"><PetAvatar name={pet.name} photoUrl={pet.photo_url} /><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{pet.name}</h2><span className="rounded-full bg-white/75 px-2 py-1 text-[9px] font-bold text-[#9a536c]">Neonatal automático</span></div><p className="mt-1 text-xs text-[var(--muted)]">{formatPetAge(pet.birth_date, pet.birth_date_estimated)} de vida • {formatWeight(pet.current_weight_grams)}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{formatHumanEquivalentAge(pet.birth_date)}</p></div></div><div className="grid grid-cols-2 gap-2 p-4"><Link href={`/records/new?pet=${pet.id}&type=feeding`} className="focus-ring flex items-center justify-center gap-2 rounded-[18px] bg-[var(--rose-soft)] px-3 py-3 text-xs font-bold"><Milk size={17} /> Mamada</Link><Link href={`/records/new?pet=${pet.id}&type=weight`} className="focus-ring flex items-center justify-center gap-2 rounded-[18px] bg-[var(--lavender-soft)] px-3 py-3 text-xs font-bold"><Scale size={17} /> Peso</Link><Link href={`/records/new?pet=${pet.id}&type=urine`} className="focus-ring rounded-[18px] border border-[var(--border)] px-3 py-3 text-center text-xs font-bold">Xixi</Link><Link href={`/pets/${pet.id}`} className="focus-ring flex items-center justify-center gap-1 rounded-[18px] border border-[var(--border)] px-3 py-3 text-xs font-bold">Histórico <Plus size={14} /></Link></div></section>)}</div>
      )}
      <section className="mt-8"><div className="mb-3"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a536c]">Últimas atividades</p><h2 className="mt-1 text-xl font-bold">Cuidados dos bebês</h2></div><TimelineList items={recent.slice(0, 12)} emptyText="Os registros neonatais aparecerão aqui." editable={configured} deleteAction={configured ? (item) => deleteRecord.bind(null, item.id, item.source, item.pet_id) : undefined} /></section>
    </div>
  );
}
