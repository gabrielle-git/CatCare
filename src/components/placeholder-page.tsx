import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PlaceholderPage({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="px-5 pb-8 pt-6">
      <Link href="/" className="focus-ring inline-flex items-center gap-1 rounded-lg py-2 text-xs font-semibold text-[var(--muted)]"><ArrowLeft size={15} /> Início</Link>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
      <div className="cat-card mt-6 bg-[var(--lavender)] p-4 text-sm">Estrutura criada na Sprint 0. A funcionalidade entra nas próximas sprints.</div>
    </div>
  );
}
