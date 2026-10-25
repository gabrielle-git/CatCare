"use client";

import { usePathname } from "next/navigation";
import { FinalLogoImg, FinalNavImg } from "@/components/brand/cuidadim/final-asset-img";
import { IconFamilia } from "@/components/brand/cuidadim/icons/icons";
import { ShellNavLink } from "@/components/shell-nav-link";
import { ACCOUNT_LINK, ASSISTANT_UTILITY, resolveShellTarget } from "@/lib/app-navigation";
import { isRecordEditPath } from "@/lib/record-edit-nav";

/**
 * Mobile/tablet header (< lg): brand + Assistente + Conta.
 * Page titles stay in each page.
 */
export function MobileHeader() {
  const pathname = usePathname();
  const forceDocumentNav = isRecordEditPath(pathname);
  const target = resolveShellTarget(pathname);
  const assistantActive = target === "assistant";
  const accountActive = target === "account";

  return (
    <>
      <header data-brand="cuidadim" data-theme="light" className="sticky top-0 z-30 lg:hidden">
        <div className="cd-mob-header">
          <ShellNavLink href="/" forceDocumentNav={forceDocumentNav} className="cd-app-mobile-brand focus-ring" aria-label="Cuidadim">
            <FinalLogoImg theme="light" compact />
          </ShellNavLink>
          <div className="flex items-center gap-1">
            <ShellNavLink
              href={ASSISTANT_UTILITY.href}
              forceDocumentNav={forceDocumentNav}
              className="cd-util-btn focus-ring"
              data-active={assistantActive ? "true" : undefined}
              aria-current={assistantActive ? "page" : undefined}
              aria-label={ASSISTANT_UTILITY.label}
            >
              <FinalNavImg id="assistente" theme="light" size={20} />
            </ShellNavLink>
            <ShellNavLink
              href={ACCOUNT_LINK.href}
              forceDocumentNav={forceDocumentNav}
              className="cd-util-btn focus-ring"
              data-active={accountActive ? "true" : undefined}
              aria-current={accountActive ? "page" : undefined}
              aria-label={ACCOUNT_LINK.label}
            >
              <IconFamilia size={17} aria-hidden="true" />
            </ShellNavLink>
          </div>
        </div>
      </header>
    </>
  );
}
