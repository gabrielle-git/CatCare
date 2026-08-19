import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (authError) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("error", "O link de confirmação expirou ou já foi usado. Entre na conta ou peça um novo cadastro.");
    return NextResponse.redirect(login);
  }

  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/", url.origin));
}
