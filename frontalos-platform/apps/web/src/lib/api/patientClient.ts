/**
 * lib/api/patientClient.ts
 *
 * Typed fetch wrapper for the Patient Portal's calls into the CORTIX API
 * (services/cortix-api). Every exported function here corresponds to an
 * endpoint that actually exists and is mounted in that service today:
 *
 *   POST /api/v1/games/metrics               services/cortix-api/api/v1/games.py
 *   POST /api/v1/checkins                    services/cortix-api/api/v1/checkins.py
 *   GET  /api/v1/analytics/progress/{id}     services/cortix-api/api/v1/analytics.py
 *   GET  /api/v1/rewards/wallet/{id}         services/cortix-api/api/v1/rewards.py
 *   POST /api/v1/rewards/wallet/{id}/spend   services/cortix-api/api/v1/rewards.py
 *
 * This file never reads `NEXT_PUBLIC_*` env vars at module scope (Next.js
 * inlines them at build time per-callsite, but reading lazily inside each
 * function keeps this file safe to import from both client and server
 * components).
 */

export { ApiError } from "./httpClient";
import { httpClient, ApiError } from "./httpClient";

// ---------------------------------------------------------------------------
// POST /api/v1/games/metrics
// ---------------------------------------------------------------------------

export interface GameMetricsPayload {
  patient_id: number;
  game_name: string;
  accuracy: number; // 0-1
  reaction_time: number; // seconds, average
  mistakes: number;
  breaks: number;
  difficulty: "easy" | "adaptive" | "hard";
  session_duration: number; // seconds
}

export interface GameMetricsResponse {
  status: string;
  message: string;
  data: GameMetricsPayload;
}

export function postGameMetrics(payload: GameMetricsPayload): Promise<GameMetricsResponse> {
  return httpClient<GameMetricsResponse>("/api/v1/games/metrics", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// POST /api/v1/checkins  (see file header — not mounted server-side yet)
// ---------------------------------------------------------------------------

export interface CheckinPayload {
  patient_id: number;
  checkin_type: "daily" | "weekly";
  mood?: string;
  attention_score?: number;
  hyperactivity_score?: number;
  sleep_hours?: number;
  notes?: string;
}

export interface CheckinResponse {
  id: number;
  patient_id: number;
  checkin_type: string;
  created_at: string;
}

export function postCheckin(payload: CheckinPayload): Promise<CheckinResponse> {
  return httpClient<CheckinResponse>("/api/v1/checkins", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/progress/{patient_id}
// ---------------------------------------------------------------------------

interface AnalyticsProgressResponse {
  patient_id: number;
  overall_status: string;
  attention_trend: number[] | null;
  home_vs_school: { home: number; school: number } | null;
  sleep_vs_attention: { correlation: number } | null;
  ai_summary: string;
}

export interface DailyProgressPoint {
  label: string; // e.g. "Mon"
  focusScore: number | null; // 0-10, derived from attention_trend when present
  boredomScore: null; // not tracked server-side yet — see comment below
}

/**
 * The Patient Portal's Daily Progress card wants a focus-vs-boredom line
 * over the last 7 days. The only real time series the API exposes today is
 * `attention_trend` from CheckIn rows (analytics.py) — there's no persisted
 * boredom history (the FrontalOS Engine's per-frame boredom score is
 * computed live in services/frontalos-engine and never written to
 * PostgreSQL). Rather than fabricate a boredom number from thin air,
 * `boredomScore` is always returned as `null` here and the chart component
 * renders only the line it actually has data for.
 */
export async function getDailyProgress(patientId: number): Promise<DailyProgressPoint[]> {
  const result = await httpClient<AnalyticsProgressResponse>(
    `/api/v1/analytics/progress/${patientId}`
  );

  const trend = result.attention_trend ?? [];
  const days = trend.slice(-7);
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const offset = dayLabels.length - days.length;

  return days.map((value, i) => ({
    label: dayLabels[(offset + i) % dayLabels.length],
    // attention_trend values in the reference implementation are 0-100;
    // scale to the portal's 0-10 focus score for a consistent chart axis.
    focusScore: Math.max(0, Math.min(10, value / 10)),
    boredomScore: null,
  }));
}

// ---------------------------------------------------------------------------
// GET /api/v1/rewards/wallet/{patient_id}
// POST /api/v1/rewards/wallet/{patient_id}/spend
//
// services/cortix-api/api/v1/rewards.py — the wallet balance is
// SUM(RewardTransaction.amount) for the patient, computed server-side on
// every read so it can never drift from the ledger. Earning happens
// automatically server-side when postGameMetrics (above) records a
// session; spending goes through spendRewardCoins below rather than a
// local-only decrement, so a redemption is only reflected once the server
// has actually accepted it.
// ---------------------------------------------------------------------------

export interface RewardWalletBalance {
  patient_id: number;
  balance: number;
}

export function getRewardWallet(patientId: number): Promise<RewardWalletBalance> {
  return httpClient<RewardWalletBalance>(`/api/v1/rewards/wallet/${patientId}`);
}

export interface SpendRewardPayload {
  amount: number;
  reason?: string;
  reference_type?: string;
  reference_id?: number;
}

export interface SpendRewardResponse {
  patient_id: number;
  balance: number;
  spent: number;
}

export function spendRewardCoins(
  patientId: number,
  payload: SpendRewardPayload
): Promise<SpendRewardResponse> {
  return httpClient<SpendRewardResponse>(`/api/v1/rewards/wallet/${patientId}/spend`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
