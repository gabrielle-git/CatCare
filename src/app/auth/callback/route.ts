import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/demo-mode";
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
  const response = NextResponse.redirect(new URL("/", url.origin));
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
    response.cookies.set(DEMO_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}
