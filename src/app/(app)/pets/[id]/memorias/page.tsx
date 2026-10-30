import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Heart, ImageIcon, Plus, Sparkles } from "lucide-react";
import { PetChrome } from "@/components/pet-chrome";
import { getAuthenticatedContext } from "@/lib/auth-context";
import { isLiveData } from "@/lib/demo-mode";
import { demoPets } from "@/lib/mock-data";
import { getPet } from "@/lib/pets";

async function loadPet(id: string) {
  if (!(await isLiveData())) {
    return { pet: demoPets.find((item) => item.id === id) ?? null, editable: false };
  }
  const ctx = await getAuthenticatedContext();
  if (!ctx) return { pet: null, editable: false };
  const pet = await getPet(ctx.supabase, id);
  return { pet, editable: ctx.editable };
}

/**
 * Memórias tab for a pet — honest about household-scoped album.
 * No fake pet filter; preserves /memories functionality via links.
 */
export default async function PetMemoriasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { pet, editable } = await loadPet(id);
  if (!pet) notFound();

  return (
    <PetChrome pet={pet} editable={editable} active="memorias">
      <section className="cd-pet-section" aria-label={`Memórias e ${pet.name}`}>
        <h2 className="cd-pet-section-title">Memórias</h2>
        <p className="cd-pet-lede">
          O álbum da família ainda é compartilhado. O filtro por pet ainda não existe — não vamos fingir que
          estas memórias são só de {pet.name}.
        </p>

        <ul className="cd-pet-rows mt-4">
          <li>
            <Link href="/memories" className="cd-pet-row focus-ring">
              <span className="cd-pet-row-icon" data-tone="memoria">
                <ImageIcon size={14} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-semibold">Álbum da família</span>
                <span className="cd-meta block">Todas as memórias do household</span>
              </span>
              <span className="cd-pet-row-cta">Abrir</span>
            </Link>
          </li>
          <li>
            <Link href="/memories?type=milestone" className="cd-pet-row focus-ring">
              <span className="cd-pet-row-icon" data-tone="memoria">
                <Sparkles size={14} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-semibold">Primeiras vezes</span>
                <span className="cd-meta block">Marcos da família</span>
              </span>
              <span className="cd-pet-row-cta">Abrir</span>
            </Link>
          </li>
          <li>
            <Link href="/memories?type=diary" className="cd-pet-row focus-ring">
              <span className="cd-pet-row-icon" data-tone="memoria">
                <Heart size={14} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-semibold">Dia a dia</span>
                <span className="cd-meta block">Cenas comuns</span>
              </span>
              <span className="cd-pet-row-cta">Abrir</span>
            </Link>
          </li>
          <li>
            <Link href="/memories?type=photo" className="cd-pet-row focus-ring">
              <span className="cd-pet-row-icon" data-tone="memoria">
                <Camera size={14} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-semibold">Fotos favoritas</span>
                <span className="cd-meta block">Seleção do álbum</span>
              </span>
              <span className="cd-pet-row-cta">Abrir</span>
            </Link>
          </li>
        </ul>

        {editable ? (
          <div className="cd-pet-links mt-4">
            <Link href="/memories/new" className="cd-pet-text-link focus-ring inline-flex items-center gap-1.5">
              <Plus size={14} aria-hidden />
              Guardar memória
            </Link>
          </div>
        ) : null}

        <p className="mt-5 rounded-[16px] bg-[var(--cream)] px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">
          Indicativo interno (futuro): vínculo por pet no álbum — sem comportamento falso agora. Use Pets → Memórias
          da família ou /memories.
        </p>
      </section>
    </PetChrome>
  );
}
