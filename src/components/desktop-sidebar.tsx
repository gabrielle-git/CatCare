"use client";

import { usePathname } from "next/navigation";
import { Plus, Wallet } from "lucide-react";
import { FinalLogoImg, FinalNavImg } from "@/components/brand/cuidadim/final-asset-img";
import { FourPointStar } from "@/components/brand/cuidadim/icons/FourPointStar";
import { IconFamilia } from "@/components/brand/cuidadim/icons/icons";
import { ShellNavLink } from "@/components/shell-nav-link";
import {
  ACCOUNT_LINK,
  ASSISTANT_UTILITY,
  PRIMARY_NAV,
  type PrimaryNavId,
  resolveShellTarget,
} from "@/lib/app-navigation";
import { isRecordEditPath } from "@/lib/record-edit-nav";

const LOGO_WIDTH = 70;

function PrimaryNavIcon({ id }: { id: PrimaryNavId }) {
  if (id === "registrar") {
    return (
      <span className="cd-shell-nav-action" aria-hidden="true">
        <Plus size={14} strokeWidth={2} />
      </span>
    );
  }
  if (id === "financas") return <Wallet size={18} strokeWidth={1.6} aria-hidden="true" />;
  if (id === "inicio") return <FinalNavImg id="agora" theme="light" size={18} />;
  return <FinalNavImg id={id} theme="light" size={18} />;
}

/** Desktop rail (lg+) — Exploration B: Início · Pets · Registrar · Cuidados · Finanças. */
export function DesktopSidebar() {
  const pathname = usePathname();
  const forceDocumentNav = isRecordEditPath(pathname);
  const target = resolveShellTarget(pathname);
  const assistantActive = target === "assistant";
  const accountActive = target === "account";

  return (
    <aside data-brand="cuidadim" data-theme="light" className="sticky top-0 hidden h-svh w-[84px] shrink-0 lg:block">
      <div className="cd-med-rail cd-app-rail">
        <ShellNavLink
          href="/"
          forceDocumentNav={forceDocumentNav}
          className="cd-app-rail-brand focus-ring"
          style={{ width: LOGO_WIDTH }}
          aria-label="Cuidadim"
        >
          <FinalLogoImg theme="light" className="cd-app-rail-logo-img" />
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
                data-nav={item.id}
                data-active={active ? "true" : undefined}
                aria-current={active ? "page" : undefined}
              >
                <PrimaryNavIcon id={item.id} />
                <span>{item.label}</span>
                {active ? (
                  <>
                    <span className="cd-rail-indicator" aria-hidden="true" />
                    <FourPointStar size={6} color="#A8834A" className="cd-nav-star cd-rail-star" />
                  </>
                ) : null}
              </ShellNavLink>
            );
          })}
        </nav>

        <div className="cd-med-rail-footer">
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
    </aside>
  );
}
