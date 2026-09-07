import Link from "next/link";
import {
  Bot,
  ChevronRight,
  HeartHandshake,
  HeartPulse,
  History,
  ImageIcon,
  ReceiptText,
  Repeat2,
  Settings,
  ShoppingBasket,
} from "lucide-react";

const resources = [
  { label: "Assistente", detail: "Pergunte aos seus registros — vacinas, pesos, gastos e compras", href: "/assistant", icon: Bot, tone: "bg-[var(--lavender-soft)]" },
  { label: "Histórico", detail: "Cuidados de todos os pets, com filtros por pet, data e tipo", href: "/historico", icon: History, tone: "bg-[var(--cream)]" },
  { label: "Neonatal", detail: "Alimentação, peso e eliminações dos filhotes", href: "/neonatal", icon: HeartPulse, tone: "bg-[var(--rose-soft)]" },
  { label: "Rotinas", detail: "Escovação, higiene e cuidados personalizados recorrentes", href: "/routines", icon: Repeat2, tone: "bg-[var(--rose-soft)]" },
  { label: "Plano de saúde", detail: "Coparticipação e operadora de cada pet", href: "/health-plan", icon: HeartHandshake, tone: "bg-[var(--lavender-soft)]" },
  { label: "Gastos", detail: "Quanto a família investiu em cada pet", href: "/expenses", icon: ReceiptText, tone: "bg-[#fbead9]" },
  { label: "Compras e avaliações", detail: "Preço, loja, qualidade e aceitação dos produtos", href: "/shopping", icon: ShoppingBasket, tone: "bg-[var(--mint-soft)]" },
  { label: "Memórias", detail: "Fotos, marcos e pequenos momentos", href: "/memories", icon: ImageIcon, tone: "bg-[var(--rose-soft)]" },
];

export default function MorePage() {
  return (
    <div className="mx-auto w-full max-w-[860px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Outras áreas</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">Mais</h1>

      <section className="mt-7">
        <p className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Recursos</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {resources.map(({ label, detail, href, icon: Icon, tone }) => (
            <Link
              key={href}
              href={href}
              className="cat-card focus-ring flex items-center gap-4 p-4 transition hover:-translate-y-0.5"
            >
              <span className={`grid size-11 shrink-0 place-items-center rounded-[18px] ${tone}`}>
                <Icon size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block">{label}</strong>
                <span className="mt-1 block text-xs text-[var(--muted)]">{detail}</span>
              </span>
              <ChevronRight size={17} className="shrink-0 text-[var(--muted)]" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <p className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Conta</p>
        <Link
          href="/settings"
          className="cat-card focus-ring flex items-center gap-4 p-4 transition hover:-translate-y-0.5"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-[18px] bg-[var(--mint-soft)]">
            <Settings size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block">Conta e família</strong>
            <span className="mt-1 block text-xs text-[var(--muted)]">Membros, privacidade e seus dados</span>
          </span>
          <ChevronRight size={17} className="shrink-0 text-[var(--muted)]" />
        </Link>
      </section>
    </div>
  );
}
