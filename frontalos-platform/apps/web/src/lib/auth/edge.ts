/**
 * lib/auth/edge.ts
 *
 * Edge-runtime-safe subset of lib/auth/session.ts — no `next/headers`
 * import, since `cookies()` from that module isn't available in
 * middleware.ts (which runs on the Edge runtime, before Next's per-request
 * `next/headers` context exists). Anything importable from middleware.ts
 * lives here; anything that needs to WRITE cookies (Route Handlers only)
 * lives in ./session.ts, which re-exports these same helpers so Route
 * Handlers can still import everything from one place.
 */
import { jwtVerify, decodeJwt } from "jose";

export const ACCESS_TOKEN_COOKIE = "frontalos_access_token";
export const REFRESH_TOKEN_COOKIE = "frontalos_refresh_token";
export const ROLE_COOKIE = "frontalos_role";

export type Persona = "patient" | "parent" | "doctor" | "school" | "admin";

const ROLE_TO_PERSONA: Record<string, Persona> = {
  child: "patient",
  parent: "parent",
  doctor: "doctor",
  psychologist: "doctor",
  school: "school",
  admin: "admin",
};

export function roleToPersona(role: string | undefined | null): Persona | null {
  if (!role) return null;
  return ROLE_TO_PERSONA[role] ?? null;
}

export function personaHomePath(persona: Persona): string {
  switch (persona) {
    case "patient":
      return "/dashboard";
    case "parent":
      return "/parent/dashboard";
    case "doctor":
      return "/doctor/dashboard";
    case "school":
      return "/school/dashboard";
    case "admin":
      return "/admin/dashboard";
  }
}

export function cortixApiUrl(): string {
  const base = process.env.CORTIX_API_URL ?? process.env.NEXT_PUBLIC_CORTIX_API_URL;
  if (!base) {
    throw new Error("CORTIX_API_URL / NEXT_PUBLIC_CORTIX_API_URL is not set");
  }
  return base.replace(/\/$/, "");
}

interface AccessTokenClaims {
  sub: string;
  type: string;
  exp: number;
}

/**
 * Verifies (or, if JWT_SECRET_KEY isn't configured for the web app, merely
 * decodes) an access token. Returns null if missing, malformed, expired,
 * or unverifiable. See file header — used for ROUTING decisions only
 * (middleware.ts); it is never treated as an authorization credential for
 * an actual API call, since the CORTIX API independently verifies the
 * same token's signature server-side on every request it receives.
 */
export async function readSessionClaims(token: string | undefined): Promise<AccessTokenClaims | null> {
  if (!token) return null;
  try {
    const secretHex = process.env.JWT_SECRET_KEY;
    if (secretHex) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secretHex));
      return payload as unknown as AccessTokenClaims;
    }
    const payload = decodeJwt(token) as unknown as AccessTokenClaims;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}