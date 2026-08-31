import Link from "next/link";
import { ArrowLeft, PauseCircle, PlayCircle } from "lucide-react";
import { RoutineCard } from "@/components/routine-card";
import { RoutineIcon } from "@/components/routine-icon";
import { ensureHousehold } from "@/lib/households";
import {
  demoCareRoutineCompletions,
  demoCareRoutines,
  demoPets,
} from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { formatCompletionGroupLabel, groupRoutineCompletions } from "@/lib/routine-history";
import {
  formatPreferredTime,
  formatRecurrenceLabel,
} from "@/lib/routines-schedule";
import { getCareRoutine, listLatestCompletionsByRoutine, listRoutineCompletions } from "@/lib/routines";
import { isLiveData } from "@/lib/demo-mode";
import { canEdit, getMyRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { CareRoutineCompletion } from "@/types/database";
import { completeRoutine, setRoutineActive } from "../actions";

function buildDemoCompletionsForRoutine(routineId: string) {
  return demoCareRoutineCompletions.filter((row) => row.routine_id === routineId);
}

function buildDemoLatestMap(routineId: string) {
  const map = new Map<string, CareRoutineCompletion>();
  for (const row of buildDemoCompletionsForRoutine(routineId)) {
    if (!map.has(row.pet_id)) map.set(row.pet_id, row);
  }
  return map;
}

async function loadRoutineDetail(id: string) {
  if (!(await isLiveData())) {
    const routine = demoCareRoutines.find((item) => item.id === id) ?? null;
    return {
      routine,
      pets: demoPets,
      completions: routine ? buildDemoCompletionsForRoutine(id) : [],
      latestByPet: routine ? buildDemoLatestMap(id) : new Map(),
      configured: false,
      editable: false,
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { routine: null, pets: [], completions: [], latestByPet: new Map(), configured: true, editable: false };
  }

  const household = await ensureHousehold(supabase, data.user.id);
  const role = await getMyRole(supabase);
  const routine = await getCareRoutine(supabase, household.id, id);
  if (!routine) {
    return { routine: null, pets: [], completions: [], latestByPet: new Map(), configured: true, editable: canEdit(role) };
  }

  const [pets, completions, latestMap] = await Promise.all([
    listPets(supabase, household.id),
    listRoutineCompletions(supabase, household.id, id, 40),
    listLatestCompletionsByRoutine(supabase, household.id, [id]),
  ]);

  return {
    routine,
    pets,
    completions,
    latestByPet: latestMap.get(id) ?? new Map(),
    configured: true,
    editable: canEdit(role),
  };
}

export default async function RoutineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; paused?: string; reactivated?: string }>;
}) {
  const { id } = await params;
  const [{ routine, pets, completions, latestByPet, configured, editable }, flags] = await Promise.all([
    loadRoutineDetail(id),
    searchParams,
  ]);

  if (!routine) {
    return (
      <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">
        Rotina não encontrada.{" "}
        <Link href="/routines" className="font-bold underline">
          Voltar
        </Link>
      </div>
    );
  }

  const names = new Map(pets.map((pet) => [pet.id, pet.name]));
  const history = groupRoutineCompletions(completions);
  const pause = setRoutineActive.bind(null, id, false);
  const reactivate = setRoutineActive.bind(null, id, true);
  const complete = configured ? completeRoutine.bind(null, id) : undefined;

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/routines" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Voltar às rotinas
      </Link>

      <header className="mt-4 flex items-start gap-3">
        <span className="grid size-12 place-items-center rounded-[18px] bg-[var(--lavender-soft)] text-[var(--lavender-strong)]">
          <RoutineIcon iconKey={routine.icon_key} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-[-0.04em]">{routine.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {routine.pet_ids.map((petId) => names.get(petId) ?? "Pet").join(" + ")}
            {" · "}
            {formatRecurrenceLabel(routine.recurrence_days)}
            {formatPreferredTime(routine.preferred_time) ? ` · ${formatPreferredTime(routine.preferred_time)}` : ""}
          </p>
        </div>
      </header>

      {flags.updated && (
        <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          Alterações salvas.
        </div>
      )}
      {flags.paused && (
        <div className="mt-6 rounded-[20px] bg-[var(--cream)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          Rotina pausada.
        </div>
      )}
      {flags.reactivated && (
        <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          Rotina reativada.
        </div>
      )}

      {routine.instructions && (
        <section className="cat-card mt-6 p-5">
          <h2 className="text-sm font-bold">Instruções</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{routine.instructions}</p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Status atual</h2>
        <RoutineCard
          routine={routine}
          petNames={names}
          completionsByPet={latestByPet}
          editable={editable && configured}
          completeAction={complete}
        />
      </section>

      {editable && configured && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/routines/${id}/edit`}
            className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-[var(--lavender-soft)] px-4 py-2.5 text-sm font-bold text-[var(--lavender-strong)]"
          >
            Editar rotina
          </Link>
          {routine.active ? (
            <form action={pause}>
              <button
                type="submit"
                className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold"
              >
                <PauseCircle size={16} /> Pausar
              </button>
            </form>
          ) : (
            <form action={reactivate}>
              <button
                type="submit"
                className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-bold"
              >
                <PlayCircle size={16} /> Reativar
              </button>
            </form>
          )}
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Histórico recente</h2>
        {history.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">
            Ainda não há conclusões registradas.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((group) => (
              <li
                key={group.completionIds.join("-")}
                className="rounded-[18px] border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold"
              >
                {formatCompletionGroupLabel(
                  group.completedAt,
                  group.petIds.map((petId) => names.get(petId) ?? "Pet"),
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
