import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  HeartHandshake,
  HeartPulse,
  ReceiptText,
  Repeat2,
  Settings,
  ShoppingBasket,
} from "lucide-react";

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
 * Secondary modules for /more, the mobile Mais sheet and the desktop rail Mais popover.
 * Primary destinations (Agora, Pets, Cuidados, Memórias), Registrar and Assistente
 * live in the shell contract (`app-navigation.ts`) and are not repeated here.
 */
export const MORE_MENU_GROUPS: MoreMenuGroup[] = [
  {
    id: "care",
    label: "Cuidados",
    items: [
      { label: "Agenda", detail: "Lembretes e próximos cuidados", href: "/agenda", icon: CalendarDays, tone: "bg-[var(--lavender-soft)]" },
      { label: "Rotinas", detail: "Cuidados que se repetem", href: "/routines", icon: Repeat2, tone: "bg-[var(--rose-soft)]" },
      { label: "Neonatal", detail: "Alimentação, peso e eliminações", href: "/neonatal", icon: HeartPulse, tone: "bg-[var(--rose-soft)]" },
      { label: "Plano de saúde", detail: "Coparticipação e operadora", href: "/health-plan", icon: HeartHandshake, tone: "bg-[var(--lavender-soft)]" },
    ],
  },
  {
    id: "home-finance",
    label: "Casa e finanças",
    items: [
      { label: "Gastos", detail: "Investimento da família", href: "/expenses", icon: ReceiptText, tone: "bg-[#fbead9]" },
      { label: "Compras", detail: "Preço, loja e aceitação", href: "/shopping", icon: ShoppingBasket, tone: "bg-[var(--mint-soft)]" },
    ],
  },
];

export const MORE_MENU_ACCOUNT: MoreMenuItem = {
  label: "Conta e família",
  detail: "Membros, privacidade e seus dados",
  href: "/settings",
  icon: Settings,
  tone: "bg-[var(--mint-soft)]",
};

export const MORE_MENU_HREFS = [
  ...MORE_MENU_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
  MORE_MENU_ACCOUNT.href,
  "/more",
];

export function isMoreMenuPath(pathname: string): boolean {
  return MORE_MENU_HREFS.some((href) => (href === "/more" ? pathname === "/more" || pathname.startsWith("/more/") : pathname === href || pathname.startsWith(`${href}/`)));
}
