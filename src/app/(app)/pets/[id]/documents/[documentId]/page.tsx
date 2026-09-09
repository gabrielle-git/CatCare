import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { DocumentAttachmentActions, DocumentFields } from "@/components/document-fields";
import { getAuthenticatedContext } from "@/lib/auth-context";
import { isLiveData } from "@/lib/demo-mode";
import { getPetDocument } from "@/lib/documents";
import { formatFullDate } from "@/lib/format";
import { getPet } from "@/lib/pets";
import { deleteDocumentAttachment, deletePetDocument, updatePetDocument } from "../actions";

async function loadPage(petId: string, documentId: string) {
  if (!(await isLiveData())) return { pet: null, document: null, configured: false, editable: false };
  const ctx = await getAuthenticatedContext();
  if (!ctx) return { pet: null, document: null, configured: true, editable: false };
  const pet = await getPet(ctx.supabase, petId);
  if (!pet) return { pet: null, document: null, configured: true, editable: false };
  const document = await getPetDocument(ctx.supabase, documentId, petId);
  return { pet, document, configured: true, editable: ctx.editable };
}

export default async function PetDocumentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; documentId: string }>;
  searchParams: Promise<{ saved?: string; updated?: string; error?: string }>;
}) {
  const { id, documentId } = await params;
  const flags = await searchParams;
  const { pet, document, configured, editable } = await loadPage(id, documentId);
  if (!pet || !document) notFound();

  const save = updatePetDocument.bind(null, pet.id, document.id);
  const removeDoc = deletePetDocument.bind(null, pet.id, document.id);
  const canRemoveFile = editable && document.attachments.length > 1;

  return (
    <div className="mx-auto w-full max-w-[920px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href={`/pets/${pet.id}/documents`} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Voltar aos documentos
      </Link>

      <header className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">{pet.name}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">{document.title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{document.category} · criado em {formatFullDate(document.created_at)}</p>
      </header>

      {(flags.saved || flags.updated) && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Documento atualizado.</div>}
      {flags.error && <div className="mt-5 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
      {configured && !editable && <div className="mt-5 rounded-[20px] bg-[var(--peach)] px-4 py-3 text-sm">Você pode visualizar, mas só quem edita a família altera ou exclui arquivos.</div>}

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        {document.attachments.map((attachment) => {
          const removeFile = deleteDocumentAttachment.bind(null, pet.id, document.id, attachment.id);
          return (
            <DocumentAttachmentActions
              key={attachment.id}
              attachment={attachment}
              canDelete={canRemoveFile}
              deleteAction={canRemoveFile ? removeFile : undefined}
            />
          );
        })}
      </section>

      {editable && (
        <>
          <form action={save} className="cat-card mt-8 p-5 md:p-7">
            <h2 className="text-lg font-bold">Editar documento</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Altere título/categoria ou acrescente arquivos sem reenviar os existentes.</p>
            <div className="mt-5">
              <DocumentFields
                defaultTitle={document.title}
                defaultCategory={document.category}
                currentAttachments={document.attachments}
                requireFiles={false}
              />
            </div>
            <button className="focus-ring mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--graphite)] px-5 py-4 text-sm font-bold text-white">
              Salvar alterações
            </button>
          </form>

          <form action={removeDoc} className="mt-4">
            <ConfirmButton
              title="Excluir documento?"
              message="O documento e todos os arquivos ligados a ele serão apagados. Esta ação não pode ser desfeita."
              confirmLabel="Excluir definitivamente"
              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800"
            >
              <Trash2 size={16} /> Excluir documento
            </ConfirmButton>
          </form>
        </>
      )}
    </div>
  );
}
