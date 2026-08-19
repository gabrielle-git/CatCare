import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { PetFields } from "@/components/pet-fields";
import { getPet } from "@/lib/pets";
import { createClient } from "@/lib/supabase/server";
import { archivePet, updatePet } from "../../actions";

export default async function EditPetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const pet = await getPet(supabase, id);
  if (!pet) notFound();
  const update = updatePet.bind(null, pet.id);
  const archive = archivePet.bind(null, pet.id);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href={`/pets/${pet.id}`} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Perfil de {pet.name}</Link>
      <h1 className="mt-5 text-3xl font-bold tracking-[-0.04em]">Editar {pet.name}</h1>
      {error && <div role="alert" className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <form action={update} className="cat-card mt-6 p-5 md:p-7">
        <PetFields defaultValues={pet} />
        <button type="submit" className="focus-ring mt-7 w-full rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white">Salvar alterações</button>
      </form>
      <form action={archive} className="mt-4">
        <ConfirmButton message={`Arquivar ${pet.name}? O perfil some das listas, mas todo o histórico fica guardado.`} className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-bold text-[var(--muted)]"><Archive size={17} /> Arquivar pet</ConfirmButton>
      </form>
    </div>
  );
}
