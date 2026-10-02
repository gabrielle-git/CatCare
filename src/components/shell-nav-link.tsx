import type { AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type ShellNavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  forceDocumentNav: boolean;
  children: ReactNode;
};

export function ShellNavLink({ href, forceDocumentNav, children, ...rest }: ShellNavLinkProps) {
  // On record edit: native <a> bypasses App Router soft-nav hangs when leaving.
  // Future: gate here with unsaved-changes confirm before navigating.
  if (forceDocumentNav) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} prefetch={false} {...rest}>
      {children}
    </Link>
  );
}
