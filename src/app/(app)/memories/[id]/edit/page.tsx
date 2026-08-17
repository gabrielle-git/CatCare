import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { MemoryFields } from "@/components/memory-fields";
import { ensureHousehold } from "@/lib/households";
import { getMemory } from "@/lib/memories";
import { listPets } from "@/lib/pets";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { archiveMemory, updateMemory } from "../../actions";

export default async function EditMemoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  if (!hasSupabaseEnv()) redirect("/memories");
  const { id } = await params;
  const flags = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const household = await ensureHousehold(supabase, data.user.id);
  const [memory, pets] = await Promise.all([getMemory(supabase, household.id, id), listPets(supabase, household.id)]);
  if (!memory) notFound();
  if (memory.archived_at) redirect("/memories?view=archived");
  const update = updateMemory.bind(null, id);
  const archive = archiveMemory.bind(null, id);
  return <div className="mx-auto w-full max-w-[820px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
    <Link href="/memories" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Voltar às memórias</Link>
    <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Editar lembrança</p><h1 className="mt-1 text-3xl font-bold tracking-[-0.04em]">{memory.title}</h1>
    {flags.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{flags.error}</div>}
    <form action={update} className="cat-card mt-6 p-5 md:p-7"><MemoryFields pets={pets} defaultValues={memory} /><button className="focus-ring mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-5 py-4 text-sm font-bold text-white"><Save size={18} /> Salvar alterações</button></form>
    <section className="mt-5 rounded-[22px] border border-red-100 bg-white p-5"><h2 className="font-bold">Excluir do álbum</h2><p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">A memória e todas as fotos vão para Arquivadas. Você poderá restaurar ou apagar de vez depois.</p><form action={archive} className="mt-4"><ConfirmButton message="Excluir esta memória do álbum? Ela irá para Arquivadas e poderá ser restaurada." className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-3 text-xs font-bold text-[var(--danger)]"><Trash2 size={15} /> Excluir memória</ConfirmButton></form></section>
  </div>;
}
