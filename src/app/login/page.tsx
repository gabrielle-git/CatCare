import Link from "next/link";
import { AuthScreen } from "@/components/auth-screen";
import { isSafeNextPath } from "@/lib/invites";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; next?: string }> }) {
  const params = await searchParams;
  const configured = hasSupabaseEnv();
  const nextPath = isSafeNextPath(params.next) ? params.next : undefined;
  const cadastroHref = nextPath ? `/cadastro?next=${encodeURIComponent(nextPath)}` : "/cadastro";
  return (
    <AuthScreen title="Entrar">
      <p className="mt-2 text-sm text-[var(--muted)]">Sua família de pets, com histórico e dados privados.</p>
      {nextPath && <div className="cat-card mt-6 bg-[var(--lavender-soft)] p-4 text-sm">Depois de entrar, você volta ao convite da família.</div>}
      {!configured && (
        <div className="cat-card mt-6 bg-[var(--peach)] p-4 text-sm">
          Autenticação ainda não está ligada neste ambiente. Enquanto isso, use a{" "}
          <Link href="/demo" className="font-bold underline">demonstração</Link>.
        </div>
      )}
      {params.error && <div className="cat-card mt-6 border-red-200 bg-red-50 p-4 text-sm text-red-800">{params.error}</div>}
      {params.success && <div className="cat-card mt-6 bg-[var(--mint)] p-4 text-sm">{params.success}</div>}
      <LoginForm configured={configured} nextPath={nextPath} />
      {!nextPath && (
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Só quer olhar?{" "}
          <Link href="/demo" className="font-bold text-[var(--lavender-strong)] underline">
            Explorar demonstração sem login
          </Link>
        </p>
      )}
      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        Ainda não tem conta?{" "}
        <Link href={cadastroHref} className="font-bold text-[var(--lavender-strong)] underline">Criar cadastro</Link>
      </p>
    </AuthScreen>
  );
}
