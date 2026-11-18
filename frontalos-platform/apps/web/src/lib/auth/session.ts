/**
 * lib/auth/session.ts
 *
 * Server-only helpers for Route Handlers under app/api/auth/* — cookie
 * naming, the CORTIX API base URL, and writing/clearing the session
 * cookies. Uses `next/headers`'s `cookies()`, which only works in Route
 * Handlers and Server Components, NOT in Edge middleware — that's why the
 * routing-only helpers (readSessionClaims, roleToPersona, personaHomePath)
 * live in ./edge.ts instead and are just re-exported here for convenience,
 * so Route Handlers can still `import { ... } from "@/lib/auth/session"`.
 *
 * Why cookies instead of localStorage (per the task spec):
 *   JWTs live in httpOnly cookies, set by these Route Handlers after they
 *   call services/cortix-api's real /auth/* endpoints. Client-side JS can
 *   never read them, which is the point — it closes the XSS-token-theft
 *   hole that storing tokens in localStorage leaves open. The existing
 *   lib/api/{patient,parent,doctor}Client.ts files still read
 *   `localStorage.frontalos_access_token` (see their headers) — that is a
 *   pre-existing pattern from an earlier pass, not something this change
 *   set out to fix, and services/ is out of scope here. New code (this auth
 *   flow, the shell, the school portal) uses cookies exclusively; migrating
 *   the older clients off localStorage is flagged as follow-up work rather
 *   than silently done as a side effect of this task.
 *
 * Role claim gap: services/cortix-api's create_access_token() (core/security.py)
 * only encodes {sub, type, exp} — no role. Rather than fabricate a role
 * claim inside a JWT this app didn't sign, the login Route Handler makes a
 * second call to GET /auth/me (which DOES return real roles from the
 * UserRole join) right after login, and stores the primary role in its own
 * small httpOnly cookie (`frontalos_role`) alongside the real access token.
 * middleware.ts reads that cookie for routing; it is never treated as an
 * authorization credential — every API call still carries the real bearer
 * token, and the CORTIX API independently decides what that token is
 * allowed to touch.
 */
import { cookies } from "next/headers";

export {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ROLE_COOKIE,
  roleToPersona,
  personaHomePath,
  cortixApiUrl,
  readSessionClaims,
  type Persona,
} from "./edge";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, ROLE_COOKIE } from "./edge";

/** Shared cookie flags for every auth cookie this app sets. */
export function authCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // When running in Docker locally, NODE_ENV is production but the site is HTTP.
    // secure: true will cause browsers to drop the cookie, breaking the login loop.
    // This heuristic ensures cookies are only marked secure if deployed on HTTPS.
    secure: process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_CORTIX_API_URL?.startsWith("https"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

const ACCESS_TOKEN_MAX_AGE = 60 * 30; // 30 min — mirrors ACCESS_TOKEN_EXPIRE_MINUTES default server-side
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Writes all three session cookies after a successful login/register+login. */
export function setSessionCookies(opts: { accessToken: string; refreshToken: string; role: string }) {
  const store = cookies();
  store.set(ACCESS_TOKEN_COOKIE, opts.accessToken, authCookieOptions(ACCESS_TOKEN_MAX_AGE));
  store.set(REFRESH_TOKEN_COOKIE, opts.refreshToken, authCookieOptions(REFRESH_TOKEN_MAX_AGE));
  store.set(ROLE_COOKIE, opts.role, authCookieOptions(REFRESH_TOKEN_MAX_AGE));
}

export function clearSessionCookies() {
  const store = cookies();
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, ROLE_COOKIE]) {
    store.set(name, "", { ...authCookieOptions(0), maxAge: 0 });
  }
}

export function readAccessTokenCookie(): string | undefined {
  return cookies().get(ACCESS_TOKEN_COOKIE)?.value;
}
