"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Cat, Home, Menu, Plus } from "lucide-react";
import { MoreMenuSheet } from "@/components/more-menu-sheet";
import { isMoreMenuPath } from "@/lib/more-menu";
import { isRecordEditPath } from "@/lib/record-edit-nav";

const items: {
  href: string;
  label: string;
  icon: typeof Home;
  primary?: boolean;
}[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/pets", label: "Pets", icon: Cat },
  { href: "/records/new", label: "Registrar", icon: Plus, primary: true },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
];

export function BottomNav() {
  const pathname = usePathname();
  const forceDocumentNav = isRecordEditPath(pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreOpen || isMoreMenuPath(pathname);

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[rgba(250,247,242,0.94)] px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-[520px] grid-cols-5 gap-1">
          {items.map(({ href, label, icon: Icon, primary }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            const className = `focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition ${
              primary
                ? "bg-[var(--graphite)] text-white shadow-lg shadow-[#2a2230]/15"
                : active
                  ? "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]"
                  : "text-[var(--muted)]"
            }`;
            const content = (
              <>
                <Icon size={primary ? 21 : 19} strokeWidth={active || primary ? 2.5 : 2} aria-hidden="true" />
                <span>{label}</span>
              </>
            );
            if (forceDocumentNav) {
              return (
                <a key={href} href={href} className={className}>
                  {content}
                </a>
              );
            }
            return (
              <Link key={href} href={href} prefetch={false} className={className}>
                {content}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition ${
              moreActive
                ? "bg-[var(--lavender-soft)] text-[var(--lavender-strong)]"
                : "text-[var(--muted)]"
            }`}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-label="Abrir menu Mais"
          >
            <Menu size={19} strokeWidth={moreActive ? 2.5 : 2} aria-hidden="true" />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      <MoreMenuSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
