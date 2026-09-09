import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileStack, Plus } from "lucide-react";
import { formatFullDate } from "@/lib/format";
import { getAuthenticatedContext } from "@/lib/auth-context";
import { isLiveData } from "@/lib/demo-mode";
import { listPetDocuments } from "@/lib/documents";
import { getPet } from "@/lib/pets";

async function loadPage(petId: string) {
  if (!(await isLiveData())) return { pet: null, documents: [], configured: false, editable: false };
  const ctx = await getAuthenticatedContext();
  if (!ctx) return { pet: null, documents: [], configured: true, editable: false };
  const pet = await getPet(ctx.supabase, petId);
  if (!pet) return { pet: null, documents: [], configured: true, editable: false };
  const documents = await listPetDocuments(ctx.supabase, petId);
  return { pet, documents, configured: true, editable: ctx.editable };
}

export default async function PetDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; deleted?: string; storage_warning?: string; error?: string }>;
}) {
  const { id } = await params;
  const flags = await searchParams;
  const { pet, documents, configured, editable } = await loadPage(id);
  if (!pet) notFound();

  return (
    <div className="mx-auto w-full max-w-[920px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href={`/pets/${pet.id}`} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Voltar ao perfil
      </Link>

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Arquivo do pet</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Documentos de {pet.name}</h1>
          <p className="mt-2 max-w-[560px] text-sm text-[var(--muted)]">Carteiras, identificação, passaporte e outros papéis importantes — com um ou mais arquivos por documento.</p>
        </div>
        {editable && (
          <Link href={`/pets/${pet.id}/documents/new`} className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white">
            <Plus size={18} /> Novo documento
          </Link>
        )}
      </header>

      {configured && !editable && (
        <div className="mt-6 rounded-[20px] bg-[var(--peach)] px-4 py-3 text-sm">
          Entre na conta com permissão de edição para gerenciar documentos. <Link href="/login" className="font-bold underline">Entrar</Link>
        </div>
      )}
      {flags.deleted && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Documento excluído.</div>}
      {flags.storage_warning && <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">O documento saiu do app, mas a limpeza de um arquivo no Storage pode ter falhado. Não precisa reenviar — isso pode ser reconciliado depois.</div>}
      {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

      {documents.length === 0 ? (
        <section className="cat-card mt-6 p-8 text-center">
          <FileStack className="mx-auto text-[var(--lavender-strong)]" size={28} />
          <h2 className="mt-3 text-lg font-bold">Nenhum documento ainda</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">Guarde a carteira de vacinação, comprovante de microchip ou qualquer papel importante de {pet.name}.</p>
        </section>
      ) : (
        <section className="mt-6 space-y-3">
          {documents.map((document) => (
            <Link key={document.id} href={`/pets/${pet.id}/documents/${document.id}`} className="focus-ring cat-card flex items-center justify-between gap-4 p-4 md:p-5">
              <div className="min-w-0">
                <p className="truncate text-base font-bold">{document.title}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {document.category} · {document.attachment_count} {document.attachment_count === 1 ? "arquivo" : "arquivos"} · {formatFullDate(document.created_at)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--lavender-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--lavender-strong)]">Ver</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
