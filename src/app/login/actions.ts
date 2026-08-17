"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function message(path: string, key: "error" | "success", value: string) {
  return `${path}?${key}=${encodeURIComponent(value)}`;
}

function credentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect(message("/login", "error", "Informe e-mail e senha."));
  if (password.length < 6) redirect(message("/login", "error", "A senha precisa ter pelo menos 6 caracteres."));
  return { email, password };
}

function authErrorMessage(error: { message: string; code?: string }) {
  const text = `${error.code ?? ""} ${error.message}`.toLowerCase();
  if (text.includes("email not confirmed") || text.includes("email_not_confirmed")) {
    return "A conta foi criada, mas o Supabase ainda exige confirmação de e-mail. Em Authentication → Providers → Email, desligue Confirm email para desenvolver localmente — ou abra o link enviado ao e-mail.";
  }
  if (text.includes("invalid login credentials") || text.includes("invalid_credentials")) {
    return "E-mail ou senha não conferem. Se ainda não cadastrou neste projeto, use Criar conta. Se já cadastrou, confira a senha ou se o e-mail precisa ser confirmado no dashboard.";
  }
  if (text.includes("already registered") || text.includes("user_already_exists")) {
    return "Esta conta já existe. Use Entrar com a senha cadastrada.";
  }
  if (text.includes("signups not allowed")) {
    return "O cadastro está desativado neste projeto Supabase. Em Authentication → Providers → Email, habilite os cadastros.";
  }
  if (text.includes("redirect")) {
    return "A URL de retorno não está liberada no Supabase. Em Authentication → URL Configuration, adicione http://localhost:3000/auth/callback.";
  }
  if (text.includes("leaked") || text.includes("pwned")) {
    return "Essa senha é muito comum. Escolha outra com pelo menos 6 caracteres.";
  }
  return error.message;
}

async function enterApp() {
  revalidatePath("/", "layout");
  redirect("/");
}

export async function authenticate(formData: FormData) {
  const intent = String(formData.get("intent") ?? "login");
  if (intent === "signup") return signup(formData);
  return login(formData);
}

export async function login(formData: FormData) {
  const { email, password } = credentials(formData);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(message("/login", "error", authErrorMessage(error)));
  await enterApp();
}

export async function signup(formData: FormData) {
  const { email, password } = credentials(formData);
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) redirect(message("/login", "error", authErrorMessage(error)));

  const newIdentities = data.user?.identities ?? [];
  if (data.user && newIdentities.length === 0) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) redirect(message("/login", "error", "Esta conta já existe. Use Entrar com a senha cadastrada."));
    await enterApp();
  }

  if (data.session) await enterApp();

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) redirect(message("/login", "error", authErrorMessage(signInError)));
  await enterApp();
}
