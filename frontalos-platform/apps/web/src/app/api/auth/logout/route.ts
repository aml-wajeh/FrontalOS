/**
 * POST /api/auth/logout — calls the real POST /auth/logout (requires a
 * valid bearer token, which is why this must run server-side where the
 * httpOnly cookie is readable) then clears all session cookies regardless
 * of whether the backend call succeeded, so a stale/expired token can
 * never strand the user in a half-logged-in browser state.
 */
import { NextResponse } from "next/server";
import { cortixApiUrl, readAccessTokenCookie, clearSessionCookies } from "@/lib/auth/session";

export async function POST() {
  const token = readAccessTokenCookie();
  if (token) {
    try {
      await fetch(`${cortixApiUrl()}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    } catch {
      // Best-effort — cookies are cleared below either way.
    }
  }
  clearSessionCookies();
  return NextResponse.json({ status: "success" });
}
