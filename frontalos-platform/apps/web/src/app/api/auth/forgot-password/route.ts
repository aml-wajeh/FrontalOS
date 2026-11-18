/**
 * POST /api/auth/forgot-password
 *
 * BUG FIX (staff audit follow-up): this route used to be an honest stub
 * because services/cortix-api had no /auth/forgot-password endpoint. That
 * endpoint now exists (auth/router.py) and issues a real
 * PasswordResetToken row, so this route proxies to it for real instead of
 * faking the response.
 *
 * The backend endpoint already returns the same generic
 * "if that account exists..." message regardless of whether the email is
 * registered (a deliberate security choice, not something this route
 * needs to re-implement) — so this is now a thin, honest proxy, matching
 * the pattern every other app/api/auth/* route already follows
 * (see ./login/route.ts, ./register/route.ts).
 */
import { NextResponse } from "next/server";
import { cortixApiUrl } from "@/lib/auth/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body?.email) {
    return NextResponse.json({ detail: "Email is required" }, { status: 400 });
  }

  const res = await fetch(`${cortixApiUrl()}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email }),
    cache: "no-store",
  });

  const responseBody = await res.json().catch(() => ({}));
  return NextResponse.json(responseBody, { status: res.status });
}
