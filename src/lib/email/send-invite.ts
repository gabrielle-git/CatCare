import { Resend } from "resend";
import { roleLabel } from "@/lib/roles";
import type { HouseholdRole } from "@/types/database";

type InviteEmailInput = {
  to: string;
  inviteUrl: string;
  householdName: string;
  role: HouseholdRole;
};

export function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendInviteEmail(input: InviteEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { sent: false as const, reason: "missing_api_key" as const };

  const from = process.env.RESEND_FROM_EMAIL?.trim() || "CatCare <onboarding@resend.dev>";
  const resend = new Resend(apiKey);
  const role = roleLabel(input.role);

  const { error } = await resend.emails.send({
    from,
    to: [input.to],
    subject: `Convite para cuidar dos gatos — ${input.householdName}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.5; color: #2a2230;">
        <p>Você foi convidada para entrar na família <strong>${input.householdName}</strong> no CatCare.</p>
        <p>Seu papel: <strong>${role}</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${input.inviteUrl}" style="background:#6b5b95;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700;">
            Aceitar convite
          </a>
        </p>
        <p style="font-size: 13px; color: #6b6470;">Se o botão não abrir, copie este link:<br>${input.inviteUrl}</p>
        <p style="font-size: 13px; color: #6b6470;">O convite expira em 7 dias.</p>
      </div>
    `,
  });

  if (error) return { sent: false as const, reason: "send_failed" as const, message: error.message };
  return { sent: true as const };
}
