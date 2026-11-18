/**
 * GET /api/auth/me — lets client components (e.g. the Topbar user menu)
 * ask "who am I" without ever touching the httpOnly access-token cookie
 * directly. Proxies to the real GET /auth/me.
 */
import { NextResponse } from "next/server";
import { cortixApiUrl, readAccessTokenCookie } from "@/lib/auth/session";

export async function GET() {
  const token = readAccessTokenCookie();
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch(`${cortixApiUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
