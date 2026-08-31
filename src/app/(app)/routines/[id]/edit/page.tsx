import Link from "next/link";
import { ArrowLeft, Repeat2 } from "lucide-react";
import { RoutineFormFields } from "@/components/routine-form-fields";
import { ensureHousehold } from "@/lib/households";
import { demoCareRoutines, demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { isLiveData } from "@/lib/demo-mode";
import { canEdit, getMyRole, requireEditPage } from "@/lib/roles";
import { getCareRoutine } from "@/lib/routines";
import { createClient } from "@/lib/supabase/server";
import { updateRoutine } from "../../actions";

async function loadEditRoutine(id: string) {
  if (!(await isLiveData())) {
    const routine = demoCareRoutines.find((item) => item.id === id) ?? null;
    return { routine, pets: demoPets, configured: false, editable: false };
  }

  await requireEditPage("/routines");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { routine: null, pets: [], configured: true, editable: false };

  const household = await ensureHousehold(supabase, data.user.id);
  const role = await getMyRole(supabase);
  const [routine, pets] = await Promise.all([
    getCareRoutine(supabase, household.id, id),
    listPets(supabase, household.id),
  ]);
  return { routine, pets, configured: true, editable: canEdit(role) };
}

export default async function EditRoutinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const [{ routine, pets, configured, editable }, flags] = await Promise.all([
    loadEditRoutine(id),
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

  const save = updateRoutine.bind(null, id);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href={`/routines/${id}`} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Voltar à rotina
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[18px] bg-[var(--lavender-soft)]">
          <Repeat2 size={20} />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Editar rotina</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">{routine.title}</h1>
        </div>
      </div>
      {flags.error && (
        <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>
      )}
      {!configured && (
        <div className="mt-6 rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--cream)] px-4 py-3 text-sm text-[var(--muted)]">
          Modo demonstração — edição disponível somente com conta real.
        </div>
      )}
      <form action={save} className="cat-card mt-6 space-y-1 p-5 md:p-7">
        <RoutineFormFields
          pets={pets.map((pet) => ({ id: pet.id, name: pet.name }))}
          defaultValues={routine}
          disabled={!configured || !editable}
          submitLabel="Salvar alterações"
        />
      </form>
    </div>
  );
}
