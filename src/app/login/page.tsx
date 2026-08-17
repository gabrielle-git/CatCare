import Link from "next/link";
import { AuthScreen } from "@/components/auth-screen";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const params = await searchParams;
  const configured = hasSupabaseEnv();
  return (
    <AuthScreen title="Entrar">
      <p className="mt-2 text-sm text-[var(--muted)]">Sua família de gatos, com histórico e dados privados.</p>
      {!configured && <div className="cat-card mt-6 bg-[var(--peach)] p-4 text-sm">Supabase ainda não configurado. A Home funciona em modo demonstrativo; autenticação será ativada quando você criar <code>.env.local</code>.</div>}
      {params.error && <div className="cat-card mt-6 border-red-200 bg-red-50 p-4 text-sm text-red-800">{params.error}</div>}
      {params.success && <div className="cat-card mt-6 bg-[var(--mint)] p-4 text-sm">{params.success}</div>}
      <LoginForm configured={configured} />
      <p className="mt-5 text-sm text-[var(--muted)]">Ainda não tem conta? <Link href="/cadastro" className="font-bold text-[var(--lavender-strong)] underline">Criar cadastro</Link></p>
    </AuthScreen>
  );
}
