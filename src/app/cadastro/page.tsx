import Link from "next/link";
import { AuthScreen } from "@/components/auth-screen";
import { isSafeNextPath } from "@/lib/invites";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { SignupForm } from "./signup-form";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; next?: string }> }) {
  const params = await searchParams;
  const configured = hasSupabaseEnv();
  const nextPath = isSafeNextPath(params.next) ? params.next : undefined;
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  return (
    <AuthScreen title="Criar conta">
      <p className="mt-2 text-sm text-[var(--muted)]">Cadastre e-mail e senha para guardar o histórico da família com privacidade.</p>
      {nextPath && <div className="cat-card mt-6 bg-[var(--lavender-soft)] p-4 text-sm">Use o mesmo e-mail que recebeu no convite. Depois do cadastro, você entra na família automaticamente.</div>}
      {!configured && <div className="cat-card mt-6 bg-[var(--peach)] p-4 text-sm">Supabase ainda não configurado. Crie <code>.env.local</code> para ativar o cadastro.</div>}
      {params.error && <div className="cat-card mt-6 border-red-200 bg-red-50 p-4 text-sm text-red-800">{params.error}</div>}
      {params.success && <div className="cat-card mt-6 bg-[var(--mint)] p-4 text-sm">{params.success}</div>}
      <SignupForm configured={configured} nextPath={nextPath} />
      <p className="mt-5 text-sm text-[var(--muted)]">Já tem conta? <Link href={loginHref} className="font-bold text-[var(--lavender-strong)] underline">Entrar</Link></p>
    </AuthScreen>
  );
}
