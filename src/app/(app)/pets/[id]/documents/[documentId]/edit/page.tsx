import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { DocumentExistingFilesPanel, DocumentFields } from "@/components/document-fields";
import { getAuthenticatedContext } from "@/lib/auth-context";
import { isLiveData } from "@/lib/demo-mode";
import { getPetDocument } from "@/lib/documents";
import { getPet } from "@/lib/pets";
import { deleteDocumentAttachment, deletePetDocument, updatePetDocument } from "../../actions";

async function loadPage(petId: string, documentId: string) {
  if (!(await isLiveData())) return { pet: null, document: null, configured: false, editable: false };
  const ctx = await getAuthenticatedContext();
  if (!ctx) return { pet: null, document: null, configured: true, editable: false };
  const pet = await getPet(ctx.supabase, petId);
  if (!pet) return { pet: null, document: null, configured: true, editable: false };
  const document = await getPetDocument(ctx.supabase, documentId, petId);
  return { pet, document, configured: true, editable: ctx.editable };
}

export default async function EditPetDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; documentId: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { id, documentId } = await params;
  const flags = await searchParams;
  const { pet, document, configured, editable } = await loadPage(id, documentId);
  if (!pet || !document) notFound();
  if (configured && !editable) {
    notFound();
  }

  const save = updatePetDocument.bind(null, pet.id, document.id);
  const removeDoc = deletePetDocument.bind(null, pet.id, document.id);

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href={`/pets/${pet.id}/documents/${document.id}`} className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]">
        <ArrowLeft size={17} /> Voltar ao documento
      </Link>

      <header className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">{pet.name}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Editar documento</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Título e categoria são do documento. Os arquivos abaixo pertencem a ele.</p>
      </header>

      {flags.updated && <div className="mt-5 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Alterações salvas.</div>}
      {flags.error && <div className="mt-5 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}

      <div className="cat-card mt-6 space-y-6 p-5 md:p-7">
        <DocumentExistingFilesPanel
          attachments={document.attachments}
          removeAttachmentAction={(attachmentId) => deleteDocumentAttachment.bind(null, pet.id, document.id, attachmentId, "edit")}
        />

        <form action={save}>
          <DocumentFields
            defaultTitle={document.title}
            defaultCategory={document.category}
            existingStoredCount={document.attachments.length}
            requireFiles={false}
            submitLabel="Salvar alterações"
          />
        </form>
      </div>

      <form action={removeDoc} className="mt-6">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Zona de perigo</p>
        <ConfirmButton
          title="Excluir documento?"
          message="O documento e todos os arquivos ligados a ele serão apagados. Esta ação não pode ser desfeita."
          confirmLabel="Excluir documento inteiro"
          className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-800"
        >
          <Trash2 size={16} /> Excluir documento inteiro
        </ConfirmButton>
      </form>
    </div>
  );
}
