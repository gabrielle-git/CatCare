import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE } from "@/lib/demo-mode";
import { getSupabaseEnv, hasSupabaseEnv } from "./env";

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseEnv()) return NextResponse.next({ request });

  const { url, key } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;
  const isDemoGuest = request.cookies.get(DEMO_COOKIE)?.value === "1";
  const isPublic =
    path === "/login" ||
    path === "/cadastro" ||
    path === "/demo" ||
    path === "/demo/sair" ||
    path.startsWith("/auth/") ||
    path.startsWith("/invite/");

  if (!isLoggedIn && !isPublic && !isDemoGuest) {
    // APIs must not be redirected into the HTML demo — return 401 JSON.
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
    }
    // Por enquanto a entrada pública é a demonstração (dados fictícios).
    // Login/cadastro continuam em /login e /cadastro para quem já tem conta.
    const demoUrl = request.nextUrl.clone();
    demoUrl.pathname = "/demo";
    demoUrl.search = "";
    return NextResponse.redirect(demoUrl);
  }

  // Demo guest hitting APIs: still no session privilege.
  if (!isLoggedIn && isDemoGuest && path.startsWith("/api/")) {
    return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  }

  if (isLoggedIn && (path === "/login" || path === "/cadastro") && !request.nextUrl.searchParams.get("next")?.startsWith("/invite/")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
