import Link from "next/link";
import { Archive, Camera, Heart, ImageIcon, Pencil, Plus, RotateCcw, Sparkles, Trash2, Users } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { MemoryGallery } from "@/components/memory-gallery";
import { ensureHousehold } from "@/lib/households";
import { listMemories } from "@/lib/memories";
import { demoArchivedMemories, demoMemories, demoPets } from "@/lib/mock-data";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { MemoryType } from "@/types/database";
import { archiveMemory, deleteMemoryPermanently, restoreMemory } from "./actions";

export const dynamic = "force-dynamic";

const typeMeta: Record<MemoryType, { label: string; icon: typeof Sparkles; tone: string }> = {
  milestone: { label: "Primeira vez / marco", icon: Sparkles, tone: "bg-[var(--rose-soft)] text-[#9a536c]" },
  diary: { label: "Dia a dia", icon: Heart, tone: "bg-[var(--mint-soft)] text-[var(--success)]" },
  photo: { label: "Foto favorita", icon: Camera, tone: "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]" },
};

async function loadPage(archived: boolean) {
  if (!hasSupabaseEnv()) return { memories: archived ? demoArchivedMemories : demoMemories, pets: demoPets, configured: false, editable: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { memories: [], pets: [], configured: true, editable: false };
  const household = await ensureHousehold(supabase, data.user.id);
  const [memories, pets] = await Promise.all([listMemories(supabase, household.id, archived), listPets(supabase, household.id)]);
  return { memories, pets, configured: true, editable: true };
}

export default async function MemoriesPage({ searchParams }: { searchParams: Promise<{ view?: string; type?: string; saved?: string; updated?: string; archived?: string; restored?: string; deleted?: string }> }) {
  const flags = await searchParams;
  const archivedView = flags.view === "archived";
  const { memories, pets, configured, editable } = await loadPage(archivedView);
  const selectedType = ["milestone", "diary", "photo"].includes(flags.type ?? "") ? flags.type as MemoryType : null;
  const visible = selectedType ? memories.filter((memory) => memory.type === selectedType) : memories;
  const names = new Map(pets.map((pet) => [pet.id, pet.name]));
  const sharedCount = memories.filter((memory) => memory.pet_ids.length > 1).length;
  const milestoneCount = memories.filter((memory) => memory.type === "milestone").length;

  return <div className="mx-auto w-full max-w-[1120px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Álbum da família</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] md:text-4xl">Memórias</h1><p className="mt-2 max-w-[680px] text-sm text-[var(--muted)]">Primeiras vezes, marcos e cenas comuns que um dia viram as melhores histórias.</p></div>
      <Link href="/memories/new" className="focus-ring inline-flex w-fit items-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white"><Plus size={18} /> Guardar memória</Link>
    </header>
    {!configured && <div className="mt-6 rounded-[20px] bg-[var(--lavender-soft)] px-4 py-3 text-sm"><strong>Modo de demonstração.</strong> As capas abaixo são ilustrações; suas memórias reais sempre terão uma foto enviada por você.</div>}
    {configured && !editable && <div className="mt-6 rounded-[20px] bg-[var(--peach)] px-4 py-3 text-sm">Entre na sua conta para ver e guardar as memórias privadas da família. <Link href="/login" className="font-bold underline">Entrar</Link></div>}
    {(flags.saved || flags.updated) && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Memória guardada com carinho.</div>}
    {flags.archived && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm">Memória excluída do álbum e guardada em Arquivadas. As fotos continuam protegidas e ela pode ser restaurada.</div>}
    {flags.restored && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm">Memória restaurada para o álbum principal.</div>}
    {flags.deleted && <div className="mt-6 rounded-[20px] bg-[var(--peach)] px-4 py-3 text-sm">Memória e foto apagadas permanentemente.</div>}

    <section className="mt-6 grid gap-3 sm:grid-cols-3">
      <div className="cat-card p-4"><ImageIcon size={18} className="text-[var(--lavender-strong)]" /><p className="mt-3 text-2xl font-bold">{memories.length}</p><p className="text-xs text-[var(--muted)]">lembranças nesta visão</p></div>
      <div className="cat-card p-4"><Sparkles size={18} className="text-[#9a536c]" /><p className="mt-3 text-2xl font-bold">{milestoneCount}</p><p className="text-xs text-[var(--muted)]">primeiras vezes e marcos</p></div>
      <div className="cat-card p-4"><Users size={18} className="text-[var(--success)]" /><p className="mt-3 text-2xl font-bold">{sharedCount}</p><p className="text-xs text-[var(--muted)]">momentos com mais de um gato</p></div>
    </section>

    <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">{([{ value: null, label: "Todas" }, { value: "milestone", label: "Primeiras vezes" }, { value: "diary", label: "Dia a dia" }, { value: "photo", label: "Fotos favoritas" }] as const).map((filter) => {
        const query = new URLSearchParams({ ...(archivedView ? { view: "archived" } : {}), ...(filter.value ? { type: filter.value } : {}) });
        const active = selectedType === filter.value;
        return <Link key={filter.label} href={`/memories?${query}`} className={`focus-ring shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ${active ? "bg-[var(--graphite)] text-white" : "border border-[var(--border)] bg-white text-[var(--muted)]"}`}>{filter.label}</Link>;
      })}</div>
      <div className="flex gap-2"><Link href="/memories" className={`focus-ring rounded-2xl px-3.5 py-2.5 text-xs font-bold ${!archivedView ? "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]" : "text-[var(--muted)]"}`}>Álbum</Link><Link href="/memories?view=archived" className={`focus-ring inline-flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-bold ${archivedView ? "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]" : "text-[var(--muted)]"}`}><Archive size={14} /> Arquivadas</Link></div>
    </div>

    {visible.length === 0 ? <section className="cat-card mt-6 p-8 text-center"><ImageIcon className="mx-auto text-[var(--lavender-strong)]" size={29} /><h2 className="mt-3 text-lg font-bold">{archivedView ? "Nenhuma memória arquivada" : "Este capítulo ainda está vazio"}</h2><p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{archivedView ? "Quando você arquivar uma lembrança, ela ficará guardada aqui." : "Guarde uma foto e conte o que aconteceu — até os dias comuns merecem espaço."}</p></section> : <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{visible.map((memory) => {
      const meta = typeMeta[memory.type];
      const Icon = meta.icon;
      const petNames = memory.pet_ids.map((id) => names.get(id)).filter(Boolean) as string[];
      const archive = archiveMemory.bind(null, memory.id);
      const restore = restoreMemory.bind(null, memory.id);
      const remove = deleteMemoryPermanently.bind(null, memory.id);
      return <article key={memory.id} className={`cat-card min-w-0 overflow-hidden ${archivedView ? "opacity-80" : ""}`}>
        <div className="relative">
          <MemoryGallery title={memory.title} media={memory.media} />
          <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold shadow-sm ${meta.tone}`}><Icon size={12} /> {meta.label}</span>
        </div>
        <div className="p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(memory.occurred_at))}</p><h2 className="mt-2 text-lg font-bold leading-snug">{memory.title}</h2>{memory.body && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">{memory.body}</p>}<div className="mt-4 flex flex-wrap gap-1.5">{petNames.map((name) => <span key={name} className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-[10px] font-bold">{name}</span>)}</div>
          {editable ? <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-4">{archivedView ? <><form action={restore}><button className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--mint-soft)] px-3 py-2.5 text-xs font-bold text-[var(--success)]"><RotateCcw size={14} /> Restaurar</button></form><form action={remove}><ConfirmButton message="Apagar esta memória e todas as fotos permanentemente? Esta ação não pode ser desfeita." className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-bold text-[var(--danger)]"><Trash2 size={14} /> Apagar de vez</ConfirmButton></form></> : <><Link href={`/memories/${memory.id}/edit`} className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--lavender-soft)] px-3 py-2.5 text-xs font-bold text-[var(--lavender-strong)]"><Pencil size={14} /> Editar</Link><form action={archive}><ConfirmButton message="Excluir esta memória do álbum? Ela irá para Arquivadas e poderá ser restaurada." className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-bold text-[var(--danger)]"><Trash2 size={14} /> Excluir</ConfirmButton></form></>}</div> : <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-4" title="Disponível depois de entrar na conta">{archivedView ? <><button disabled className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--mint-soft)] px-3 py-2.5 text-xs font-bold text-[var(--success)]"><RotateCcw size={14} /> Restaurar</button><button disabled className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-bold text-[var(--danger)]"><Trash2 size={14} /> Apagar de vez</button></> : <><button disabled className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--lavender-soft)] px-3 py-2.5 text-xs font-bold text-[var(--lavender-strong)]"><Pencil size={14} /> Editar</button><button disabled className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-bold text-[var(--danger)]"><Trash2 size={14} /> Excluir</button></>}</div>}
        </div>
      </article>;
    })}</section>}
  </div>;
}
