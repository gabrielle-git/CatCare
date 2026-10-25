import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Pencil, Sparkles } from "lucide-react";
import { PetChrome } from "@/components/pet-chrome";
import { PetMicrochipSummary } from "@/components/pet-microchip-summary";
import {
  formatBirthDate,
  formatHumanEquivalentAge,
  formatPetAge,
  formatWeight,
  getPetLifeStage,
  isNeonatalPet,
  petLifeStageLabels,
} from "@/lib/format";
import { neuteredLabel, petSexLabel, petSpeciesLabel } from "@/lib/pet-display";
import { demoPets, demoTimeline } from "@/lib/mock-data";
import { countPetDocuments } from "@/lib/documents";
import { getPet } from "@/lib/pets";
import { listPetTimeline } from "@/lib/records";
import { getAuthenticatedContext } from "@/lib/auth-context";
import { isLiveData } from "@/lib/demo-mode";
import { updatePetDescription } from "../../actions";

async function loadPerfil(id: string) {
  if (!(await isLiveData())) {
    const pet = demoPets.find((item) => item.id === id) ?? null;
    return {
      pet,
      timeline: pet ? demoTimeline.filter((item) => item.pet_id === pet.id) : [],
      documentCount: 0,
      editable: false,
    };
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return { pet: null, timeline: [], documentCount: 0, editable: false };
  const pet = await getPet(ctx.supabase, id);
  if (!pet) return { pet: null, timeline: [], documentCount: 0, editable: false };
  const [timeline, documentCount] = await Promise.all([
    listPetTimeline(ctx.supabase, id, 12),
    countPetDocuments(ctx.supabase, id),
  ]);
  return { pet, timeline, documentCount, editable: ctx.editable };
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="cd-pet-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default async function PetPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pet, timeline, documentCount, editable } = await loadPerfil(id);
  if (!pet) notFound();

  const neonatal = isNeonatalPet(pet);
  const lifeStage = getPetLifeStage(pet.birth_date);
  const age = formatPetAge(pet.birth_date, pet.birth_date_estimated);
  const humanAge = formatHumanEquivalentAge(pet.birth_date);
  const birthDate = formatBirthDate(pet.birth_date, pet.birth_date_estimated);
  const recentKinds = new Set(timeline.slice(0, 6).map((item) => item.kind));
  const suggestedDescription = [
    `${pet.name} ${age ? `tem ${age}` : "faz parte da família"}${pet.color ? ` e tem pelagem ${pet.color.toLocaleLowerCase("pt-BR")}` : ""}.`,
    recentKinds.has("weight") ? `A família acompanha seu peso, hoje em ${formatWeight(pet.current_weight_grams)}.` : null,
    recentKinds.has("surgery") && pet.neutered ? "A castração foi registrada no histórico com data aproximada." : null,
    recentKinds.has("medication") || recentKinds.has("vaccine") || recentKinds.has("deworming")
      ? "Os cuidados de saúde estão sendo registrados com atenção."
      : null,
    neonatal ? "Como ainda é filhote, sua rotina neonatal merece acompanhamento bem de perto." : null,
  ]
    .filter(Boolean)
    .join(" ");
  const saveDescription = updatePetDescription.bind(null, pet.id);
  const identityLine = [petSpeciesLabel(pet.species), pet.breed].filter(Boolean).join(" · ");
  const traitLine = [petSexLabel(pet.sex), pet.color ? `pelagem ${pet.color.toLocaleLowerCase("pt-BR")}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <PetChrome pet={pet} editable={editable} active="perfil">
      <div className="cd-pet-perfil">
        <section className="cd-pet-section" aria-label="Sobre o pet">
          <h2 className="cd-pet-section-title">Sobre o pet</h2>
          {identityLine ? <p className="cd-body font-semibold">{identityLine}</p> : null}
          {traitLine ? <p className="cd-body">{traitLine}</p> : null}
          <div className="cd-pet-cluster">
            {birthDate ? (
              <p>
                <span className="cd-meta">Nascimento</span>
                <span className="cd-body mt-1 block">{birthDate}</span>
              </p>
            ) : null}
            <p>
              <span className="cd-meta">Fase de vida</span>
              <span className="cd-body mt-1 block">{petLifeStageLabels[lifeStage]}</span>
            </p>
            {age ? (
              <p>
                <span className="cd-body block font-semibold">{age} de vida</span>
                {humanAge ? <span className="cd-meta mt-1 block">{humanAge}</span> : null}
              </p>
            ) : (
              <p className="cd-pet-empty">Sem data de nascimento cadastrada.</p>
            )}
          </div>
        </section>

        <section className="cd-pet-section" aria-label="Identificação e status">
          <h2 className="cd-pet-section-title">Identificação e status</h2>
          <PetMicrochipSummary pet={pet} editable={editable} />
          {pet.neutered ? <Field label="Castração" value={neuteredLabel(pet.sex)} /> : null}
          {pet.archived_at ? <Field label="Arquivo" value="Pet arquivado" /> : null}
        </section>

        <section className="cd-pet-section" aria-label={`Sobre ${pet.name}`} id="description">
          <div className="cd-pet-section-head">
            <h2 className="cd-pet-section-title">Sobre</h2>
            {editable ? (
              <Link href={`/pets/${pet.id}/edit#description`} className="cd-pet-text-link focus-ring">
                <Pencil size={13} aria-hidden /> Editar
              </Link>
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            {pet.notes || "Nenhuma descrição pessoal foi adicionada ainda."}
          </p>
          <details className="cd-pet-suggest mt-4">
            <summary className="focus-ring">
              <Sparkles size={15} className="text-[var(--lavender-strong)]" aria-hidden />
              Sugerir pelo histórico
            </summary>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{suggestedDescription}</p>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
              Resumo automático feito com perfil e registros.
            </p>
            {editable ? (
              <form action={saveDescription} className="mt-3">
                <input type="hidden" name="notes" value={suggestedDescription} />
                <button className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[var(--graphite)] px-3 py-2 text-[11px] font-bold text-white">
                  <Sparkles size={13} aria-hidden /> Usar esta sugestão
                </button>
              </form>
            ) : null}
          </details>
        </section>

        <section className="cd-pet-section" aria-label="Documentos e arquivos">
          <h2 className="cd-pet-section-title">Documentos e arquivos</h2>
          <Link href={`/pets/${pet.id}/documents`} className="cd-pet-docs-compact focus-ring">
            <span>Documentos · {documentCount}</span>
            <span className="cd-pet-text-link">
              Abrir
              <ArrowRight size={13} aria-hidden />
            </span>
          </Link>
        </section>
      </div>

      {editable ? (
        <div className="mt-6">
          <Link href={`/pets/${pet.id}/edit`} className="cd-pet-edit focus-ring">
            <Pencil size={14} strokeWidth={1.75} aria-hidden />
            Editar perfil completo
          </Link>
        </div>
      ) : null}
    </PetChrome>
  );
}
