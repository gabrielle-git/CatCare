import Link from "next/link";
import { ArrowLeft, BadgeCheck, HeartPulse, Pencil } from "lucide-react";
import { PetAvatar, PetProfilePhotoControl } from "@/components/pet-avatar";
import { formatPetAge, getPetLifeStage, isNeonatalPet, petLifeStageLabels } from "@/lib/format";
import { neuteredLabel, petContextLine } from "@/lib/pet-display";
import type { PetWithPhotoUrl } from "@/types/database";

export type PetTabId = "overview" | "saude" | "historico" | "memorias" | "perfil";

const TABS: { id: PetTabId; label: string; href: (petId: string) => string }[] = [
  { id: "overview", label: "Visão geral", href: (id) => `/pets/${id}` },
  { id: "saude", label: "Saúde", href: (id) => `/pets/${id}/saude` },
  { id: "historico", label: "Histórico", href: (id) => `/pets/${id}/historico` },
  { id: "memorias", label: "Memórias", href: (id) => `/pets/${id}/memorias` },
  { id: "perfil", label: "Perfil", href: (id) => `/pets/${id}/perfil` },
];

/**
 * Shared pet page chrome — M1B / M0.1V.1 hierarchy.
 * Light header + underline tabs; cadastral detail lives in Perfil.
 */
export function PetChrome({
  pet,
  editable,
  active,
  children,
  flash,
}: {
  pet: PetWithPhotoUrl;
  editable: boolean;
  active: PetTabId;
  children: React.ReactNode;
  flash?: React.ReactNode;
}) {
  const neonatal = isNeonatalPet(pet);
  const lifeStage = getPetLifeStage(pet.birth_date);
  const age = formatPetAge(pet.birth_date, pet.birth_date_estimated);

  return (
    <div data-brand="cuidadim" data-theme="light" className="cd-pet-page">
      <Link href="/pets" className="cd-pet-back focus-ring">
        <ArrowLeft size={17} aria-hidden />
        Pets
      </Link>

      {flash}

      <header className="cd-pet-head">
        {editable ? (
          <PetProfilePhotoControl
            petId={pet.id}
            name={pet.name}
            photoUrl={pet.photo_url}
            hasPhoto={Boolean(pet.photo_path)}
            editable={editable}
          />
        ) : (
          <PetAvatar name={pet.name} photoUrl={pet.photo_url} size="profile" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="cd-pet-name">{pet.name}</h1>
              <p className="cd-pet-line">{petContextLine(pet)}</p>
              <p className="cd-pet-context">
                <span className="inline-flex items-center gap-1">
                  {neonatal ? <HeartPulse size={12} strokeWidth={2} aria-hidden /> : null}
                  {petLifeStageLabels[lifeStage]}
                  {age ? <span className="cd-pet-context-muted"> · {age}</span> : null}
                </span>
                {pet.neutered ? (
                  <span className="cd-pet-neutered">
                    <BadgeCheck size={12} strokeWidth={2} aria-hidden />
                    {neuteredLabel(pet.sex)}
                  </span>
                ) : null}
              </p>
            </div>
            {editable ? (
              <Link href={`/pets/${pet.id}/edit`} className="cd-pet-edit focus-ring">
                <Pencil size={14} strokeWidth={1.75} aria-hidden />
                <span>Editar perfil</span>
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <nav className="cd-pet-tabs" role="tablist" aria-label={`Seções de ${pet.name}`}>
        {TABS.map((tab) => {
          const on = active === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href(pet.id)}
              role="tab"
              aria-selected={on}
              className="cd-pet-tab focus-ring"
              data-active={on ? "true" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="cd-pet-body">{children}</div>
    </div>
  );
}
