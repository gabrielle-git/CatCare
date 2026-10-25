import Link from "next/link";
import { ChevronRight, HeartHandshake, ReceiptText, ShoppingBasket } from "lucide-react";

/**
 * Transitional Finanças hub (M1A shell only).
 * Reuses existing Gastos / Compras / Plano routes. Resumo is a future feature —
 * listed as navigation intent only, with no metrics or fake data.
 */
const LINKS = [
  { href: "/expenses", label: "Gastos", detail: "Investimento da família", icon: ReceiptText },
  { href: "/shopping", label: "Compras", detail: "Preço, loja e aceitação", icon: ShoppingBasket },
  { href: "/health-plan", label: "Planos", detail: "Plano de saúde por pet", icon: HeartHandshake },
] as const;

export default function FinancasHubPage() {
  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-10 pt-7 md:px-8 lg:py-10">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Finanças</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Finanças</h1>
      <p className="mt-2 max-w-prose text-sm text-[var(--muted)]">
        Destino principal do shell. Os módulos abaixo já existem; Resumo (visão do mês) é uma feature nova e ainda não
        foi implementada.
      </p>

      <ul className="mt-7 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        <li className="flex items-center gap-3 py-3.5 opacity-70">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#fbead9] text-[var(--text-primary)]">
            <ReceiptText size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm">Resumo</strong>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">Visão do mês — feature nova, ainda sem tela</span>
          </span>
          <span className="shrink-0 rounded-full border border-dashed border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
            Em breve
          </span>
        </li>
        {LINKS.map(({ href, label, detail, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="focus-ring flex items-center gap-3 py-3.5 transition hover:bg-black/[0.02]">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--mint-soft)] text-[var(--text-primary)]">
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
