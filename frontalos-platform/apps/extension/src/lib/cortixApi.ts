/**
 * lib/cortixApi.ts
 *
 * Talks directly to services/cortix-api (never to apps/web's
 * /api/proxy/* — that route only accepts the httpOnly session cookie,
 * which a chrome-extension:// origin can't send). The extension instead
 * carries its own bearer access token, obtained once via the Connect flow
 * (see popup/components/ConnectScreen.tsx + README "Auth flow") and
 * refreshed here on a 401 using the stored refresh token — the same
 * access/refresh token pair services/cortix-api/auth/router.py already
 * issues for the web app, just held extension-side instead of in an
 * httpOnly cookie.
 *
 * Endpoints used (all confirmed mounted in services/cortix-api/main.py):
 *   GET  /auth/me
 *   POST /auth/refresh
 *   GET  /api/v1/rewards/wallet/{patient_id}
 *   POST /api/v1/games/metrics
 *   GET  /api/v1/notifications
 */
import { clearSession, getSession, getSettings, setSession } from "./storage";
import type { NotificationItem, RewardWalletBalance, StoredSession } from "./types";

export class CortixApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CortixApiError";
    this.status = status;
  }
}

async function refreshSession(session: StoredSession): Promise<StoredSession | null> {
  if (!session.refreshToken) return null;
  const { apiBaseUrl } = await getSettings();
  try {
    const res = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token: string; refresh_token: string };
    const next: StoredSession = {
      ...session,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      // ACCESS_TOKEN_EXPIRE_MINUTES defaults to 30 (.env.example) — the API
      // doesn't echo an exact expiry back, so this mirrors that default
      // rather than guessing something more precise.
      expiresAt: Date.now() + 30 * 60_000,
    };
    await setSession(next);
    return next;
  } catch {
    return null;
  }
}

async function authedFetch(path: string, init?: RequestInit, isRetry = false): Promise<Response> {
  const session = await getSession();
  if (!session) throw new CortixApiError("Not connected", 401);
  const { apiBaseUrl } = await getSettings();

  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${session.accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401 && !isRetry) {
    const refreshed = await refreshSession(session);
    if (refreshed) return authedFetch(path, init, true);
    await clearSession();
    throw new CortixApiError("Session expired — reconnect from the popup", 401);
  }

  return res;
}

export async function getRewardWalletBalance(patientId: number): Promise<RewardWalletBalance> {
  const res = await authedFetch(`/api/v1/rewards/wallet/${patientId}`);
  if (!res.ok) throw new CortixApiError("Couldn't load coin balance", res.status);
  return res.json();
}

export interface GameMetricsPayload {
  patient_id: number;
  game_name: string;
  accuracy: number;
  reaction_time: number;
  mistakes: number;
  breaks: number;
  difficulty: "easy" | "adaptive" | "hard";
  session_duration: number;
}

/** Same shape/endpoint the main Dopamine Menu posts to
 * (components/patient/DopamineMenu.tsx's handleComplete) so a mini
 * exercise finished from the popup earns real coins on the same ledger
 * the full dashboard reads from. */
export async function postGameMetrics(payload: GameMetricsPayload): Promise<void> {
  const res = await authedFetch("/api/v1/games/metrics", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new CortixApiError("Couldn't record that session", res.status);
}

/** 404 means the route simply isn't mounted in this deployment yet (see
 * notificationsClient.ts's header in apps/web) — treated as "no
 * notifications" rather than an error, same convention as the web app. */
export async function getNotifications(): Promise<NotificationItem[]> {
  const res = await authedFetch("/api/v1/notifications");
  if (res.status === 404) return [];
  if (!res.ok) throw new CortixApiError("Couldn't load notifications", res.status);
  return res.json();
}

export async function verifySession(): Promise<boolean> {
  try {
    const res = await authedFetch("/auth/me");
    return res.ok;
  } catch {
    return false;
  }
}
