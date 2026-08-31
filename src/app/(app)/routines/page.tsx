import Link from "next/link";
import { Plus, Repeat2 } from "lucide-react";
import { RoutineCard, RoutineSection } from "@/components/routine-card";
import { ensureHousehold } from "@/lib/households";
import { demoCareRoutineCompletions, demoCareRoutines, demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { canEdit, getMyRole } from "@/lib/roles";
import {
  getPetRoutineStatus,
  routineListSection,
} from "@/lib/routines-schedule";
import { listCareRoutines, listLatestCompletionsByRoutine } from "@/lib/routines";
import { isLiveData } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";
import type { CareRoutineCompletion, CareRoutineWithPets } from "@/types/database";
import { completeRoutine } from "./actions";

function buildDemoCompletionsMap() {
  const map = new Map<string, Map<string, CareRoutineCompletion>>();
  for (const row of demoCareRoutineCompletions) {
    const byPet = map.get(row.routine_id) ?? new Map<string, CareRoutineCompletion>();
    if (!byPet.has(row.pet_id)) byPet.set(row.pet_id, row);
    map.set(row.routine_id, byPet);
  }
  return map;
}

async function loadRoutinesPage() {
  const now = Date.now();
  if (!(await isLiveData())) {
    return {
      pets: demoPets,
      routines: demoCareRoutines,
      completionsByRoutine: buildDemoCompletionsMap(),
      configured: false,
      editable: false,
      now,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { pets: [], routines: [], completionsByRoutine: new Map(), configured: true, editable: false, now };
  }

  const household = await ensureHousehold(supabase, data.user.id);
  const role = await getMyRole(supabase);
  const [pets, routines] = await Promise.all([
    listPets(supabase, household.id),
    listCareRoutines(supabase, household.id),
  ]);
  const completionsByRoutine = await listLatestCompletionsByRoutine(
    supabase,
    household.id,
    routines.map((r) => r.id),
  );

  return {
    pets,
    routines,
    completionsByRoutine,
    configured: true,
    editable: canEdit(role),
    now,
  };
}

function bucketRoutines(
  routines: CareRoutineWithPets[],
  completionsByRoutine: Map<string, Map<string, CareRoutineCompletion>>,
) {
  const attention: CareRoutineWithPets[] = [];
  const upcoming: CareRoutineWithPets[] = [];
  const asNeeded: CareRoutineWithPets[] = [];
  const paused: CareRoutineWithPets[] = [];

  for (const routine of routines) {
    const byPet = completionsByRoutine.get(routine.id) ?? new Map();
    const petStatuses = routine.pet_ids.map((petId) =>
      getPetRoutineStatus(routine, byPet.get(petId) ?? null),
    );
    const section = routineListSection(routine, petStatuses);
    if (section === "attention") attention.push(routine);
    else if (section === "upcoming") upcoming.push(routine);
    else if (section === "as_needed") asNeeded.push(routine);
    else paused.push(routine);
  }

  return { attention, upcoming, asNeeded, paused };
}

export default async function RoutinesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; completed?: string; error?: string; paused?: string; reactivated?: string }>;
}) {
  const [{ pets, routines, completionsByRoutine, configured, editable }, flags] = await Promise.all([
    loadRoutinesPage(),
    searchParams,
  ]);
  const names = new Map(pets.map((pet) => [pet.id, pet.name]));
  const { attention, upcoming, asNeeded, paused } = bucketRoutines(routines, completionsByRoutine);

  return (
    <div className="mx-auto w-full max-w-[980px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Cuidados recorrentes</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Rotinas</h1>
          <p className="mt-2 max-w-[620px] text-sm text-[var(--muted)]">
            Escovação, higiene e outros cuidados personalizados — com conclusão individual por pet.
          </p>
        </div>
        {editable && (
          <Link
            href="/routines/new"
            className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white"
          >
            <Plus size={18} /> Nova rotina
          </Link>
        )}
      </header>

      {flags.saved && (
        <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          Rotina salva com sucesso.
        </div>
      )}
      {flags.completed && (
        <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          Conclusão registrada para {flags.completed} pet{Number(flags.completed) > 1 ? "s" : ""}.
        </div>
      )}
      {flags.paused && (
        <div className="mt-6 rounded-[20px] bg-[var(--cream)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          Rotina pausada. O histórico foi preservado.
        </div>
      )}
      {flags.reactivated && (
        <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          Rotina reativada.
        </div>
      )}
      {flags.error && (
        <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>
      )}

      <section className="mt-7 cat-card overflow-hidden">
        <div className="flex items-center justify-between bg-[linear-gradient(135deg,var(--lavender-soft),var(--mint-soft))] p-5 md:p-6">
          <div>
            <p className="text-xs font-semibold text-[var(--muted)]">Resumo</p>
            <p className="mt-1 text-lg font-bold">
              {attention.length > 0 ? `${attention.length} rotina(s) pedem atenção hoje` : "Nenhuma pendência urgente"}
            </p>
          </div>
          <span className="grid size-12 place-items-center rounded-[19px] bg-white/75">
            <Repeat2 size={22} />
          </span>
        </div>
      </section>

      <div className="mt-7 space-y-7">
        <RoutineSection title="Hoje / Atrasadas" count={attention.length} empty="Nada pendente por aqui.">
          {attention.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              petNames={names}
              completionsByPet={completionsByRoutine.get(routine.id) ?? new Map()}
              editable={editable && configured}
              completeAction={configured ? completeRoutine.bind(null, routine.id) : undefined}
            />
          ))}
        </RoutineSection>

        <RoutineSection title="Próximas" count={upcoming.length} empty="Sem rotinas futuras agendadas.">
          {upcoming.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              petNames={names}
              completionsByPet={completionsByRoutine.get(routine.id) ?? new Map()}
              editable={editable && configured}
              completeAction={configured ? completeRoutine.bind(null, routine.id) : undefined}
            />
          ))}
        </RoutineSection>

        <RoutineSection title="Quando necessário" count={asNeeded.length} empty="Nenhuma rotina flexível cadastrada.">
          {asNeeded.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              petNames={names}
              completionsByPet={completionsByRoutine.get(routine.id) ?? new Map()}
              editable={editable && configured}
              completeAction={configured ? completeRoutine.bind(null, routine.id) : undefined}
            />
          ))}
        </RoutineSection>

        <RoutineSection title="Pausadas" count={paused.length} empty="Nenhuma rotina pausada.">
          {paused.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              petNames={names}
              completionsByPet={completionsByRoutine.get(routine.id) ?? new Map()}
              editable={editable && configured}
            />
          ))}
        </RoutineSection>
      </div>
    </div>
  );
}
