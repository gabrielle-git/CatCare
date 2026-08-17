"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  CalendarDays,
  Cat,
  HeartPulse,
  Home,
  ImageIcon,
  Plus,
  ReceiptText,
  Settings,
  ShoppingBasket,
  UserRound,
} from "lucide-react";

const sections = [
  {
    label: "Principal",
    items: [
      { href: "/", label: "Visão geral", icon: Home },
      { href: "/pets", label: "Meus gatos", icon: Cat },
      { href: "/records/new", label: "Registrar cuidado", icon: Plus },
      { href: "/assistant", label: "Assistente dos gatos", icon: Bot },
    ],
  },
  {
    label: "Rotina e saúde",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/neonatal", label: "Modo neonatal", icon: HeartPulse },
      { href: "/expenses", label: "Gastos", icon: ReceiptText },
    ],
  },
  {
    label: "Casa e carinho",
    items: [
      { href: "/shopping", label: "Compras e avaliações", icon: ShoppingBasket },
      { href: "/memories", label: "Memórias", icon: ImageIcon },
    ],
  },
];

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-svh w-[272px] shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[rgba(247,241,232,0.86)] px-5 py-5 backdrop-blur lg:flex lg:flex-col">
      <Link href="/" className="focus-ring flex items-center gap-3 rounded-2xl px-2 py-2">
        <span className="grid size-11 place-items-center rounded-[18px] bg-[var(--lavender)] text-white shadow-lg shadow-[#8e7dbe]/20">
          <Cat size={23} strokeWidth={2.4} />
        </span>
        <span>
          <strong className="block text-xl tracking-[-0.04em]">CatCare</strong>
          <span className="text-[11px] text-[var(--muted)]">Nossa família felina</span>
        </span>
      </Link>

      <nav aria-label="Navegação principal" className="mt-6 flex-1 space-y-5">
        {sections.map((section) => (
          <section key={section.label}>
            <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[0.17em] text-[var(--muted)]">{section.label}</p>
            <div className="space-y-1">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`focus-ring flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13px] font-bold transition ${
                      active
                        ? "bg-white text-[var(--foreground)] shadow-sm"
                        : "text-[var(--muted)] hover:bg-white/70 hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="mt-5 border-t border-[var(--border)] pt-3">
        <Link href="/settings" className="focus-ring flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white">
          <span className="grid size-9 shrink-0 place-items-center rounded-[15px] bg-[var(--lavender-soft)]"><UserRound size={17} /></span>
          <span className="min-w-0 flex-1">
            <strong className="block text-[13px]">Conta e família</strong>
            <span className="block truncate text-[10px] text-[var(--muted)]">Entrar ou gerenciar dados</span>
          </span>
          <Settings size={16} className="text-[var(--muted)]" />
        </Link>
      </div>
    </aside>
  );
}
