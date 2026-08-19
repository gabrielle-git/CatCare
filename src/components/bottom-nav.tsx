"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Cat, Home, Menu, Plus } from "lucide-react";

const items = [
  { href: "/", label: "Início", icon: Home },
  { href: "/pets", label: "Pets", icon: Cat },
  { href: "/records/new", label: "Registrar", icon: Plus, primary: true },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/more", label: "Mais", icon: Menu },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[rgba(250,247,242,0.94)] px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-[520px] grid-cols-5 gap-1">
        {items.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition ${
                primary
                  ? "bg-[var(--graphite)] text-white shadow-lg shadow-[#2a2230]/15"
                  : active
                    ? "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]"
                    : "text-[var(--muted)]"
              }`}
            >
              <Icon size={primary ? 21 : 19} strokeWidth={active || primary ? 2.5 : 2} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
