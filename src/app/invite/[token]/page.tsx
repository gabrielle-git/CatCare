import Link from "next/link";
import { Heart, LogOut, UsersRound } from "lucide-react";
import { acceptInviteAction } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { logout } from "@/app/(app)/settings/actions";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const next = `/invite/${token}`;

  if (!hasSupabaseEnv()) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="cat-card p-6 text-center">
          <p className="text-sm text-[var(--muted)]">Configure o Supabase para aceitar convites.</p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (auth.user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="cat-card overflow-hidden">
          <div className="bg-[linear-gradient(135deg,var(--lavender-soft),var(--rose-soft))] p-6 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-[22px] bg-white/80"><UsersRound size={24} /></span>
            <h1 className="mt-4 text-2xl font-bold tracking-[-0.03em]">Aceitar convite</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Você está entrando como <strong>{auth.user.email}</strong>.</p>
          </div>
          <div className="space-y-4 p-6">
            {error && <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
            <form action={acceptInviteAction.bind(null, token)}>
              <button type="submit" className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white">
                <Heart size={17} /> Entrar na família
              </button>
            </form>
            <form action={logout}>
              <button type="submit" className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-bold text-[var(--muted)]">
                <LogOut size={16} /> Sair e usar outra conta
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="cat-card overflow-hidden">
        <div className="bg-[linear-gradient(135deg,var(--lavender-soft),var(--rose-soft))] p-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-[22px] bg-white/80"><UsersRound size={24} /></span>
          <h1 className="mt-4 text-2xl font-bold tracking-[-0.03em]">Convite para a família</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">Entre ou crie uma conta com o <strong>mesmo e-mail</strong> que recebeu o convite. Já tem conta? Use Entrar — não precisa criar outra.</p>
        </div>
        <div className="space-y-4 p-6">
          <Link href={`/cadastro?next=${encodeURIComponent(next)}`} className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--graphite)] px-4 py-3 text-sm font-bold text-white">
            <Heart size={17} /> Criar conta e entrar
          </Link>
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="focus-ring flex w-full items-center justify-center rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-bold">
            Já tenho conta
          </Link>
        </div>
      </div>
    </div>
  );
}
