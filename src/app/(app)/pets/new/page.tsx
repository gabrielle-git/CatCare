import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PetFields } from "@/components/pet-fields";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createPet } from "../actions";

export default async function NewPetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = hasSupabaseEnv();
  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/pets" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Meus pets</Link>
      <header className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Novo membro</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Adicionar pet</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Só o essencial agora. Você pode completar e editar depois.</p>
      </header>

      {!configured && <div className="mt-6 rounded-[20px] bg-[var(--rose-soft)] px-4 py-3 text-sm"><strong>Modo de demonstração:</strong> conecte o Supabase para salvar um novo perfil.</div>}
      {error && <div role="alert" className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form action={createPet} className="cat-card mt-6 p-5 md:p-7">
        <PetFields includeInitialWeight disabled={!configured} />
        <button disabled={!configured} type="submit" className="focus-ring mt-7 w-full rounded-2xl bg-[var(--graphite)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2a2230]/15">Salvar pet</button>
      </form>
    </div>
  );
}
