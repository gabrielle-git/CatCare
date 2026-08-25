"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { DEMO_COOKIE } from "@/lib/demo-mode";
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
    return "CONFIRM_EMAIL";
  }
  if (text.includes("invalid login credentials") || text.includes("invalid_credentials")) {
    return "E-mail ou senha não conferem. Se ainda não tem conta, use Criar cadastro.";
  }
  if (text.includes("already registered") || text.includes("user_already_exists")) {
    return "Esta conta já existe. Use Entrar com a senha cadastrada.";
  }
  if (text.includes("signups not allowed")) {
    return "O cadastro está temporariamente desativado. Use a demonstração ou tente de novo mais tarde.";
  }
  if (text.includes("redirect")) {
    return "Não foi possível concluir o login. Peça para quem administra o app revisar a URL de retorno.";
  }
  if (text.includes("leaked") || text.includes("pwned")) {
    return "Essa senha é muito comum. Escolha outra com pelo menos 6 caracteres.";
  }
  return error.message;
}

const CONFIRM_COPY = "Enviamos um e-mail para confirmar sua conta. Abra o link e depois toque em Entrar.";

async function enterApp(formData?: FormData) {
  const jar = await cookies();
  jar.set(DEMO_COOKIE, "", { path: "/", maxAge: 0 });
  revalidatePath("/", "layout");
  redirect(formData ? destination(formData) : "/");
}

export async function login(formData: FormData) {
  const { email, password } = credentials(formData, "/login");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const mapped = authErrorMessage(error);
    if (mapped === "CONFIRM_EMAIL") redirect(message("/login", "error", "Confirme o e-mail antes de entrar. Abra o link que enviamos para sua caixa de entrada."));
    redirect(message("/login", "error", mapped));
  }
  await enterApp(formData);
}

export async function signup(formData: FormData) {
  const { email, password } = credentials(formData, "/cadastro");
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName) redirect(message("/cadastro", "error", "Informe o nome que vai aparecer na família."));
  if (displayName.length > 60) redirect(message("/cadastro", "error", "Nome muito longo."));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback`,
      data: { display_name: displayName },
    },
  });
  if (error) {
    const mapped = authErrorMessage(error);
    if (mapped === "CONFIRM_EMAIL") redirect(message("/cadastro", "success", CONFIRM_COPY));
    redirect(message("/cadastro", "error", mapped));
  }

  const newIdentities = data.user?.identities ?? [];
  if (data.user && newIdentities.length === 0) {
    redirect(message("/login", "error", "Esta conta já existe. Use Entrar com a senha cadastrada."));
  }

  if (data.session) await enterApp(formData);

  if (data.user && !data.session) {
    redirect(message("/cadastro", "success", CONFIRM_COPY));
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    const mapped = authErrorMessage(signInError);
    if (mapped === "CONFIRM_EMAIL") redirect(message("/cadastro", "success", CONFIRM_COPY));
    redirect(message("/cadastro", "error", mapped));
  }
  await enterApp(formData);
}
