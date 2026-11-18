/**
 * app/api/proxy/[...path]/route.ts
 *
 * Fixes the auth split-brain documented in PROMPT_9_REMAINING_STEPS.md §1:
 * app/api/auth/login/route.ts puts the real access/refresh tokens in
 * httpOnly cookies (lib/auth/session.ts) that client-side JS can never
 * read — by design, to close the XSS-token-theft hole. But every portal
 * client (lib/api/{patient,doctor,parent,school,notifications}Client.ts)
 * called services/cortix-api DIRECTLY from the browser and tried to read
 * a bearer token out of `localStorage`, which nothing ever wrote. Those
 * calls always went out unauthenticated.
 *
 * This route is the fix: the browser calls THIS same-origin path (via
 * lib/api/httpClient.ts, credentials:"include" so the httpOnly cookies
 * come along automatically), and this server-side handler is the only
 * place that ever reads the access token and attaches it as a real
 * Authorization header to services/cortix-api.
 *
 * Flow per request:
 *   1. Read frontalos_access_token cookie, forward method/body/query to
 *      cortix-api with `Authorization: Bearer <token>`.
 *   2. If cortix-api answers 401: try POST /auth/refresh with the
 *      frontalos_refresh_token cookie, write the new cookies, retry the
 *      ORIGINAL request exactly once with the new access token.
 *   3. If the refresh itself fails (expired/invalid refresh token): clear
 *      all session cookies (force logout) and return a clean 401 so
 *      httpClient.ts can redirect to /login instead of looping forever.
 *
 * Multipart (MRI upload, doctorClient.ts's predictMri) is forwarded as a
 * real FormData body so `fetch` sets its own correctly-boundaried
 * Content-Type — never set that header manually for multipart.
 *
 * Dev-only request/response logging per the integration task's centralized
 * httpClient requirement — logs never fire in production.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  cortixApiUrl,
  readAccessTokenCookie,
  setSessionCookies,
  clearSessionCookies,
} from "@/lib/auth/session";
import { REFRESH_TOKEN_COOKIE, ROLE_COOKIE } from "@/lib/auth/edge";

const isDev = process.env.NODE_ENV !== "production";

interface PreparedBody {
  body: BodyInit | undefined;
  isFormData: boolean;
}

async function prepareBody(request: NextRequest): Promise<PreparedBody> {
  if (request.method === "GET" || request.method === "HEAD") {
    return { body: undefined, isFormData: false };
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return { body: await request.formData(), isFormData: true };
  }
  const text = await request.text();
  return { body: text.length ? text : undefined, isFormData: false };
}

async function forwardOnce(
  path: string,
  search: string,
  method: string,
  prepared: PreparedBody,
  accessToken: string | undefined
): Promise<Response> {
  const target = `${cortixApiUrl()}/${path}${search}`;
  const headers: Record<string, string> = {
    ...(prepared.isFormData ? {} : { "Content-Type": "application/json" }),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  return fetch(target, {
    method,
    headers,
    body: prepared.body,
    cache: "no-store",
  });
}

async function tryRefresh(): Promise<string | null> {
  const store = cookies();
  const refreshToken = store.get(REFRESH_TOKEN_COOKIE)?.value;
  const role = store.get(ROLE_COOKIE)?.value ?? "";
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${cortixApiUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const tokens: { access_token: string; refresh_token: string } = await res.json();
    setSessionCookies({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, role });
    return tokens.access_token;
  } catch {
    return null;
  }
}

async function handle(request: NextRequest, params: { path: string[] }) {
  const path = params.path.join("/");
  const search = request.nextUrl.search;
  const method = request.method;
  const accessToken = readAccessTokenCookie();
  const prepared = await prepareBody(request);

  if (isDev) console.log(`[proxy] -> ${method} /${path}${search}`);

  let response = await forwardOnce(path, search, method, prepared, accessToken);

  if (response.status === 401 && accessToken) {
    const newToken = await tryRefresh();
    if (newToken) {
      response = await forwardOnce(path, search, method, prepared, newToken);
    } else {
      clearSessionCookies();
    }
  }

  if (isDev) console.log(`[proxy] <- ${response.status} /${path}${search}`);

  const responseText = await response.text();
  return new NextResponse(responseText, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(request, params);
}
export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(request, params);
}
export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(request, params);
}
export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(request, params);
}
export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(request, params);
}
