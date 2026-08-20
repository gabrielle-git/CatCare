import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { RecordFields } from "@/components/record-fields";
import { isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { canEdit, getMyRole, requireEditPage } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createRecord } from "./actions";

async function loadPetOptions() {
  if (!hasSupabaseEnv()) return { pets: demoPets, configured: false, editable: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], configured: true, editable: false };
  const role = await getMyRole(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { pets: await listPets(supabase, household.id), configured: true, editable: canEdit(role) };
}

export default async function NewRecordPage({ searchParams }: { searchParams: Promise<{ pet?: string; type?: string; types?: string; lock_type?: string; return_to?: string; context?: string; error?: string; record_title?: string; suggested_title?: string; title?: string; suggestedTitle?: string }> }) {
  if (hasSupabaseEnv()) await requireEditPage("/");
  const query = await searchParams;
  const initialTitle = query.record_title ?? query.suggested_title ?? query.suggestedTitle ?? query.title;
  const neonatalContext = query.context === "neonatal";
  const returnTo = query.return_to ?? (neonatalContext ? "/neonatal" : undefined);
  const initialTypes = query.types
    ? query.types.split(",").map((item) => item.trim()).filter(Boolean)
    : query.type
      ? [query.type]
      : undefined;
  const backHref = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : query.pet
      ? `/pets/${query.pet}`
      : neonatalContext
        ? "/neonatal"
        : "/";
  const { pets, configured, editable } = await loadPetOptions();
  const options = pets.map((pet) => ({ id: pet.id, name: pet.name, neonatal: isNeonatalPet(pet) }));

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href={backHref} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar</Link>
      <header className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Um toque para registrar</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">O que aconteceu?</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Peso, saúde e cuidados ficam juntos na linha do tempo do pet.</p>
      </header>

      {!configured && <div className="mt-6 rounded-[20px] bg-[var(--lavender-soft)] px-4 py-3 text-sm"><strong>Modo de demonstração.</strong> Explore o formulário; conecte o Supabase para salvar.</div>}
      {query.error && <div role="alert" className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{query.error}</div>}

      {configured && pets.length === 0 ? (
        <section className="cat-card mt-6 p-7 text-center"><h2 className="text-lg font-bold">Primeiro precisamos de um pet</h2><p className="mt-2 text-sm text-[var(--muted)]">Cadastre o perfil para associar os cuidados corretamente.</p><Link href="/pets/new" className="focus-ring mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white"><Plus size={17} /> Adicionar pet</Link></section>
      ) : (
        <form action={createRecord} className="cat-card mt-6 p-5 md:p-7">
          <RecordFields
            key={`${query.pet ?? ""}-${query.type ?? ""}-${query.types ?? ""}-${initialTitle ?? ""}-${query.lock_type ?? ""}-${returnTo ?? ""}-${query.context ?? ""}`}
            pets={options}
            initialPetId={query.pet}
            initialType={query.type}
            initialTypes={initialTypes}
            initialTitle={initialTitle}
            initialLockType={query.lock_type}
            returnTo={returnTo}
            neonatalContext={neonatalContext}
            disabled={!configured}
          />
        </form>
      )}
    </div>
  );
}
