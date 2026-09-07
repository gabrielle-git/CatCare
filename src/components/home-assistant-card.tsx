import Link from "next/link";
import { Bot, ChevronRight } from "lucide-react";

/** Highlight entry to the existing data assistant (not generative AI). */
export function HomeAssistantCard() {
  return (
    <Link
      href="/assistant"
      className="focus-ring mt-5 flex min-w-0 items-center justify-between gap-3 rounded-[24px] border border-[var(--border)] bg-[linear-gradient(135deg,var(--lavender-soft),var(--cream))] p-4 transition hover:-translate-y-0.5 sm:gap-4 sm:p-5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[18px] bg-white/80 text-[var(--lavender-strong)]">
          <Bot size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Assistente CatCare</p>
          <h2 className="mt-0.5 text-balance font-bold">Pergunte aos seus registros</h2>
          <p className="mt-1 text-pretty text-xs text-[var(--muted)]">
            Consulte vacinas, pesos, gastos, compras e próximos cuidados a partir do que você já registrou.
          </p>
          <span className="mt-2 inline-flex text-xs font-bold text-[var(--lavender-strong)]">Abrir assistente</span>
        </div>
      </div>
      <ChevronRight size={19} className="shrink-0 text-[var(--muted)]" aria-hidden="true" />
    </Link>
  );
}
