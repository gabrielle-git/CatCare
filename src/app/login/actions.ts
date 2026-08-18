"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSafeNextPath } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

function message(path: string, key: "error" | "success", value: string) {
  return `${path}?${key}=${encodeURIComponent(value)}`;
}

function destination(formData: FormData) {
  const next = String(formData.get("next") ?? "");
  return isSafeNextPath(next) ? next : "/";
}

function credentials(formData: FormData, path: string) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect(message(path, "error", "Informe e-mail e senha."));
  if (password.length < 6) redirect(message(path, "error", "A senha precisa ter pelo menos 6 caracteres."));
  return { email, password };
}

function authErrorMessage(error: { message: string; code?: string }) {
  const text = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (text.includes("email not confirmed") || text.includes("email_not_confirmed")) {
    return "Conta criada. Se o e-mail de confirmação estiver ligado neste projeto, abra o link da caixa de entrada e depois use Entrar. Isso se configura uma vez no Supabase, não a cada cadastro.";
  }
  if (text.includes("invalid login credentials") || text.includes("invalid_credentials")) {
    return "E-mail ou senha não conferem. Se ainda não tem conta, use Criar cadastro.";
  }
  if (text.includes("already registered") || text.includes("user_already_exists")) {
    return "Esta conta já existe. Use Entrar com a senha cadastrada.";
  }
  if (text.includes("signups not allowed")) {
    return "O cadastro está desativado neste projeto Supabase. Em Authentication → Providers → Email, habilite os cadastros uma vez.";
  }
  if (text.includes("redirect")) {
    return "A URL de retorno não está liberada no Supabase. Em Authentication → URL Configuration, adicione a URL do app + /auth/callback.";
  }
  if (text.includes("leaked") || text.includes("pwned")) {
    return "Essa senha é muito comum. Escolha outra com pelo menos 6 caracteres.";
  }
  return error.message;
}

async function enterApp(formData?: FormData) {
  revalidatePath("/", "layout");
  redirect(formData ? destination(formData) : "/");
}

export async function login(formData: FormData) {
  const { email, password } = credentials(formData, "/login");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(message("/login", "error", authErrorMessage(error)));
  await enterApp(formData);
}

export async function signup(formData: FormData) {
  const { email, password } = credentials(formData, "/cadastro");
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect(message("/cadastro", "error", authErrorMessage(error)));

  const newIdentities = data.user?.identities ?? [];
  if (data.user && newIdentities.length === 0) {
    redirect(message("/login", "error", "Esta conta já existe. Use Entrar com a senha cadastrada."));
  }

  if (data.session) await enterApp(formData);

  if (data.user && !data.session) {
    redirect(message("/cadastro", "success", "Conta criada. Abra o link de confirmação no e-mail e depois use Entrar."));
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) redirect(message("/cadastro", "error", authErrorMessage(signInError)));
  await enterApp(formData);
}
