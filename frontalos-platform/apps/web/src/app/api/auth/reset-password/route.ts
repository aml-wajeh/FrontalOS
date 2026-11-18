/**
 * POST /api/auth/reset-password
 *
 * BUG FIX (staff audit follow-up): matching fix to ../forgot-password/route.ts
 * — services/cortix-api now has a real POST /auth/reset-password endpoint
 * (auth/router.py) backed by the PasswordResetToken table, so this route
 * proxies to it instead of returning a hardcoded 501. The
 * reset-password/[token]/page.tsx form already reads `detail` from
 * whatever this route returns as its error toast, so no frontend change
 * was needed there — only this route had to stop lying about the gap.
 */
import { NextResponse } from "next/server";
import { cortixApiUrl } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body?.token || !body?.password) {
    return NextResponse.json({ detail: "Token and new password are required" }, { status: 400 });
  }

  const res = await fetch(`${cortixApiUrl()}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: body.token, new_password: body.password }),
    cache: "no-store",
  });

  const responseBody = await res.json().catch(() => ({}));
  return NextResponse.json(responseBody, { status: res.status });
}
