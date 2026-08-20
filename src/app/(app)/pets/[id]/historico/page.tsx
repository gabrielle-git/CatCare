import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TimelineList } from "@/components/timeline-list";
import { isNeonatalPet } from "@/lib/format";
import { demoPets, demoTimeline } from "@/lib/mock-data";
import { getPet } from "@/lib/pets";
import { isNeonatalTimelineItem, listPetTimeline } from "@/lib/records";
import { canEdit, getMyRole } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

async function loadPetHistory(petId: string) {
  if (!hasSupabaseEnv()) {
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

export default async function PetHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pet, items, configured, editable } = await loadPetHistory(id);
  if (!pet) notFound();
  const neonatal = isNeonatalPet(pet);

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href={`/pets/${pet.id}`} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Perfil de {pet.name}
      </Link>

      <header className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Histórico completo</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Linha do tempo de {pet.name}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Todos os cuidados registrados, com filtros e seleção em lote.</p>
      </header>

      {!configured && (
        <div className="mt-6 rounded-[20px] bg-[var(--lavender-soft)] px-4 py-3 text-sm">
          <strong>Modo de demonstração.</strong> Exemplo com dados fictícios.
        </div>
      )}

      <section className="mt-8">
        <TimelineList
          items={items}
          emptyText="Nenhum cuidado registrado ainda."
          editable={editable}
          returnTo={`/pets/${pet.id}/historico`}
          filterMode={neonatal ? "neonatal" : "adult"}
          newRecordPetId={pet.id}
          showNewRecord={editable}
        />
      </section>
    </div>
  );
}
