import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { NeonatalDashboard } from "@/components/neonatal-dashboard";
import { TimelineList } from "@/components/timeline-list";
import { isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoPets, demoTimeline } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { listHouseholdNeonatalRecords, listHouseholdTimeline } from "@/lib/records";
import { canEdit, getMyRole } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function loadNeonatal() {
  if (!hasSupabaseEnv()) return { pets: demoPets, timeline: demoTimeline, neonatalRecords: [], configured: false, editable: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], timeline: [], neonatalRecords: [], configured: true, editable: false };
  const role = await getMyRole(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  const [pets, timeline, neonatalRecords] = await Promise.all([
    listPets(supabase, household.id),
    listHouseholdTimeline(supabase, household.id, 120),
    listHouseholdNeonatalRecords(supabase, household.id, 500),
  ]);
  return { pets, timeline, neonatalRecords, configured: true, editable: canEdit(role) };
}

export default async function NeonatalPage({ searchParams }: { searchParams: Promise<{ deleted?: string; saved?: string; error?: string }> }) {
  const flags = await searchParams;
  const { pets, timeline, neonatalRecords, configured, editable } = await loadNeonatal();
  const babies = pets.filter(isNeonatalPet);
  const hasEstimatedBirthDates = babies.some((pet) => pet.birth_date_estimated);
  const babyIds = new Set(babies.map((pet) => pet.id));
  const petNames = Object.fromEntries(babies.map((pet) => [pet.id, pet.name]));
  const recent = timeline.filter((item) => babyIds.has(item.pet_id) && ["feeding", "urine", "stool", "temperature", "weight"].includes(item.kind));

  return (
    <div className="mx-auto w-full max-w-[1040px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <header>
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a536c]"><HeartPulse size={15} /> Cuidado intensivo, interface tranquila</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Modo neonatal</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Registre o essencial sem poluir a rotina dos pets maiores.</p>
      </header>

      <div className="mt-5 rounded-[20px] border border-[#e3b6c4] bg-[var(--rose-soft)] px-4 py-3 text-sm"><strong>Identificação automática:</strong> todo filhote com menos de 8 semanas entra neste painel pela data de nascimento e sai dele quando conclui essa fase.</div>
      {!configured && <div className="mt-6 rounded-[20px] bg-[var(--rose-soft)] px-4 py-3 text-sm"><strong>Perfis personalizados.</strong> Os nomes provisórios já estão aplicados; os registros de mamada e higiene abaixo ainda são exemplos.</div>}
      {flags.error && <div className="mt-5 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
      {flags.saved && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">{Number(flags.saved) === 1 ? "1 registro salvo." : `${flags.saved} registros salvos.`}</div>}
      {flags.deleted && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">{Number(flags.deleted) === 1 ? "1 registro apagado." : `${flags.deleted} registros apagados.`}</div>}
      {hasEstimatedBirthDates && <div className="mt-3 rounded-[20px] border border-[#e3b6c4] bg-white px-4 py-3 text-sm"><strong>Data pendente:</strong> a idade dos filhotes está marcada como estimada. Quando você informar o nascimento correto, o acompanhamento neonatal será recalculado automaticamente.</div>}

      {babies.length === 0 ? (
        <section className="cat-card mt-7 p-8 text-center">
          <HeartPulse className="mx-auto text-[var(--rose)]" size={30} />
          <h2 className="mt-3 text-lg font-bold">Nenhum filhote em acompanhamento</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Filhotes com até 8 semanas aparecem aqui automaticamente.</p>
        </section>
      ) : (
        <NeonatalDashboard babies={babies} records={neonatalRecords} editable={editable} />
      )}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a536c]">Atividades recentes</p>
            <h2 className="mt-1 text-xl font-bold">Cuidados dos filhotes</h2>
          </div>
          {recent.length > 8 && (
            <Link href="/neonatal/historico" className="focus-ring rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[11px] font-bold text-[var(--lavender-strong)]">
              Ver histórico completo
            </Link>
          )}
        </div>
        <TimelineList
          items={recent}
          limit={8}
          fullHistoryHref="/neonatal/historico"
          emptyText="Os registros neonatais aparecerão aqui."
          editable={editable}
          returnTo="/neonatal"
          filterMode="neonatal"
          petNames={petNames}
          showNewRecord={editable}
        />
      </section>
    </div>
  );
}
