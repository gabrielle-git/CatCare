import Link from "next/link";
import { BadgeCheck, HeartPulse, Plus, Scale } from "lucide-react";
import { PetAvatar } from "@/components/pet-avatar";
import { formatHumanEquivalentAge, formatPetAge, formatWeight, getPetLifeStage, isNeonatalPet, petLifeStageLabels } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

async function loadPets() {
  if (!hasSupabaseEnv()) return { pets: demoPets, configured: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], configured: true };
  const household = await ensureHousehold(supabase, data.user.id);
  return { pets: await listPets(supabase, household.id), configured: true };
}

export default async function PetsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { pets, configured } = await loadPets();
  const { archived } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-8 pt-7 md:px-8 lg:px-10 lg:py-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Nossa família</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Meus gatos</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Cada gatinho com sua história, rotina e cuidados.</p>
        </div>
        <Link href="/pets/new" className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15">
          <Plus size={18} /> <span className="hidden sm:inline">Adicionar gato</span><span className="sm:hidden">Adicionar</span>
        </Link>
      </header>

      {!configured && <div className="mt-6 rounded-[20px] border border-[#d9cfee] bg-[var(--lavender-soft)] px-4 py-3 text-sm"><strong>Perfis personalizados.</strong> Dobby, Crystal e os dois bebês já usam os dados informados; fotos e registros de rotina continuam demonstrativos até conectar o Supabase.</div>}
      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">A fase de vida é identificada automaticamente pela data de nascimento. A equivalência humana é aproximada e serve apenas como referência carinhosa.</p>
      {archived && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Gatinho arquivado. O histórico continua guardado.</div>}

      {pets.length === 0 ? (
        <section className="cat-card mt-7 p-8 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-[22px] bg-[var(--lavender-soft)]"><Plus size={22} /></div>
          <h2 className="mt-4 text-lg font-bold">Vamos cadastrar o primeiro gatinho?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">A partir do perfil, você poderá registrar peso, vacinas, medicamentos e cuidados diários.</p>
        </section>
      ) : (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pets.map((pet) => {
            const neonatal = isNeonatalPet(pet);
            const lifeStage = getPetLifeStage(pet.birth_date);
            const age = formatPetAge(pet.birth_date, pet.birth_date_estimated);
            const humanAge = formatHumanEquivalentAge(pet.birth_date);
            return (
              <Link key={pet.id} href={`/pets/${pet.id}`} className="cat-card focus-ring group block p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start gap-4">
                  <PetAvatar name={pet.name} photoUrl={pet.photo_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="truncate text-lg font-bold">{pet.name}</h2>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${neonatal ? "bg-[var(--rose-soft)] text-[#9a536c]" : "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]"}`}>{neonatal && <HeartPulse size={11} />} {petLifeStageLabels[lifeStage]}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">{[pet.breed, age ? `${age} de vida` : null].filter(Boolean).join(" • ") || "Complete o perfil"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">{humanAge && <p className="text-[11px] font-semibold text-[var(--muted)]">{humanAge}</p>}{pet.neutered && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--mint-soft)] px-2 py-1 text-[9px] font-bold text-[var(--success)]"><BadgeCheck size={11} /> Castrado</span>}</div>
                    <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-[var(--lavender-strong)]"><Scale size={15} /> {formatWeight(pet.current_weight_grams)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
