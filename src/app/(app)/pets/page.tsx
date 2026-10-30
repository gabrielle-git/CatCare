import Link from "next/link";
import { ChevronRight, HeartPulse, Plus } from "lucide-react";
import { PetAvatar } from "@/components/pet-avatar";
import { PetsDomainTabs } from "@/components/pets-domain-tabs";
import { getAuthenticatedContext } from "@/lib/auth-context";
import { formatPetAge, getPetLifeStage, isNeonatalPet, petLifeStageLabels } from "@/lib/format";
import { petSpeciesLabel } from "@/lib/pet-display";
import { demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { isLiveData } from "@/lib/demo-mode";
import { getPerfTraceId, timed } from "@/lib/perf";

async function loadPets() {
  const pageStart = performance.now();
  const trace = getPerfTraceId();
  if (!(await timed("/pets.isLiveData", () => isLiveData()))) return { pets: demoPets, configured: false, editable: false };
  const ctx = await getAuthenticatedContext();
  if (!ctx) return { pets: [], configured: true, editable: false };
  const pets = await timed("/pets.listPets", () => listPets(ctx.supabase, ctx.household.id));
  console.log(`[CATCARE_PERF][trace ${trace}][/pets] total=${Math.round(performance.now() - pageStart)}ms`);
  return { pets, configured: true, editable: ctx.editable };
}

export default async function PetsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { pets, editable } = await loadPets();
  const { archived } = await searchParams;

  return (
    <div data-brand="cuidadim" data-theme="light" className="cd-pet-page cd-pet-page-list">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="cd-page-kicker">Sua família</p>
          <h1 className="cd-page-title">Pets</h1>
          <p className="cd-page-lede">Acompanhe saúde, cuidados e momentos de cada pet.</p>
        </div>
        {editable ? (
          <Link
            href="/pets/new"
            className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15"
          >
            <Plus size={18} aria-hidden />
            <span className="hidden sm:inline">Adicionar pet</span>
            <span className="sm:hidden">Adicionar</span>
          </Link>
        ) : null}
      </header>

      <div className="mt-5">
        <PetsDomainTabs active="pets" />
      </div>

      {archived ? (
        <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          Pet arquivado. O histórico continua guardado.
        </div>
      ) : null}

      {pets.length === 0 ? (
        <section className="mt-7 rounded-[22px] border border-dashed border-[var(--border)] px-6 py-10 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-[22px] bg-[var(--lavender-soft)]">
            <Plus size={22} aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-bold">Vamos cadastrar o primeiro pet?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
            A partir do perfil, você poderá registrar peso, vacinas, medicamentos e cuidados diários.
          </p>
          {editable ? (
            <Link href="/pets/new" className="focus-ring mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white">
              <Plus size={18} aria-hidden /> Adicionar pet
            </Link>
          ) : null}
        </section>
      ) : (
        <ul className="cd-pet-list mt-2">
          {pets.map((pet) => {
            const neonatal = isNeonatalPet(pet);
            const lifeStage = getPetLifeStage(pet.birth_date);
            const age = formatPetAge(pet.birth_date, pet.birth_date_estimated);
            const meta = [petSpeciesLabel(pet.species), petLifeStageLabels[lifeStage], age].filter(Boolean).join(" · ");
            return (
              <li key={pet.id}>
                <Link href={`/pets/${pet.id}`} className="cd-pet-list-row focus-ring">
                  <PetAvatar name={pet.name} photoUrl={pet.photo_url} size="md" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{pet.name}</span>
                      {neonatal ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--rose-soft)] px-2 py-0.5 text-[10px] font-bold text-[#9a536c]">
                          <HeartPulse size={11} aria-hidden />
                          Neonatal
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{meta}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[var(--muted)]" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
