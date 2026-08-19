import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { RecordFields, type RecordFieldDefaults } from "@/components/record-fields";
import { isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { listPets } from "@/lib/pets";
import type { RecordSource } from "@/lib/record-form";
import { getEditableRecord } from "@/lib/records";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { deleteRecord, updateRecord } from "../../actions";

export default async function EditRecordPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ source?: string; kind?: string; error?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const source = (query.source === "weight" || query.source === "health" || query.source === "neonatal" ? query.source : null) as RecordSource | null;
  if (!hasSupabaseEnv() || !source) {
    return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Registro não encontrado.</div>;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Entre na conta para editar registros.</div>;

  const household = await ensureHousehold(supabase, data.user.id);
  const [record, pets] = await Promise.all([
    getEditableRecord(supabase, household.id, id, source),
    listPets(supabase, household.id),
  ]);
  if (!record) return <div className="mx-auto max-w-[760px] px-5 py-10 text-sm">Registro não encontrado.</div>;

  const petOptions = pets.map((pet) => ({ id: pet.id, name: pet.name, neonatal: isNeonatalPet(pet) }));
  const save = updateRecord.bind(null, id, source);
  const remove = deleteRecord.bind(null, id, source, record.pet_id);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href={`/pets/${record.pet_id}`} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar ao pet</Link>
      <header className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Histórico</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Editar registro</h1>
      </header>
      {query.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{query.error}</div>}
      <form action={save} className="cat-card mt-6 p-5 md:p-7">
        <RecordFields pets={petOptions} mode="edit" defaultValues={{ ...record, record_type: record.kind as RecordFieldDefaults["record_type"] }} submitLabel="Salvar alterações" />
      </form>
      <section className="mt-5 rounded-[22px] border border-red-100 bg-white p-5">
        <h2 className="font-bold">Apagar registro</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">Remove este cuidado do histórico permanentemente.</p>
        <form action={remove} className="mt-4">
          <input type="hidden" name="return_to" value={`/pets/${record.pet_id}`} />
          <ConfirmButton message="Apagar este registro permanentemente? Esta ação não pode ser desfeita." className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-bold text-[var(--danger)]"><Trash2 size={15} /> Apagar registro</ConfirmButton>
        </form>
      </section>
    </div>
  );
}
