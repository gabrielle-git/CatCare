import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/demo-mode";

/** Leave guest demo mode and return to login. */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/login", origin));
  response.cookies.set(DEMO_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
