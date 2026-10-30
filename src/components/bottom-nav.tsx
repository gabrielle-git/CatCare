"use client";

import { usePathname } from "next/navigation";
import { Plus, Wallet } from "lucide-react";
import { FinalNavImg } from "@/components/brand/cuidadim/final-asset-img";
import { FourPointStar } from "@/components/brand/cuidadim/icons/FourPointStar";
import { ShellNavLink } from "@/components/shell-nav-link";
import { PRIMARY_NAV, type PrimaryNavId, resolveShellTarget } from "@/lib/app-navigation";
import { isRecordEditPath } from "@/lib/record-edit-nav";

function PrimaryNavIcon({ id, size = 19 }: { id: PrimaryNavId; size?: number }) {
  if (id === "registrar") {
    return (
      <span className="cd-shell-nav-action" aria-hidden="true">
        <Plus size={size - 5} strokeWidth={2} />
      </span>
    );
  }
  if (id === "financas") return <Wallet size={size} strokeWidth={1.6} aria-hidden="true" />;
  if (id === "inicio") return <FinalNavImg id="agora" theme="light" size={size} />;
  return <FinalNavImg id={id} theme="light" size={size} />;
}

/**
 * Mobile/tablet shell (< lg) — Exploration B:
 * five-destination dock (Início · Pets · Registrar · Cuidados · Finanças).
 * Registrar is the center action. Mais + Conta live in the mobile header.
 * z-40 keeps the legacy fixed z-50 overlays above the bar.
 */
export function BottomNav() {
  const pathname = usePathname();
  const forceDocumentNav = isRecordEditPath(pathname);
  const target = resolveShellTarget(pathname);

  return (
    <div data-brand="cuidadim" data-theme="light" className="cd-app-mobile-bar fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="cd-app-mobile-bar-inner">
        <nav aria-label="Navegação principal" className="cd-mob-dock cd-app-dock-b">
          {PRIMARY_NAV.map((item) => {
            const active = target === item.id;
            return (
              <ShellNavLink
                key={item.id}
                href={item.href}
                forceDocumentNav={forceDocumentNav}
                className="cd-mob-dock-item focus-ring"
                data-nav={item.id}
                data-active={active ? "true" : undefined}
                aria-current={active ? "page" : undefined}
              >
                <span className="cd-mob-dock-icon">
                  <PrimaryNavIcon id={item.id} />
                  {active ? <FourPointStar size={7} color="#A8834A" className="cd-nav-star" /> : null}
                </span>
                <span>{item.label}</span>
              </ShellNavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
