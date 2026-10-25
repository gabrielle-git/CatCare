import Link from "next/link";
import { CalendarDays, ChevronRight, HeartPulse, History, Repeat2 } from "lucide-react";

/**
 * Transitional Cuidados hub (M1A shell only).
 * Domains stay on existing routes; full Visão geral / Saúde / Alimentação e higiene
 * arrive in later care-migration phases — no fabricated content here.
 */
const LINKS = [
  { href: "/historico", label: "Histórico", detail: "Tudo o que já foi registrado na família", icon: History },
  { href: "/agenda", label: "Agenda", detail: "Lembretes e compromissos temporais", icon: CalendarDays },
  { href: "/routines", label: "Rotinas", detail: "Cuidados planejados para se repetir", icon: Repeat2 },
  { href: "/neonatal", label: "Neonatal", detail: "Filhotes em fase neonatal", icon: HeartPulse },
] as const;

export default function CuidadosHubPage() {
  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-10 pt-7 md:px-8 lg:py-10">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Cuidados</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Cuidados</h1>
      <p className="mt-2 max-w-prose text-sm text-[var(--muted)]">
        Atalhos para as áreas de cuidado já existentes. A organização completa (Visão geral, Saúde, Alimentação e
        higiene) chega na migração de Cuidados — esta página só sustenta a navegação do shell.
      </p>

      <ul className="mt-7 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {LINKS.map(({ href, label, detail, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="focus-ring flex items-center gap-3 py-3.5 transition hover:bg-black/[0.02]">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--lavender-soft)] text-[var(--text-primary)]">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm">{label}</strong>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{detail}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
