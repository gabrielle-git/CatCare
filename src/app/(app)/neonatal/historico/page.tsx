import Link from "next/link";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { NeonatalHistoryPanel } from "@/components/neonatal-history-panel";
import { TimelineList } from "@/components/timeline-list";
import { isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoPets, demoTimeline } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { listHouseholdTimeline } from "@/lib/records";
import { canEdit, getMyRole } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadHistory() {
  if (!hasSupabaseEnv()) {
    const babies = demoPets.filter(isNeonatalPet);
    const babyIds = new Set(babies.map((pet) => pet.id));
    const items = demoTimeline.filter((item) => babyIds.has(item.pet_id));
    return { babies, items, configured: false, editable: false };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { babies: [], items: [], configured: true, editable: false };

  const role = await getMyRole(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  const [pets, timeline] = await Promise.all([
    listPets(supabase, household.id),
    listHouseholdTimeline(supabase, household.id, 500),
  ]);
  const babies = pets.filter(isNeonatalPet);
  const babyIds = new Set(babies.map((pet) => pet.id));
  const items = timeline.filter((item) => babyIds.has(item.pet_id) && ["feeding", "urine", "stool", "temperature", "weight"].includes(item.kind));

  return { babies, items, configured: true, editable: canEdit(role) };
}

export default async function NeonatalHistoryPage() {
  const { babies, items, configured, editable } = await loadHistory();
  const petNames = Object.fromEntries(babies.map((pet) => [pet.id, pet.name]));

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/neonatal" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Modo neonatal
      </Link>

      <header className="mt-5">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a536c]">
          <HeartPulse size={15} /> Histórico completo
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Cuidados dos filhotes</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Todos os registros neonatais da ninhada, com filtros e seleção em lote.</p>
      </header>

      {!configured && (
        <div className="mt-6 rounded-[20px] bg-[var(--rose-soft)] px-4 py-3 text-sm">
          <strong>Modo de demonstração.</strong> Exemplo com dados fictícios.
        </div>
      )}

      <section className="mt-8">
        <NeonatalHistoryPanel items={items} petNames={petNames} editable={editable} />
      </section>
    </div>
  );
}
