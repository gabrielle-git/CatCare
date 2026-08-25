import { NextResponse } from "next/server";
import { DEMO_COOKIE, demoCookieOptions } from "@/lib/demo-mode";

/** Enter guest demo mode (mock data, no login). */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/", origin));
  response.cookies.set(DEMO_COOKIE, "1", demoCookieOptions());
  return response;
}
