/**
 * middleware.ts
 *
 * Protects every portal route group and keeps signed-in users out of
 * portals that aren't theirs. Runs on the Edge runtime, so it never touches
 * the database directly — it only reads the httpOnly session cookies set
 * by app/api/auth/login/route.ts (see lib/auth/session.ts for the full
 * rationale on the unverified-decode fallback and the role-cookie gap).
 *
 * Behavior:
 *   - No/invalid/expired access-token cookie on a protected route -> redirect
 *     to /login?next=<original path>.
 *   - Valid session but the path's persona doesn't match the user's role ->
 *     redirect to that user's OWN dashboard, with a `?unauthorized=1` flag
 *     the shell reads once to fire a friendly toast instead of a raw 403.
 *   - Already-authenticated users hitting /login or /register -> bounced
 *     straight to their dashboard (no reason to show them the login form).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  ROLE_COOKIE,
  readSessionClaims,
  roleToPersona,
  personaHomePath,
  type Persona,
} from "@/lib/auth/edge";

const PERSONA_PREFIXES: Array<{ prefix: string; persona: Persona }> = [
  { prefix: "/dashboard", persona: "patient" },
  { prefix: "/parent", persona: "parent" },
  { prefix: "/doctor", persona: "doctor" },
  { prefix: "/school", persona: "school" },
  { prefix: "/admin", persona: "admin" },
];

const AUTH_ONLY_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

function matchProtectedPersona(pathname: string): Persona | null {
  for (const { prefix, persona } of PERSONA_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return persona;
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const role = request.cookies.get(ROLE_COOKIE)?.value;
  const claims = await readSessionClaims(token);
  const isAuthenticated = claims !== null;
  const persona = roleToPersona(role);

  const isAuthOnlyPath = AUTH_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isAuthOnlyPath) {
    if (isAuthenticated && persona) {
      return NextResponse.redirect(new URL(personaHomePath(persona), request.url));
    }
    return NextResponse.next();
  }

  const requiredPersona = matchProtectedPersona(pathname);
  if (requiredPersona === null) {
    // Not a protected route (marketing pages, etc.) — pass through untouched.
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (persona !== requiredPersona) {
    // Signed in, but this isn't their portal. Send them home instead of a
    // raw 403 — AppShell/Topbar reads `unauthorized=1` once on mount to
    // fire a toast, then the param is dropped (no history pollution).
    const home = persona ? personaHomePath(persona) : "/login";
    const redirectUrl = new URL(home, request.url);
    redirectUrl.searchParams.set("unauthorized", "1");
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/parent/:path*",
    "/doctor/:path*",
    "/school/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password/:path*",
    "/reset-password/:path*",
  ],
};