"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { FinalLogoImg, FinalNavImg } from "@/components/brand/cuidadim/final-asset-img";
import { FourPointStar } from "@/components/brand/cuidadim/icons/FourPointStar";
import { IconFamilia } from "@/components/brand/cuidadim/icons/icons";
import { MoreMenuPopover } from "@/components/more-menu-sheet";
import { ShellNavLink } from "@/components/shell-nav-link";
import {
  ACCOUNT_LINK,
  ASSISTANT_UTILITY,
  MORE_ACTION,
  PRIMARY_NAV,
  REGISTER_ACTION,
  resolveShellTarget,
} from "@/lib/app-navigation";
import { isRecordEditPath } from "@/lib/record-edit-nav";

/** Desktop rail (lg+) — Visual Freeze V1 "Desktop A · rail compacto". */
export function DesktopSidebar() {
  const pathname = usePathname();
  const forceDocumentNav = isRecordEditPath(pathname);
  const target = resolveShellTarget(pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreBottom, setMoreBottom] = useState(0);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const registerActive = target === "register";
  const assistantActive = target === "assistant";
  const accountActive = target === "account";
  const moreActive = moreOpen || target === "more";

  function openMore() {
    const rect = moreButtonRef.current?.getBoundingClientRect();
    setMoreBottom(rect ? Math.max(8, window.innerHeight - rect.bottom) : 8);
    setMoreOpen(true);
  }

  return (
    <aside data-brand="cuidadim" data-theme="light" className="sticky top-0 hidden h-svh w-[84px] shrink-0 lg:block">
      <div className="cd-med-rail cd-app-rail">
        <ShellNavLink href="/" forceDocumentNav={forceDocumentNav} className="cd-app-rail-brand focus-ring">
          <FinalLogoImg theme="light" compact />
        </ShellNavLink>

        <ShellNavLink
          href={ASSISTANT_UTILITY.href}
          forceDocumentNav={forceDocumentNav}
          className="cd-med-util focus-ring"
          data-active={assistantActive ? "true" : undefined}
          aria-current={assistantActive ? "page" : undefined}
        >
          <FinalNavImg id="assistente" theme="light" size={16} />
          <span>{ASSISTANT_UTILITY.label}</span>
        </ShellNavLink>

        <nav aria-label="Navegação principal" className="cd-med-nav">
          {PRIMARY_NAV.map((item) => {
            const active = target === item.id;
            return (
              <ShellNavLink
                key={item.id}
                href={item.href}
                forceDocumentNav={forceDocumentNav}
                className="cd-med-item focus-ring"
                data-active={active ? "true" : undefined}
                aria-current={active ? "page" : undefined}
              >
                <FinalNavImg id={item.id} theme="light" size={18} />
                <span>{item.label}</span>
                {active ? (
                  <>
                    <span className="cd-rail-indicator" aria-hidden="true" />
                    <FourPointStar size={6} className="cd-nav-star cd-rail-star" />
                  </>
                ) : null}
              </ShellNavLink>
            );
          })}
        </nav>

        <div className="cd-med-rail-footer">
          <ShellNavLink
            href={REGISTER_ACTION.href}
            forceDocumentNav={forceDocumentNav}
            className="cd-reg-soft cd-reg-rail focus-ring"
            data-active={registerActive ? "true" : undefined}
            aria-current={registerActive ? "page" : undefined}
            aria-label={REGISTER_ACTION.label}
          >
            <span>{REGISTER_ACTION.shortLabel}</span>
            {registerActive ? <FourPointStar size={9} /> : null}
          </ShellNavLink>

          <button
            ref={moreButtonRef}
            type="button"
            onClick={openMore}
            className="cd-med-mais focus-ring"
            data-active={moreActive ? "true" : undefined}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-label="Abrir menu Mais"
          >
            <span>{MORE_ACTION.label}</span>
            <ChevronDown size={12} strokeWidth={1.75} aria-hidden="true" className={moreOpen ? "cd-home-pets-chevron-open" : undefined} />
          </button>

          <ShellNavLink
            href={ACCOUNT_LINK.href}
            forceDocumentNav={forceDocumentNav}
            className="cd-med-account focus-ring"
            data-active={accountActive ? "true" : undefined}
            aria-current={accountActive ? "page" : undefined}
            aria-label={ACCOUNT_LINK.label}
          >
            <IconFamilia size={15} aria-hidden="true" />
            <span>{ACCOUNT_LINK.shortLabel}</span>
          </ShellNavLink>
        </div>
      </div>

      <MoreMenuPopover open={moreOpen} onClose={() => setMoreOpen(false)} bottomOffset={moreBottom} />
    </aside>
  );
}
