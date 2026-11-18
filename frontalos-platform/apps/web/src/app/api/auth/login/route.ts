/**
 * POST /api/auth/login
 *
 * Proxies to services/cortix-api's real POST /auth/login, then (since that
 * endpoint's JWT carries no role claim — see lib/auth/session.ts header)
 * follows up with GET /auth/me using the fresh access token to learn the
 * user's real role. Sets three httpOnly cookies and returns just enough
 * for the client to redirect and toast — never the raw tokens.
 */
import { NextResponse } from "next/server";
import { cortixApiUrl, setSessionCookies, roleToPersona, personaHomePath } from "@/lib/auth/session";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ detail: "Email and password are required" }, { status: 400 });
  }

  const loginRes = await fetch(`${cortixApiUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: "no-store",
  });

  if (!loginRes.ok) {
    const detail = await safeDetail(loginRes);
    return NextResponse.json({ detail }, { status: loginRes.status });
  }

  const tokens: { access_token: string; refresh_token: string } = await loginRes.json();

  const meRes = await fetch(`${cortixApiUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  });

  if (!meRes.ok) {
    // Tokens were valid enough to be issued but /me rejected them — treat
    // as a login failure rather than half-authenticating the session.
    return NextResponse.json({ detail: "Could not load account details" }, { status: 502 });
  }

  const me: { email: string; full_name: string; roles: string[] } = await meRes.json();
  const primaryRole = me.roles[0] ?? "";
  const persona = roleToPersona(primaryRole);

  setSessionCookies({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    role: primaryRole,
  });

  return NextResponse.json({
    user: { email: me.email, fullName: me.full_name, role: primaryRole },
    redirectTo: persona ? personaHomePath(persona) : null,
  });
}

async function safeDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.detail ?? res.statusText;
  } catch {
    return res.statusText;
  }
}