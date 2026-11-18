/**
 * lib/api/parentClient.ts
 *
 * Typed fetch wrapper for the Parent Command Center's calls into the CORTIX
 * API (services/cortix-api). Reuses the same fetch/error/auth conventions
 * as lib/api/patientClient.ts — see that file's header for the rationale
 * (lazy env read, ApiError shape, Bearer token from localStorage).
 *
 * Endpoints this file calls that DO exist today (services/cortix-api/api/v1/analytics.py):
 *   GET /api/v1/analytics/progress/{patient_id}
 *   GET /api/v1/analytics/forecast/{patient_id}
 *   GET /api/v1/analytics/radar/{patient_id}
 *
 * Endpoint this file calls that does NOT exist yet:
 *   GET /api/v1/patients/me/children
 *     There is no patients-list route mounted in services/cortix-api's
 *     main.py today (only `auth`, `ai`, `analytics`, `reports`, `chat` are
 *     mounted) even though `Patient.guardian_id` already models the
 *     parent -> child relationship (database/models/clinical.py). Exactly
 *     like `postCheckin` in patientClient.ts, this is written against the
 *     shape that route should return so wiring it up later is a no-op
 *     here — until then `getLinkedPatients` surfaces a typed 404 ApiError
 *     and the dashboard falls back to the single known patient instead of
 *     silently hiding the switcher forever.
 *
 * Known data gaps surfaced honestly instead of fabricated (see each
 * function's docstring): the analytics endpoints do not expose a raw
 * per-day sleep-hours series, a coins/rewards figure, or (for most
 * patients, until CheckIn data grows) medication adherence / social
 * engagement scores. Callers get `null` for these rather than an invented
 * number — the UI is expected to render an explicit "not enough data"
 * state, not a fake zero.
 */

export { ApiError } from "./httpClient";
import { httpClient, ApiError } from "./httpClient";

// ---------------------------------------------------------------------------
// GET /api/v1/patients/me/children  (see file header — not mounted server-side yet)
// ---------------------------------------------------------------------------

export interface LinkedPatient {
  id: number;
  name: string;
  age: number;
}

/**
 * Returns every patient linked to the signed-in parent (`guardian_id` on
 * `Patient`). Not mounted server-side yet, so this will throw a 404
 * ApiError until that route ships — `useLinkedPatients` below treats that
 * 404 as "exactly one known patient" rather than surfacing a hard error,
 * since a single-child household is the common case and shouldn't block
 * the whole dashboard on a route that hasn't landed yet.
 */
export function getLinkedPatients(): Promise<LinkedPatient[]> {
  return httpClient<LinkedPatient[]>("/api/v1/patients/me/children");
}

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/progress/{patient_id}
// ---------------------------------------------------------------------------

interface AttentionTrendPoint {
  date: string; // ISO date
  attention_score: number;
}

interface SleepVsAttention {
  correlation: number | null;
  p_value?: number;
  n: number;
  note?: string;
}

export interface ProgressAnalyticsResponse {
  patient_id: number;
  window_days: number;
  checkin_count: number;
  overall_status: "Improving" | "Declining" | "Stable" | "insufficient_data";
  attention_trend: AttentionTrendPoint[];
  home_vs_school: { home: number; school: number } | null;
  sleep_vs_attention: SleepVsAttention | null;
  ai_summary: string;
}

export function getProgressAnalytics(patientId: number): Promise<ProgressAnalyticsResponse> {
  return httpClient<ProgressAnalyticsResponse>(`/api/v1/analytics/progress/${patientId}`);
}

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/forecast/{patient_id}
// ---------------------------------------------------------------------------

export interface ForecastResponse {
  patient_id: number;
  status: "ok" | "insufficient_data";
  message?: string;
  method?: string;
  data_points_used?: number;
  predicted_next_day_focus_score: number | null;
  confidence_pct: number | null;
  confidence_note?: string;
  top_contributing_feature: string | null;
}

export function getForecast(patientId: number): Promise<ForecastResponse> {
  return httpClient<ForecastResponse>(`/api/v1/analytics/forecast/${patientId}`);
}

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/radar/{patient_id}
// ---------------------------------------------------------------------------

export interface RadarResponse {
  patient_id: number;
  axes: string[]; // ["Focus", "Activity Level", "Sleep Quality", "Medication Adherence", "Social Engagement"]
  patient_scores: (number | null)[]; // 0-100, same order as axes
  age_norm_baseline: number[]; // 0-100, same order as axes
  untracked_axes_note: string;
  checkin_count: number;
}

export function getRadar(patientId: number): Promise<RadarResponse> {
  return httpClient<RadarResponse>(`/api/v1/analytics/radar/${patientId}`);
}

// ---------------------------------------------------------------------------
// Derived view models — pure functions over the raw responses above, no
// fetching. Kept here (rather than inline in components) so the "what's
// real vs. what's a documented gap" logic lives in one auditable place.
// ---------------------------------------------------------------------------

export interface ComposedChartPoint {
  label: string; // e.g. "Aug 3"
  date: string;
  focusScore: number | null; // 0-10, scaled from attention_score
  sleepHours: number | null; // always null today — see docstring below
}

/**
 * Builds the 30-day Focus/Sleep series for the composed chart from
 * `attention_trend`. `sleepHours` is always `null`: CheckIn rows do carry
 * `sleep_hours`, but GET /analytics/progress only returns the paired
 * correlation coefficient (`sleep_vs_attention`), not a per-day series —
 * so there is nothing real to plot per day yet. The chart component skips
 * rendering the Sleep bars entirely rather than drawing a flat/fake line,
 * the same way the Patient Portal's DailyProgressChart skips its Boredom
 * line when `boredomScore` is null.
 */
export function toComposedChartData(progress: ProgressAnalyticsResponse): ComposedChartPoint[] {
  return progress.attention_trend.map((point) => ({
    label: new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    date: point.date,
    focusScore: Math.max(0, Math.min(10, point.attention_score / 10)),
    sleepHours: null,
  }));
}

export interface KpiValue {
  value: number | null;
  deltaPct: number | null; // percentage-point or percent change vs. prior comparable window; null if not computable
  available: boolean;
  unavailableReason?: string;
}

function splitLastNVsPrior<T>(items: T[], n: number): { recent: T[]; prior: T[] } {
  const recent = items.slice(-n);
  const prior = items.slice(Math.max(0, items.length - 2 * n), items.length - n);
  return { recent, prior };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Focus Score (7d avg), 0-10 scale, with a delta vs. the prior 7 days when enough history exists. */
export function focusScoreKpi(progress: ProgressAnalyticsResponse): KpiValue {
  const scores = progress.attention_trend.map((p) => p.attention_score / 10);
  const { recent, prior } = splitLastNVsPrior(scores, 7);
  const recentAvg = average(recent);
  const priorAvg = average(prior);

  if (recentAvg === null) {
    return { value: null, deltaPct: null, available: false, unavailableReason: "No check-ins yet" };
  }
  return {
    value: recentAvg,
    deltaPct: priorAvg && priorAvg !== 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : null,
    available: true,
  };
}

/**
 * Sleep Quality (30d), 0-100 proxy score sourced from the radar endpoint
 * (`sleep_hours` averaged against a pediatric 9hr target band server-side).
 * This intentionally reports "quality" rather than "avg hrs/night": no
 * endpoint today exposes a raw per-day sleep-hours series, so hours alone
 * can't be computed or diffed honestly (see toComposedChartData above for
 * the same gap). Radar is also a single 30-day window, not two
 * back-to-back 7-day windows, so no week-over-week delta is shown.
 */
export function sleepQualityKpi(radar: RadarResponse): KpiValue {
  const idx = radar.axes.indexOf("Sleep Quality");
  const value = idx >= 0 ? radar.patient_scores[idx] : null;
  if (value === null || value === undefined) {
    return { value: null, deltaPct: null, available: false, unavailableReason: "Not enough sleep data yet" };
  }
  return { value, deltaPct: null, available: true };
}

/** Medication Adherence %. Null until the CheckIn schema tracks it (see radar.untracked_axes_note). */
export function medicationAdherenceKpi(radar: RadarResponse): KpiValue {
  const idx = radar.axes.indexOf("Medication Adherence");
  const value = idx >= 0 ? radar.patient_scores[idx] : null;
  if (value === null || value === undefined) {
    return { value: null, deltaPct: null, available: false, unavailableReason: "Not tracked yet" };
  }
  return { value, deltaPct: null, available: true };
}

/**
 * Coin Balance. Backed by services/cortix-api/api/v1/rewards.py (added
 * alongside the Patient Portal's server-synced wallet) — the balance is
 * the same ledger total shown in the Patient Portal, not a client-only
 * localStorage number, so a parent viewing from a different device now
 * sees a real, current figure. There's no per-week "earned" breakdown
 * endpoint yet (only the running total), so this reports the current
 * balance rather than a 7-day delta — the label reflects that honestly.
 */
export function coinBalanceKpi(balance: number | undefined): KpiValue {
  if (balance === undefined) {
    return { value: null, deltaPct: null, available: false, unavailableReason: "No coin activity yet" };
  }
  return { value: balance, deltaPct: null, available: true };
}