/**
 * GET /api/extension/token
 *
 * Powers the browser extension's "Connect" flow (see apps/extension and
 * app/extension-connect/page.tsx below). The extension itself is a
 * chrome-extension:// origin and can never read this app's httpOnly
 * session cookies directly — that's the whole point of them being
 * httpOnly (see lib/auth/session.ts's header). This route is the one
 * sanctioned bridge: it runs server-side, reads the same httpOnly access
 * token cookie any other Route Handler under app/api/* already reads, and
 * hands it back as JSON to a same-origin page the user is actively looking
 * at — which then relays it to the extension via
 * chrome.runtime.sendMessage (a browser-mediated handoff the extension
 * explicitly opted into via manifest.json's externally_connectable).
 *
 * No new token type, no new secret, no new backend service — this reuses
 * the exact access token services/cortix-api's /auth/* endpoints already
 * issue and verify. Same-origin fetches automatically carry the browser's
 * SameSite=Lax session cookie, so a request only succeeds while the caller
 * is genuinely a logged-in tab of this app.
 *
 * Known placeholder (matches PatientDashboardClient.tsx's own PATIENT_ID
 * constant and its comment): there is no "which patient am I" endpoint
 * for the child/self role yet, so patientId is returned as 1 here for
 * every caller. The extension's Settings screen lets a user override it
 * locally until real self-patient resolution exists.
 */
import { NextResponse } from "next/server";
import { readAccessTokenCookie } from "@/lib/auth/session";
import { cortixApiUrl, REFRESH_TOKEN_COOKIE } from "@/lib/auth/edge";
import { cookies } from "next/headers";

const ACCESS_TOKEN_MAX_AGE_MS = 30 * 60_000; // mirrors ACCESS_TOKEN_EXPIRE_MINUTES default (.env.example)
const PLACEHOLDER_PATIENT_ID = 1;

export async function GET() {
  const accessToken = readAccessTokenCookie();
  if (!accessToken) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const meRes = await fetch(`${cortixApiUrl()}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!meRes.ok) {
    return NextResponse.json({ detail: "Session could not be verified" }, { status: 401 });
  }
  const me = (await meRes.json()) as { full_name?: string };

  const refreshToken = cookies().get(REFRESH_TOKEN_COOKIE)?.value;

  return NextResponse.json({
    accessToken,
    refreshToken,
    expiresAt: Date.now() + ACCESS_TOKEN_MAX_AGE_MS,
    patientId: PLACEHOLDER_PATIENT_ID,
    fullName: me.full_name,
  });
}
