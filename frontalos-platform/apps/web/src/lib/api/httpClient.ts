/**
 * lib/api/httpClient.ts
 *
 * The single centralized fetch wrapper every lib/api/*Client.ts file
 * should use — replaces the 5 near-identical copy-pasted `apiFetch`
 * implementations that used to live inside patientClient.ts, doctorClient.ts,
 * schoolClient.ts, parentClient.ts, and notificationsClient.ts.
 *
 * Talks to `/api/proxy/*` (same-origin — see
 * app/api/proxy/[...path]/route.ts), never to services/cortix-api
 * directly. `credentials: "include"` sends the httpOnly session cookies
 * automatically; this file never reads or writes a token itself, which is
 * the whole point — see the proxy route's header for why.
 *
 * Auth handling: the proxy already does 401 -> silent refresh -> retry
 * once server-side. If this client still gets a 401 back, that means the
 * refresh attempt ALSO failed (refresh token expired/invalid) — the
 * session is unrecoverable, so `onSessionExpired` (a real client-side
 * logout: clear any local UI state and redirect to /login) fires exactly
 * once per expired session, not once per failed request.
 */
"use client";

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
  }
}

const isDev = process.env.NODE_ENV !== "production";

let sessionExpiredHandled = false;

/** Called once when the proxy reports the session is unrecoverable
 * (refresh also failed). Registered by the app shell (see
 * lib/shell/useSessionExpiry.ts) so this module stays framework-agnostic
 * and doesn't import next/navigation directly. */
let onSessionExpired: (() => void) | null = null;

export function registerSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

function resetSessionExpiredGuard() {
  sessionExpiredHandled = false;
}

/** Call after a successful login so a stale guard from a previous session
 * doesn't suppress the next real expiry. */
export function notifySessionRestored() {
  resetSessionExpiredGuard();
}

export interface HttpClientOptions extends RequestInit {
  /** Set true for multipart/form-data uploads (e.g. MRI upload) — skips
   * the default Content-Type so the browser sets its own boundary. */
  isFormData?: boolean;
}

export async function httpClient<T>(path: string, init?: HttpClientOptions): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `/api/proxy/${normalizedPath}`;
  const { isFormData, ...rest } = init ?? {};

  if (isDev) {
    console.debug(`[httpClient] -> ${rest.method ?? "GET"} ${url}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      credentials: "include",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(rest.headers ?? {}),
      },
    });
  } catch (networkError) {
    throw new ApiError(
      networkError instanceof Error ? networkError.message : "Network request failed",
      0,
      url
    );
  }

  if (isDev) {
    console.debug(`[httpClient] <- ${response.status} ${url}`);
  }

  if (response.status === 401) {
    if (!sessionExpiredHandled) {
      sessionExpiredHandled = true;
      onSessionExpired?.();
    }
    throw new ApiError("Session expired", 401, url);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
      // response body wasn't JSON — keep statusText
    }
    throw new ApiError(detail, response.status, url);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
