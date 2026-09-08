import type { LucideIcon } from "lucide-react";
import {
  Bot,
  HeartHandshake,
  HeartPulse,
  History,
  ImageIcon,
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

/** Shared secondary modules for /more and the mobile Mais sheet. */
export const MORE_MENU_GROUPS: MoreMenuGroup[] = [
  {
    id: "care",
    label: "Cuidado",
    items: [
      { label: "Histórico", detail: "O que aconteceu com a família", href: "/historico", icon: History, tone: "bg-[var(--cream)]" },
      { label: "Neonatal", detail: "Alimentação, peso e eliminações", href: "/neonatal", icon: HeartPulse, tone: "bg-[var(--rose-soft)]" },
      { label: "Rotinas", detail: "Cuidados que se repetem", href: "/routines", icon: Repeat2, tone: "bg-[var(--rose-soft)]" },
    ],
  },
  {
    id: "health",
    label: "Saúde",
    items: [
      { label: "Plano de saúde", detail: "Coparticipação e operadora", href: "/health-plan", icon: HeartHandshake, tone: "bg-[var(--lavender-soft)]" },
    ],
  },
  {
    id: "org",
    label: "Organização",
    items: [
      { label: "Assistente", detail: "Pergunte aos seus registros", href: "/assistant", icon: Bot, tone: "bg-[var(--lavender-soft)]" },
      { label: "Memórias", detail: "Fotos e pequenos momentos", href: "/memories", icon: ImageIcon, tone: "bg-[var(--rose-soft)]" },
    ],
  },
  {
    id: "money",
    label: "Financeiro",
    items: [
      { label: "Gastos", detail: "Investimento da família", href: "/expenses", icon: ReceiptText, tone: "bg-[#fbead9]" },
      { label: "Compras e avaliações", detail: "Preço, loja e aceitação", href: "/shopping", icon: ShoppingBasket, tone: "bg-[var(--mint-soft)]" },
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
