import { notFound } from "next/navigation";
import { PetChrome } from "@/components/pet-chrome";
import { TimelineList } from "@/components/timeline-list";
import { isNeonatalPet } from "@/lib/format";
import { demoPets, demoTimeline } from "@/lib/mock-data";
import { getPet } from "@/lib/pets";
import { isNeonatalTimelineItem, listPetTimeline } from "@/lib/records";
import { canEdit, getMyRole } from "@/lib/roles";
import { isLiveData } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";

const ADULT_TYPES = new Set([
  "all",
  "feeding",
  "weight",
  "vaccine",
  "deworming",
  "medication",
  "consultation",
  "exam",
  "hygiene",
  "observation",
]);

const NEONATAL_TYPES = new Set(["all", "feeding", "urine", "stool", "temperature", "weight", "observation"]);

async function loadPetHistory(petId: string) {
  if (!(await isLiveData())) {
    const pet = demoPets.find((item) => item.id === petId) ?? null;
    const items = demoTimeline.filter((item) => item.pet_id === petId);
    return { pet, items, configured: false, editable: false };
  }

  const supabase = await createClient();
  const role = await getMyRole(supabase);
  const pet = await getPet(supabase, petId);
  if (!pet) return { pet: null, items: [], configured: true, editable: false };

  const timeline = await listPetTimeline(supabase, petId, 500);
  const neonatal = isNeonatalPet(pet);
  const items = neonatal ? timeline : timeline.filter((item) => !isNeonatalTimelineItem(item));

  return { pet, items, configured: true, editable: canEdit(role) };
}

export default async function PetHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type: rawType } = await searchParams;
  const { pet, items, editable } = await loadPetHistory(id);
  if (!pet) notFound();
  const neonatal = isNeonatalPet(pet);
  const allowed = neonatal ? NEONATAL_TYPES : ADULT_TYPES;
  const initialFilter = rawType && allowed.has(rawType) ? rawType : "all";

  return (
    <PetChrome pet={pet} editable={editable} active="historico">
      <section className="cd-pet-section" aria-label={`Histórico de ${pet.name}`}>
        <h2 className="cd-pet-section-title">Histórico</h2>
        <p className="cd-pet-lede">Linha do tempo de {pet.name}</p>
        <div className="mt-4">
          <TimelineList
            key={initialFilter}
            items={items}
            emptyText="Nenhum cuidado registrado ainda."
            editable={editable}
            returnTo={`/pets/${pet.id}/historico${initialFilter !== "all" ? `?type=${initialFilter}` : ""}`}
            filterMode={neonatal ? "neonatal" : "adult"}
            newRecordPetId={pet.id}
            showNewRecord={editable}
            variant="rows"
            initialFilter={initialFilter}
          />
        </div>
      </section>
    </PetChrome>
  );
}
