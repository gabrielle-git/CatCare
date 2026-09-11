import Link from "next/link";
import { History } from "lucide-react";
import { FamilyHistoryPanel } from "@/components/family-history-panel";
import { FAMILY_HISTORY_FETCH_LIMIT } from "@/lib/family-history";
import { ensureHousehold } from "@/lib/households";
import { demoPets, demoTimeline } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { listHouseholdTimeline } from "@/lib/records";
import { canEdit, getMyRole } from "@/lib/roles";
import { isLiveData } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadHistory() {
  if (!(await isLiveData())) {
    return {
      pets: demoPets.map((pet) => ({ id: pet.id, name: pet.name })),
      items: demoTimeline,
      configured: false,
      editable: false,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { pets: [], items: [], configured: true, editable: false };
  }

  const role = await getMyRole(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  const [pets, items] = await Promise.all([
    listPets(supabase, household.id),
    listHouseholdTimeline(supabase, household.id, FAMILY_HISTORY_FETCH_LIMIT),
  ]);

  return {
    pets: pets.map((pet) => ({ id: pet.id, name: pet.name })),
    items,
    configured: true,
    editable: canEdit(role),
  };
}

export default async function FamilyHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; type?: string; saved?: string }>;
}) {
  const [{ pets, items, editable }, flags] = await Promise.all([loadHistory(), searchParams]);

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <header className="mt-1">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">
          <History size={15} aria-hidden="true" /> Histórico da família
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">O que aconteceu por aqui</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Cuidados de todos os pets. Busque por texto ou refine por período e tipo.
        </p>
      </header>

      {flags.saved ? (
        <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          {Number(flags.saved) > 1 ? `${flags.saved} registros salvos.` : "Tudo salvo direitinho."}
        </div>
      ) : null}

      <section className="mt-8">
        <FamilyHistoryPanel
          items={items}
          pets={pets}
          editable={editable}
          initialQ={flags.q}
          initialFrom={flags.from}
          initialTo={flags.to}
          initialType={flags.type}
        />
      </section>

      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        Quer o histórico de um pet só? Abra o perfil em{" "}
        <Link href="/pets" className="font-bold text-[var(--lavender-strong)]">
          Meus pets
        </Link>
        .
      </p>
    </div>
  );
}
