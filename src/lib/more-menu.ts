import type { LucideIcon } from "lucide-react";
import { Settings } from "lucide-react";

export type MoreMenuItem = {
  label: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

export type MoreMenuGroup = {
  id: string;
  label: string;
  items: MoreMenuItem[];
};

/**
 * Overflow after Shell B. Memórias lives in Pets. Conta is a shell utility.
 * `/more` stays routable; the shell no longer shows a Mais trigger (M1B.3).
 */
export const MORE_MENU_GROUPS: MoreMenuGroup[] = [];

export const MORE_MENU_ACCOUNT: MoreMenuItem = {
  label: "Conta e família",
  detail: "Membros, privacidade e seus dados",
  href: "/settings",
  icon: Settings,
  tone: "bg-[var(--mint-soft)]",
};

export const MORE_MENU_HREFS = [
  ...MORE_MENU_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
  "/more",
];

export function isMoreMenuPath(pathname: string): boolean {
  return MORE_MENU_HREFS.some((href) =>
    href === "/more" ? pathname === "/more" || pathname.startsWith("/more/") : pathname === href || pathname.startsWith(`${href}/`),
  );
}
