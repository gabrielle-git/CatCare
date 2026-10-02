"use client";

import { usePathname } from "next/navigation";
import { FinalLogoImg, FinalNavImg } from "@/components/brand/cuidadim/final-asset-img";
import { ShellNavLink } from "@/components/shell-nav-link";
import { ASSISTANT_UTILITY, resolveShellTarget } from "@/lib/app-navigation";
import { isRecordEditPath } from "@/lib/record-edit-nav";

/** Mobile/tablet header (< lg): brand identity + Assistente utility. Page titles stay in each page. */
export function MobileHeader() {
  const pathname = usePathname();
  const forceDocumentNav = isRecordEditPath(pathname);
  const assistantActive = resolveShellTarget(pathname) === "assistant";

  return (
    <header data-brand="cuidadim" data-theme="light" className="sticky top-0 z-30 lg:hidden">
      <div className="cd-mob-header">
        <ShellNavLink href="/" forceDocumentNav={forceDocumentNav} className="cd-app-mobile-brand focus-ring">
          <FinalLogoImg theme="light" compact />
        </ShellNavLink>
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
      </div>
    </header>
  );
}
