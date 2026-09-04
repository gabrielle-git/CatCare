import Link from "next/link";
import { ArrowLeft, Repeat2 } from "lucide-react";
import { RoutineFormFields } from "@/components/routine-form-fields";
import { ensureHousehold } from "@/lib/households";
import { demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { isLiveData } from "@/lib/demo-mode";
import { requireEditPage } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { createRoutine } from "../actions";

async function loadPetsForForm() {
  if (!(await isLiveData())) return { pets: demoPets, configured: false };
  await requireEditPage("/routines");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], configured: true };
  const household = await ensureHousehold(supabase, data.user.id);
  return { pets: await listPets(supabase, household.id), configured: true };
}

export default async function NewRoutinePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ pets, configured }, flags] = await Promise.all([loadPetsForForm(), searchParams]);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/routines" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Voltar às rotinas
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[18px] bg-[var(--lavender-soft)]">
          <Repeat2 size={20} />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Novo cuidado recorrente</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">Nova rotina</h1>
        </div>
      </div>
      {flags.error && (
        <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>
      )}
      {!configured && (
        <div className="mt-6 rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--cream)] px-4 py-3 text-sm text-[var(--muted)]">
          Modo demonstração — criação disponível somente com conta real.
        </div>
      )}
      <form action={createRoutine} className="cat-card mt-6 space-y-1 p-5 md:p-7">
        <RoutineFormFields
          pets={pets.map((pet) => ({ id: pet.id, name: pet.name }))}
          disabled={!configured}
          submitLabel="Salvar rotina"
        />
      </form>
    </div>
  );
}
