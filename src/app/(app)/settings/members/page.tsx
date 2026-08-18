import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MailPlus, Shield, UserMinus, UsersRound, X } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { ensureHousehold } from "@/lib/households";
import { listPendingInvites } from "@/lib/invites";
import { getMyRole, isOwner, listHouseholdRoster, roleLabel } from "@/lib/roles";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { HouseholdRole } from "@/types/database";
import { removeMember, revokeInvite, renameHousehold, sendInvite, setMemberAlias, setMemberRole } from "./actions";

export const dynamic = "force-dynamic";

async function loadMembersPage() {
  if (!hasSupabaseEnv()) {
    return {
      configured: false,
      householdName: "Nossa família",
      roster: [{ user_id: "demo", display_name: "Você (demo)", profile_name: "Você (demo)", private_alias: null, role: "owner" as HouseholdRole, joined_at: new Date().toISOString() }],
      invites: [],
      myRole: "owner" as HouseholdRole,
      myUserId: "demo",
      error: null as string | null,
    };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  try {
    const household = await ensureHousehold(supabase, auth.user.id);
    const [roster, myRole, invites] = await Promise.all([
      listHouseholdRoster(supabase),
      getMyRole(supabase),
      listPendingInvites(supabase).catch(() => []),
    ]);
    return { configured: true, householdName: household.name, roster, invites, myRole, myUserId: auth.user.id, error: null };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Não foi possível carregar os membros.";
    return { configured: true, householdName: "Sua família", roster: [], invites: [], myRole: "owner" as HouseholdRole, myUserId: auth.user.id, error: message };
  }
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string; removed?: string; invited?: string; revoked?: string; manual?: string; renamed?: string; alias?: string }>;
}) {
  const params = await searchParams;
  const { configured, householdName, roster, invites, myRole, myUserId, error } = await loadMembersPage();
  const owner = isOwner(myRole);

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 pb-8 pt-7 md:px-8 lg:py-10">
      <Link href="/settings" className="focus-ring inline-flex items-center gap-2 rounded-xl py-2 text-sm font-bold text-[var(--muted)]"><ArrowLeft size={17} /> Configurações</Link>
      <div className="mt-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[18px] bg-[var(--rose-soft)]"><UsersRound size={20} /></span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lavender-strong)]">Família</p>
          <h1 className="text-3xl font-bold tracking-[-0.04em]">Membros</h1>
        </div>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">{householdName} — quem pode ver e quem pode editar os cuidados dos gatos.</p>

      {!configured && <div className="mt-6 rounded-[20px] bg-[var(--peach)] px-4 py-3 text-sm">Modo demonstrativo: só aparece um membro fictício.</div>}
      {params.error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{params.error}</div>}
      {params.updated && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Papel atualizado.</div>}
      {params.removed && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Membro removido.</div>}
      {params.invited && (
        <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          Convite criado{params.manual ? " — copie o link abaixo e envie manualmente:" : " e e-mail enviado."}
          {params.manual && <p className="mt-2 break-all font-normal text-[var(--foreground)]">{params.manual}</p>}
        </div>
      )}
      {params.revoked && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Convite cancelado.</div>}
      {params.renamed && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Nome da família atualizado.</div>}
      {params.alias && <div className="mt-6 rounded-[20px] bg-[var(--mint-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Apelido salvo — só você vê assim.</div>}
      {error && <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error} Rode as migrations no Supabase se necessário.</div>}

      {owner && configured && (
        <section className="cat-card mt-6 p-5">
          <h2 className="font-bold">Nome desta família</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Ajuda a distinguir quando você participa de mais de uma família.</p>
          <form action={renameHousehold} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm font-bold">Nome
              <input name="name" defaultValue={householdName} maxLength={80} className="field mt-2" placeholder="Ex.: Família Helena, Casa do Evandro" />
            </label>
            <button type="submit" className="focus-ring shrink-0 rounded-2xl bg-[var(--lavender-soft)] px-4 py-3 text-xs font-bold text-[var(--lavender-strong)]">Salvar nome</button>
          </form>
        </section>
      )}

      {owner && configured && (
        <section className="cat-card mt-6 p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[16px] bg-[var(--lavender-soft)]"><MailPlus size={18} /></span>
            <div>
              <h2 className="font-bold">Convidar por e-mail</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">A pessoa recebe um link válido por 7 dias.</p>
            </div>
          </div>
          <form action={sendInvite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input required type="email" name="email" placeholder="email@exemplo.com" className="field" />
            <select name="role" defaultValue="caregiver" className="field py-2 text-sm">
              <option value="caregiver">Cuidador</option>
              <option value="viewer">Visitante</option>
            </select>
            <button type="submit" className="focus-ring rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white">Enviar convite</button>
          </form>
        </section>
      )}

      {owner && invites.length > 0 && (
        <section className="cat-card mt-5 overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Convites pendentes</div>
          {invites.map((invite) => {
            const cancel = revokeInvite.bind(null, invite.id);
            return (
              <article key={invite.id} className="flex flex-col gap-3 border-b border-[var(--border)] p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">{invite.email}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{roleLabel(invite.role)} • expira {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(invite.expires_at))}</p>
                </div>
                <form action={cancel}>
                  <ConfirmButton message={`Cancelar o convite para ${invite.email}?`} className="focus-ring inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-2 text-[10px] font-bold text-[var(--muted)]"><X size={13} /> Cancelar</ConfirmButton>
                </form>
              </article>
            );
          })}
        </section>
      )}

      <section className="cat-card mt-6 divide-y divide-[var(--border)] overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Quem já entrou</div>
        {roster.length === 0 ? (
          <p className="p-5 text-sm text-[var(--muted)]">Nenhum membro encontrado.</p>
        ) : roster.map((member) => {
          const isSelf = member.user_id === myUserId;
          const changeRole = setMemberRole.bind(null, member.user_id);
          const remove = removeMember.bind(null, member.user_id);
          const saveAlias = setMemberAlias.bind(null, member.user_id);
          return (
            <article key={member.user_id} className="flex flex-col gap-3 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold">{member.display_name}{isSelf ? " (você)" : ""}</p>
                  {!isSelf && member.private_alias && member.profile_name !== member.display_name && (
                    <p className="mt-0.5 text-[10px] text-[var(--muted)]">Nome na conta deles: {member.profile_name}</p>
                  )}
                  {isSelf && (
                    <p className="mt-0.5 text-[10px] text-[var(--muted)]">Para mudar como você aparece, edite em <Link href="/settings" className="font-bold text-[var(--lavender-strong)] underline">Configurações → Conta</Link>.</p>
                  )}
                  <p className="mt-1 text-xs text-[var(--muted)]">{roleLabel(member.role)} • desde {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(member.joined_at))}</p>
                </div>
                {owner && member.role !== "owner" && configured ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={changeRole} className="flex items-center gap-2">
                      <select name="role" defaultValue={member.role} className="field py-2 text-xs">
                        <option value="caregiver">Cuidador</option>
                        <option value="viewer">Visitante</option>
                      </select>
                      <button type="submit" className="focus-ring rounded-xl bg-[var(--lavender-soft)] px-3 py-2 text-[10px] font-bold text-[var(--lavender-strong)]">Salvar papel</button>
                    </form>
                    <form action={remove}>
                      <ConfirmButton message={`Remover ${member.display_name} da família?`} className="focus-ring inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-[10px] font-bold text-[var(--danger)]"><UserMinus size={13} /> Remover</ConfirmButton>
                    </form>
                  </div>
                ) : member.role === "owner" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--cream)] px-2.5 py-1 text-[10px] font-bold"><Shield size={12} /> Dono</span>
                ) : null}
              </div>
              {configured && !isSelf && (
                <form action={saveAlias} className="flex flex-col gap-2 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1 text-[11px] font-bold text-[var(--muted)]">Apelido só para você (opcional)
                    <input name="alias" defaultValue={member.private_alias ?? ""} maxLength={60} placeholder={member.profile_name} className="field mt-1.5 py-2 text-sm" />
                  </label>
                  <button type="submit" className="focus-ring shrink-0 rounded-xl border border-[var(--border)] px-3 py-2 text-[10px] font-bold">Salvar</button>
                </form>
              )}
            </article>
          );
        })}
      </section>

      <div className="mt-6 rounded-[20px] bg-[var(--cream)] px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">
        <strong className="text-[var(--foreground)]">Dono</strong> — gerencia membros e edita tudo.<br />
        <strong className="text-[var(--foreground)]">Cuidador</strong> — registra peso, vacinas, gastos e memórias.<br />
        <strong className="text-[var(--foreground)]">Visitante</strong> — só visualiza; o banco já bloqueia alterações.
      </div>
    </div>
  );
}
