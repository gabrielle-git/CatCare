import { invitePath } from "@/lib/invites";

/** URL pública do app — use a URL da Vercel em produção, nunca localhost nos convites por e-mail. */
export function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:3000";
}

export function isLocalAppUrl(url = getAppUrl()) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
}

export function buildInviteUrl(token: string) {
  return `${getAppUrl()}${invitePath(token)}`;
}
