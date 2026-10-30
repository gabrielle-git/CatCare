import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { RecordFields } from "@/components/record-fields";
import { DirectUploadForm } from "@/components/direct-upload-form";
import { isNeonatalPet } from "@/lib/format";
import { ensureHousehold } from "@/lib/households";
import { demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { canEdit, getMyRole, requireEditPage } from "@/lib/roles";
import { isLiveData } from "@/lib/demo-mode";
import { createClient } from "@/lib/supabase/server";
import { resolveReturnTo, safeReturnPath } from "@/lib/safe-return-path";
import { createRecord } from "./actions";

async function loadPetOptions() {
  if (!(await isLiveData())) return { pets: demoPets, configured: false, editable: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { pets: [], configured: true, editable: false };
  const role = await getMyRole(supabase);
  const household = await ensureHousehold(supabase, data.user.id);
  return { pets: await listPets(supabase, household.id), configured: true, editable: canEdit(role) };
}

export default async function NewRecordPage({ searchParams }: { searchParams: Promise<{ pet?: string; type?: string; types?: string; lock_type?: string; return_to?: string; context?: string; error?: string; record_title?: string; suggested_title?: string; title?: string; suggestedTitle?: string; vaccine_key?: string; dose_label?: string }> }) {
  if (await isLiveData()) await requireEditPage("/");
  const query = await searchParams;
  const initialTitle = query.record_title ?? query.suggested_title ?? query.suggestedTitle ?? query.title;
  const neonatalContext = query.context === "neonatal";
  const returnTo = resolveReturnTo(query.return_to) ?? (neonatalContext ? "/neonatal" : undefined);
  const backFallback = query.pet
    ? `/pets/${query.pet}`
    : neonatalContext
      ? "/neonatal"
      : "/pets";
  const backHref = safeReturnPath(returnTo, backFallback);
  const initialTypes = query.types
    ? query.types.split(",").map((item) => item.trim()).filter(Boolean)
    : query.type
      ? [query.type]
      : undefined;
  const { pets, configured, editable } = await loadPetOptions();
  const options = pets.map((pet) => ({ id: pet.id, name: pet.name, neonatal: isNeonatalPet(pet), species: pet.species }));

  return (
    <div className="cd-pet-page">
      <Link href={backHref} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-semibold text-[var(--muted)]"><ArrowLeft size={16} aria-hidden /> Voltar</Link>
      <header className="mt-5">
        <p className="cd-page-kicker">Um toque para registrar</p>
        <h1 className="cd-page-title">Registrar cuidado</h1>
        <p className="cd-page-lede">Registre saúde, rotina e cuidados na história do seu pet.</p>
      </header>

      {query.error && <div role="alert" className="mt-6 text-sm font-semibold text-[var(--danger)]">{query.error}</div>}

      {configured && pets.length === 0 ? (
        <section className="mt-8"><h2 className="cd-pet-section-title">Primeiro um pet</h2><p className="cd-body">Cadastre o perfil para associar os cuidados corretamente.</p><Link href="/pets/new" className="focus-ring mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--lavender-strong)]"><Plus size={15} aria-hidden /> Adicionar pet</Link></section>
      ) : (
        <DirectUploadForm action={createRecord} mode="records-create" className="mt-6" previewOnly={!configured}>
          <RecordFields
            key={`${query.pet ?? ""}-${query.type ?? ""}-${query.types ?? ""}-${initialTitle ?? ""}-${query.lock_type ?? ""}-${query.vaccine_key ?? ""}-${query.dose_label ?? ""}-${returnTo ?? ""}-${query.context ?? ""}`}
            pets={options}
            initialPetId={query.pet}
            initialType={query.type}
            initialTypes={initialTypes}
            initialTitle={initialTitle}
            initialLockType={query.lock_type}
            initialVaccineKey={query.vaccine_key}
            initialDoseLabel={query.dose_label}
            returnTo={returnTo}
            neonatalContext={neonatalContext}
          />
        </DirectUploadForm>
      )}
    </div>
  );
}
