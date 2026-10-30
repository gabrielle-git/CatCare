import { MORE_MENU_ACCOUNT, isMoreMenuPath } from "./more-menu";

/**
 * Cuidadim app shell navigation — Exploration B (M1A).
 * Single source of truth for the desktop rail, the mobile dock and header utilities.
 * Paths reuse existing routes; `/cuidados` and `/financas` are transitional hubs only.
 */

export type PrimaryNavId = "inicio" | "pets" | "registrar" | "cuidados" | "financas";

export type ShellTarget = PrimaryNavId | "assistant" | "account" | "more";

export type PrimaryNavDestination = {
  id: PrimaryNavId;
  label: string;
  href: string;
  /** Route prefixes owned by this destination (segment-aware). */
  matches: readonly string[];
  /** Primary action treatment inside the five-destination architecture. */
  action?: boolean;
};

/**
 * Five primary destinations (Exploration B).
 * Registrar is part of the architecture — center action on mobile, action glyph on desktop.
 */
export const PRIMARY_NAV: readonly PrimaryNavDestination[] = [
  { id: "inicio", label: "Início", href: "/", matches: [] },
  { id: "pets", label: "Pets", href: "/pets", matches: ["/pets", "/memories"] },
  {
    id: "registrar",
    label: "Registrar",
    href: "/records/new",
    matches: ["/records/new"],
    action: true,
  },
  {
    id: "cuidados",
    label: "Cuidados",
    href: "/cuidados",
    matches: ["/cuidados", "/historico", "/agenda", "/routines", "/neonatal"],
  },
  {
    id: "financas",
    label: "Finanças",
    href: "/financas",
    matches: ["/financas", "/expenses", "/shopping", "/health-plan"],
  },
];

/** Same destination as PRIMARY_NAV registrar — kept for callers that need the label/href pair. */
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

/** Account utility — rail footer on desktop, header on mobile. */
export const ACCOUNT_LINK = {
  label: MORE_MENU_ACCOUNT.label,
  shortLabel: "Conta",
  href: MORE_MENU_ACCOUNT.href,
} as const;

/**
 * Secondary overflow for destinations that left the primary dock
 * (today: Memórias, until Pets migration wires Pets → Memórias).
 */
export const MORE_ACTION = {
  label: "Mais",
  href: "/more",
} as const;

export function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Which shell element owns the current route.
 *
 * Active matrix (M1A):
 * - `/` → Início
 * - `/pets…` → Pets (incl. pet historico / neonatal-history)
 * - `/records/new` → Registrar (`/records/[id]/edit` → none)
 * - `/cuidados`, `/historico`, `/agenda`, `/routines`, `/neonatal…` → Cuidados
 * - `/financas`, `/expenses`, `/shopping`, `/health-plan…` → Finanças
 * - `/memories…` → Pets (Memórias da família)
 * - `/more` → legacy overflow route, no shell control
 * - `/assistant` → Assistente utility
 * - `/settings…` → Conta utility
 */
export function resolveShellTarget(pathname: string): ShellTarget | null {
  if (pathname === "/") return "inicio";
  if (pathMatches(pathname, REGISTER_ACTION.href)) return "registrar";
  for (const destination of PRIMARY_NAV) {
    if (destination.id === "inicio" || destination.id === "registrar") continue;
    if (destination.matches.some((prefix) => pathMatches(pathname, prefix))) return destination.id;
  }
  if (pathMatches(pathname, ASSISTANT_UTILITY.href)) return "assistant";
  if (pathMatches(pathname, ACCOUNT_LINK.href)) return "account";
  if (isMoreMenuPath(pathname)) return "more";
  return null;
}
