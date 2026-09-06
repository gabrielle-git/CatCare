import { ArrowLeft, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { EditRecordForm } from "@/components/edit-record-form";
import { RecordFields, type RecordFieldDefaults } from "@/components/record-fields";
import { getAuthenticatedContext } from "@/lib/auth-context";
import { isNeonatalPet } from "@/lib/format";
import { listPets } from "@/lib/pets";
import type { RecordSource } from "@/lib/record-form";
import { getEditableRecord } from "@/lib/records";
import { isLiveData } from "@/lib/demo-mode";
import { getPerfTraceId, perfLog, timed } from "@/lib/perf";
import { safeReturnPath } from "@/lib/safe-return-path";
import { deleteRecord, updateRecord } from "../../actions";

export default async function EditRecordPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ source?: string; kind?: string; return_to?: string; error?: string }> }) {
  const pageStart = performance.now();
  const trace = getPerfTraceId();
  perfLog("/records/:id/edit", "start");

  const { id } = await params;
  const query = await searchParams;
  const source = (query.source === "weight" || query.source === "health" || query.source === "neonatal" ? query.source : null) as RecordSource | null;
  if (!(await timed("/records/:id/edit.isLiveData", () => isLiveData())) || !source) {
    return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Registro não encontrado.</div>;
  }

  const ctx = await getAuthenticatedContext();
  if (!ctx) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Entre na conta para editar registros.</div>;

  const [record, pets] = await Promise.all([
    timed("/records/:id/edit.selectRecord", () => getEditableRecord(ctx.supabase, ctx.household.id, id, source)),
    timed("/records/:id/edit.listPets", () => listPets(ctx.supabase, ctx.household.id)),
  ]);
  if (!record) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Registro não encontrado.</div>;

  const returnTo = safeReturnPath(query.return_to, `/pets/${record.pet_id}`);
  const petOptions = pets.map((pet) => ({ id: pet.id, name: pet.name, neonatal: isNeonatalPet(pet) }));
  const save = updateRecord.bind(null, id, source);
  const remove = deleteRecord.bind(null, id, source, record.pet_id);

  console.log(`[CATCARE_PERF][trace ${trace}][/records/:id/edit] total=${Math.round(performance.now() - pageStart)}ms`);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      {/* Native <a>: leaving edit via soft-nav can hang; document navigation is reliable. */}
      <a href={returnTo} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar</a>
      <header className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Histórico</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Editar registro</h1>
      </header>
      <EditRecordForm action={save} className="cat-card mt-6 p-5 md:p-7" initialError={query.error ?? null}>
        <RecordFields
          pets={petOptions}
          mode="edit"
          allowTypeChange={source === "health"}
          returnTo={returnTo}
          defaultValues={{
            ...record,
            record_type: record.kind as RecordFieldDefaults["record_type"],
            vaccine_key: record.vaccine_key,
            dose_label: record.dose_label,
          }}
          submitLabel="Salvar alterações"
        />
      </EditRecordForm>
      <section className="mt-5 rounded-[22px] border border-red-100 bg-white p-5">
        <h2 className="font-bold">Apagar registro</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">Remove este cuidado do histórico permanentemente.</p>
        <form action={remove} className="mt-4">
          <input type="hidden" name="return_to" value={returnTo} />
          <ConfirmButton message="Apagar este registro permanentemente? Esta ação não pode ser desfeita." className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-bold text-[var(--danger)]"><Trash2 size={15} /> Apagar registro</ConfirmButton>
        </form>
      </section>
    </div>
  );
}
