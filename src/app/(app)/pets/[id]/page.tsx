import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CalendarPlus, HeartPulse, Pencil, Pill, Plus, Scale, Sparkles, Syringe } from "lucide-react";
import { PetAvatar } from "@/components/pet-avatar";
import { TimelineList } from "@/components/timeline-list";
import { WeightChart } from "@/components/weight-chart";
import { formatBirthDate, formatHumanEquivalentAge, formatPetAge, formatWeight, getPetLifeStage, isNeonatalPet, petLifeStageLabels } from "@/lib/format";
import { demoPets, demoTimeline, demoWeights } from "@/lib/mock-data";
import { getPet } from "@/lib/pets";
import { listPetTimeline, listPetWeights } from "@/lib/records";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { updatePetDescription } from "../actions";

async function loadPetPage(id: string) {
  if (!hasSupabaseEnv()) {
    const pet = demoPets.find((item) => item.id === id);
    return { pet: pet ?? null, timeline: demoTimeline.filter((item) => item.pet_id === id), weights: demoWeights[id] ?? [], configured: false };
  }
  const supabase = await createClient();
  const pet = await getPet(supabase, id);
  if (!pet) return { pet: null, timeline: [], weights: [], configured: true };
  const [timeline, weights] = await Promise.all([listPetTimeline(supabase, id), listPetWeights(supabase, id)]);
  return { pet, timeline, weights, configured: true };
}

export default async function PetDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; updated?: string; saved?: string }> }) {
  const { id } = await params;
  const flags = await searchParams;
  const { pet, timeline, weights, configured } = await loadPetPage(id);
  if (!pet) notFound();
  const neonatal = isNeonatalPet(pet);
  const lifeStage = getPetLifeStage(pet.birth_date);
  const recentKinds = new Set(timeline.slice(0, 6).map((item) => item.kind));
  const age = formatPetAge(pet.birth_date, pet.birth_date_estimated);
  const humanAge = formatHumanEquivalentAge(pet.birth_date);
  const birthDate = formatBirthDate(pet.birth_date, pet.birth_date_estimated);
  const suggestedDescription = [
    `${pet.name} ${age ? `tem ${age}` : "faz parte da família"}${pet.color ? ` e tem pelagem ${pet.color.toLocaleLowerCase("pt-BR")}` : ""}.`,
    recentKinds.has("weight") ? `A família acompanha seu peso, hoje em ${formatWeight(pet.current_weight_grams)}.` : null,
    recentKinds.has("surgery") && pet.neutered ? "A castração foi registrada no histórico com data aproximada." : null,
    recentKinds.has("medication") || recentKinds.has("vaccine") ? "Os cuidados de saúde estão sendo registrados com atenção." : null,
    neonatal ? "Como ainda é bebê, sua rotina neonatal merece acompanhamento bem de perto." : null,
  ].filter(Boolean).join(" ");
  const saveDescription = updatePetDescription.bind(null, pet.id);

  const actions = [
    { type: "weight", label: "Peso", icon: Scale, tone: "bg-[var(--lavender-soft)]" },
    { type: "vaccine", label: "Vacina", icon: Syringe, tone: "bg-[var(--mint-soft)]" },
    { type: "medication", label: "Remédio", icon: Pill, tone: "bg-[#fbead9]" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1040px] px-5 pb-8 pt-7 md:px-8 lg:px-10 lg:py-10">
      <Link href="/pets" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Meus gatos</Link>
      {(flags.created || flags.updated || flags.saved) && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Tudo salvo direitinho.</div>}

      <section className="cat-card mt-5 overflow-hidden">
        <div className="bg-[linear-gradient(135deg,var(--lavender-soft),var(--rose-soft))] p-5 md:p-7">
          <div className="flex items-start gap-4">
            <PetAvatar name={pet.name} photoUrl={pet.photo_url} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-[-0.04em]">{pet.name}</h1>
                    <span className={`inline-flex items-center gap-1 rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-bold ${neonatal ? "text-[#9a536c]" : "text-[var(--lavender-strong)]"}`}>{neonatal && <HeartPulse size={12} />} {petLifeStageLabels[lifeStage]}</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{[pet.breed, pet.color].filter(Boolean).join(" • ") || "Perfil em construção"}</p>
                  {birthDate && <p className="mt-1 text-xs text-[var(--muted)]">Nascimento: {birthDate}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">{age && <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold">{age} de vida</span>}{humanAge && <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold">{humanAge}</span>}{pet.neutered && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mint-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--success)]"><BadgeCheck size={12} /> Castrado</span>}</div>
                </div>
                {configured ? <Link href={`/pets/${pet.id}/edit`} className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white/80 px-3.5 py-2.5 text-xs font-bold"><Pencil size={16} /> Editar perfil</Link> : <button disabled title="Disponível depois de entrar na conta" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white/80 px-3.5 py-2.5 text-xs font-bold"><Pencil size={16} /> Editar perfil</button>}
              </div>
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5 text-sm font-bold"><Scale size={16} /> {formatWeight(pet.current_weight_grams)}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 p-4 md:gap-3 md:p-5">
          {actions.map(({ type, label, icon: Icon, tone }) => (
            <Link key={type} href={`/records/new?pet=${pet.id}&type=${type}`} className={`focus-ring flex flex-col items-center justify-center gap-2 rounded-[18px] px-2 py-3 text-xs font-bold ${tone}`}><Icon size={18} /> {label}</Link>
          ))}
        </div>
      </section>

      {neonatal && (
        <Link href={`/records/new?pet=${pet.id}&type=feeding`} className="focus-ring mt-4 flex items-center justify-between rounded-[22px] bg-[var(--rose)] p-4 font-bold">
          <span className="flex items-center gap-2"><HeartPulse size={19} /> Registrar cuidado neonatal</span><Plus size={18} />
        </Link>
      )}

      <div className="mt-6">
        <WeightChart data={weights} petId={pet.id} petName={pet.name} />
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Histórico</p><h2 className="mt-1 text-xl font-bold">Linha do tempo</h2></div>
            <Link href={`/records/new?pet=${pet.id}`} className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-2.5 text-xs font-bold text-white"><Plus size={15} /> Novo registro</Link>
          </div>
          <TimelineList items={timeline} editable={configured} />
        </section>

        <aside className="space-y-4">
          <div className="cat-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Personalidade e cuidados</p><h2 className="mt-1 font-bold">Sobre {pet.name}</h2></div>
              {configured ? <Link href={`/pets/${pet.id}/edit#description`} className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[var(--lavender-soft)] px-2.5 py-2 text-[11px] font-bold"><Pencil size={13} /> Editar</Link> : <button disabled title="Disponível depois de entrar na conta" className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--lavender-soft)] px-2.5 py-2 text-[11px] font-bold"><Pencil size={13} /> Editar</button>}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{pet.notes || "Nenhuma descrição pessoal foi adicionada ainda."}</p>
            <details className="mt-4 rounded-2xl bg-[var(--cream)] p-3">
              <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-xl text-xs font-bold"><Sparkles size={15} className="text-[var(--lavender-strong)]" /> Sugerir pelo histórico</summary>
              <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{suggestedDescription}</p>
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">Resumo automático feito com perfil e registros. A leitura das fotos poderá ser ativada quando conectarmos uma IA visual.</p>
              {configured ? <form action={saveDescription} className="mt-3"><input type="hidden" name="notes" value={suggestedDescription} /><button className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[var(--graphite)] px-3 py-2 text-[11px] font-bold text-white"><Sparkles size={13} /> Usar esta sugestão</button></form> : <button disabled title="Disponível depois de entrar na conta" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--graphite)] px-3 py-2 text-[11px] font-bold text-white"><Sparkles size={13} /> Usar esta sugestão</button>}
            </details>
          </div>
          <Link href={`/records/new?pet=${pet.id}&type=consultation`} className="focus-ring flex items-center gap-3 rounded-[22px] bg-[var(--mint-soft)] p-4 text-sm font-bold"><CalendarPlus size={19} /> Consulta ou retorno</Link>
        </aside>
      </div>
    </div>
  );
}
