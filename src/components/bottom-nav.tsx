"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { FinalNavImg } from "@/components/brand/cuidadim/final-asset-img";
import { FourPointStar } from "@/components/brand/cuidadim/icons/FourPointStar";
import { MoreMenuSheet } from "@/components/more-menu-sheet";
import { ShellNavLink } from "@/components/shell-nav-link";
import {
  MORE_ACTION,
  PRIMARY_NAV,
  REGISTER_ACTION,
  isMobileMoreActive,
  resolveShellTarget,
} from "@/lib/app-navigation";
import { isRecordEditPath } from "@/lib/record-edit-nav";

/**
 * Mobile/tablet shell (< lg) — Visual Freeze V1 "Mobile A":
 * action strip (Registrar cuidado + Mais) above a dock of exactly four destinations.
 * z-40 keeps the legacy fixed z-50 overlays above the bar.
 */
export function BottomNav() {
  const pathname = usePathname();
  const forceDocumentNav = isRecordEditPath(pathname);
  const target = resolveShellTarget(pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreOpen || isMobileMoreActive(target);
  const registerActive = target === "register";

  return (
    <>
      <div data-brand="cuidadim" data-theme="light" className="cd-app-mobile-bar fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="cd-app-mobile-bar-inner">
          <div className="cd-mob-action-strip">
            <ShellNavLink
              href={REGISTER_ACTION.href}
              forceDocumentNav={forceDocumentNav}
              className="cd-reg-soft cd-reg-full focus-ring"
              data-active={registerActive ? "true" : undefined}
              aria-current={registerActive ? "page" : undefined}
            >
              <span>{REGISTER_ACTION.label}</span>
              {registerActive ? <FourPointStar size={11} /> : null}
            </ShellNavLink>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="cd-mob-mais-link focus-ring"
              data-active={moreActive ? "true" : undefined}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-label="Abrir menu Mais"
            >
              {MORE_ACTION.label}
              <ChevronDown size={13} strokeWidth={1.75} aria-hidden="true" className={moreOpen ? "cd-home-pets-chevron-open" : undefined} />
            </button>
          </div>

          <nav aria-label="Navegação principal" className="cd-mob-dock cd-mob-dock-4">
            {PRIMARY_NAV.map((item) => {
              const active = target === item.id;
              return (
                <ShellNavLink
                  key={item.id}
                  href={item.href}
                  forceDocumentNav={forceDocumentNav}
                  className="cd-mob-dock-item focus-ring"
                  data-active={active ? "true" : undefined}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="cd-mob-dock-icon">
                    <FinalNavImg id={item.id} theme="light" size={19} />
                    {active ? <FourPointStar size={7} className="cd-nav-star" /> : null}
                  </span>
                  <span>{item.label}</span>
                </ShellNavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <MoreMenuSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
