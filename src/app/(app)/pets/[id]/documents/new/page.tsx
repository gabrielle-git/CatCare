import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FilePlus2 } from "lucide-react";
import { DocumentFields } from "@/components/document-fields";
import { getAuthenticatedContext } from "@/lib/auth-context";
import { isLiveData } from "@/lib/demo-mode";
import { getPet } from "@/lib/pets";
import { createPetDocument } from "../actions";

async function loadPage(petId: string) {
  if (!(await isLiveData())) return { pet: null, configured: false, editable: false };
  const ctx = await getAuthenticatedContext();
  if (!ctx) return { pet: null, configured: true, editable: false };
  const pet = await getPet(ctx.supabase, petId);
  return { pet, configured: true, editable: ctx.editable };
}

export default async function NewPetDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const flags = await searchParams;
  const { pet, configured, editable } = await loadPage(id);
  if (!pet) notFound();
  const action = createPetDocument.bind(null, pet.id);
  // One UUID per form render — retries of this form reuse the same id (idempotent create).
  const documentId = crypto.randomUUID();

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href={`/pets/${pet.id}/documents`} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Voltar aos documentos
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[18px] bg-[var(--lavender-soft)]"><FilePlus2 size={20} /></span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">{pet.name}</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">Novo documento</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">Um documento lógico pode ter várias páginas ou arquivos (frente, verso, PDF extra).</p>
      {configured && !editable && <div className="mt-6 rounded-[20px] bg-[var(--peach)] px-4 py-3 text-sm"><Link href="/login" className="font-bold underline">Entre na conta</Link> para cadastrar documentos.</div>}
      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
      <form action={action} className="cat-card mt-6 p-5 md:p-7">
        <DocumentFields disabled={!editable} requireFiles documentId={documentId} submitLabel="Salvar documento" />
      </form>
    </div>
  );
}
