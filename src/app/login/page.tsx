import { LoginForm } from "./login-form";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const params = await searchParams;
  const configured = hasSupabaseEnv();
  return (
    <main className="mx-auto min-h-svh w-full max-w-[440px] bg-[var(--background)] px-5 py-10 sm:my-5 sm:min-h-[calc(100svh-40px)] sm:rounded-[32px] sm:border sm:border-[#d6d1db]">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">CatCare</p>
      <h1 className="mt-2 text-3xl font-bold">Entrar</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Sua família de gatos, com histórico e dados privados.</p>

      {!configured && <div className="cat-card mt-6 bg-[var(--peach)] p-4 text-sm">Supabase ainda não configurado. A Home funciona em modo demonstrativo; autenticação será ativada quando você criar <code>.env.local</code>.</div>}
      {params.error && <div className="cat-card mt-6 border-red-200 bg-red-50 p-4 text-sm text-red-800">{params.error}</div>}
      {params.success && <div className="cat-card mt-6 bg-[var(--mint)] p-4 text-sm">{params.success}</div>}

      <LoginForm configured={configured} />
      <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Primeiro acesso neste projeto: preencha e-mail e senha e toque em Criar conta. Depois disso, use Entrar nas próximas vezes.</p>
    </main>
  );
}
