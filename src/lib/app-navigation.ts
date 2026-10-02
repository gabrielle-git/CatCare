import { MORE_MENU_ACCOUNT, isMoreMenuPath } from "./more-menu";

/**
 * Cuidadim app shell navigation contract — single source of truth for the
 * desktop rail, the mobile dock/action strip and the mobile header.
 * Paths are the existing routes; nothing here creates or renames a route.
 */

export type PrimaryNavId = "agora" | "pets" | "cuidados" | "memorias";

export type ShellTarget = PrimaryNavId | "register" | "assistant" | "account" | "more";

export type PrimaryNavDestination = {
  id: PrimaryNavId;
  label: string;
  href: string;
  /** Route prefixes owned by this destination (segment-aware). */
  matches: readonly string[];
};

/** Exactly four primary destinations. Registrar, Mais and Assistente are not tabs. */
export const PRIMARY_NAV: readonly PrimaryNavDestination[] = [
  { id: "agora", label: "Agora", href: "/", matches: [] },
  { id: "pets", label: "Pets", href: "/pets", matches: ["/pets"] },
  {
    id: "cuidados",
    label: "Cuidados",
    href: "/historico",
    matches: ["/historico", "/agenda", "/routines", "/neonatal", "/health-plan"],
  },
  { id: "memorias", label: "Memórias", href: "/memories", matches: ["/memories"] },
];

/** Primary action, separate from the primary destinations. */
export const REGISTER_ACTION = {
  label: "Registrar cuidado",
  shortLabel: "Registrar",
  href: "/records/new",
} as const;

/** Shell utility (header on mobile, top of the rail on desktop). */
export const ASSISTANT_UTILITY = {
  label: "Assistente",
  href: "/assistant",
} as const;

/** Support link at the bottom of the desktop rail; lives inside Mais on mobile. */
export const ACCOUNT_LINK = {
  label: MORE_MENU_ACCOUNT.label,
  shortLabel: "Conta",
  href: MORE_MENU_ACCOUNT.href,
} as const;

/** Secondary overflow: mobile sheet, desktop rail popover, /more page. */
export const MORE_ACTION = {
  label: "Mais",
  href: "/more",
} as const;

export function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Which shell element owns the current route. Primary destinations win over
 * Mais, so /agenda lights Cuidados even though Agenda is also listed in Mais.
 * /pets/[id]/historico stays in Pets; /records/[id]/edit lights nothing.
 */
export function resolveShellTarget(pathname: string): ShellTarget | null {
  if (pathname === "/") return "agora";
  if (pathMatches(pathname, REGISTER_ACTION.href)) return "register";
  for (const destination of PRIMARY_NAV) {
    if (destination.matches.some((prefix) => pathMatches(pathname, prefix))) return destination.id;
  }
  if (pathMatches(pathname, ASSISTANT_UTILITY.href)) return "assistant";
  if (pathMatches(pathname, ACCOUNT_LINK.href)) return "account";
  if (isMoreMenuPath(pathname)) return "more";
  return null;
}

/** On mobile, Conta lives inside Mais, so Mais carries both states. */
export function isMobileMoreActive(target: ShellTarget | null): boolean {
  return target === "more" || target === "account";
}
