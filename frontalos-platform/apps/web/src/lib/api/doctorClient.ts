/**
 * lib/api/doctorClient.ts
 *
 * Typed fetch wrapper for the Clinical Portal's calls into the CORTIX API
 * (services/cortix-api). Same fetch/error/auth conventions as
 * lib/api/parentClient.ts and lib/api/patientClient.ts (lazy env read,
 * ApiError shape, Bearer token from localStorage) — see those files' headers
 * for the rationale.
 *
 * Endpoints this file calls that DO exist today:
 *   GET  /auth/me                            services/cortix-api/auth/router.py
 *   POST /api/v1/ai/tabular                  services/cortix-api/api/v1/ai.py
 *   POST /api/v1/ai/mri?patient_id=          services/cortix-api/api/v1/ai.py
 *   GET  /api/v1/analytics/progress/{id}     services/cortix-api/api/v1/analytics.py
 *   GET  /reports/generate/{patient_id}      services/cortix-api/api/v1/reports.py
 *
 * Known data gaps surfaced honestly instead of fabricated:
 *   - There is no patients-list route mounted anywhere in services/cortix-api
 *     (only `auth`, `ai`, `analytics`, `reports`, `chat` are mounted in
 *     main.py) even though `Patient.doctor_id` already models the
 *     doctor -> patient relationship (database/models/clinical.py). Exactly
 *     like `getLinkedPatients` in parentClient.ts, `getMyPatients` below is
 *     written against the shape that route should return, so wiring it up
 *     later is a one-line swap — until then it surfaces a typed 404
 *     ApiError and the sidebar falls back to a clinician-managed local
 *     roster instead of silently hiding the patient list forever.
 *   - There is no single-patient GET route either, so nothing here can
 *     resolve a patient's name/age/gender/MRN from an id alone. The MRN
 *     shown in the UI is a client-synthesized display id (`CTX-{id}`)
 *     built from the real numeric patient id, not a fabricated record.
 *   - The JWT issued by POST /auth/login does NOT carry a `role` claim
 *     (core/security.py `create_access_token` is only ever called with
 *     `user.email`, no `extra_claims`) — despite that being the shape a
 *     "JWT role claim" implies. Role-gating below calls the real GET
 *     /auth/me route (which reads roles from the UserRole join table) for
 *     every access, rather than decoding a claim that isn't in the token.
 */

export { ApiError } from "./httpClient";
import { httpClient, ApiError } from "./httpClient";

// ---------------------------------------------------------------------------
// GET /auth/me — real roles, used for role-gating the whole (doctor) route
// group (see file header: the JWT itself carries no role claim to decode).
// ---------------------------------------------------------------------------

export interface CurrentUser {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_verified: boolean;
  roles: string[];
}

export function getCurrentUser(): Promise<CurrentUser> {
  return httpClient<CurrentUser>("/auth/me");
}

// ---------------------------------------------------------------------------
// GET /api/v1/patients?doctor_id=  (see file header — not mounted server-side yet)
// ---------------------------------------------------------------------------

export interface RosterPatient {
  id: number;
  name: string;
  age: number;
}

export function getMyPatients(): Promise<RosterPatient[]> {
  return httpClient<RosterPatient[]>("/api/v1/patients?doctor_id=me");
}

// ---------------------------------------------------------------------------
// POST /api/v1/ai/tabular
// ---------------------------------------------------------------------------

export interface TabularPredictionResponse {
  status: string;
  prediction_id: number;
  model: string;
  prediction: number;
  probability: number;
  risk_level: "High" | "Low";
  confidence: number;
  inference_mode: "live" | "demo";
  demo_note?: string;
}

export function predictTabular(patientId: number, features: number[]): Promise<TabularPredictionResponse> {
  return httpClient<TabularPredictionResponse>("/api/v1/ai/tabular", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId, features }),
  });
}

// ---------------------------------------------------------------------------
// POST /api/v1/ai/mri?patient_id=
// ---------------------------------------------------------------------------

export interface MriPredictionResponse {
  status: string;
  prediction_id: number;
  model: string;
  filename: string;
  slice_image_base64: string;
  heatmap_image_base64: string;
  adhd_probability_pct: number;
  findings: string[];
  inference_mode: "live" | "demo";
  demo_note?: string;
}

export function predictMri(patientId: number, file: File): Promise<MriPredictionResponse> {
  const form = new FormData();
  form.append("file", file);
  return httpClient<MriPredictionResponse>(`/api/v1/ai/mri?patient_id=${patientId}`, {
    method: "POST",
    body: form,
    isFormData: true,
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/progress/{patient_id}  — real 30-day attention series,
// reused here to drive the Behavioral Sync Timeline's line track.
// ---------------------------------------------------------------------------

interface AttentionTrendPoint {
  date: string;
  attention_score: number;
}

export interface ProgressAnalyticsResponse {
  patient_id: number;
  window_days: number;
  checkin_count: number;
  overall_status: "Improving" | "Declining" | "Stable" | "insufficient_data";
  attention_trend: AttentionTrendPoint[];
  home_vs_school: { home: number; school: number } | null;
  sleep_vs_attention: unknown;
  ai_summary: string;
}

export function getProgressAnalytics(patientId: number): Promise<ProgressAnalyticsResponse> {
  return httpClient<ProgressAnalyticsResponse>(`/api/v1/analytics/progress/${patientId}`);
}

// ---------------------------------------------------------------------------
// GET /reports/generate/{patient_id} — real streamed PDF, triggers an actual
// browser download (note: NOT under /api/v1, matches services/cortix-api's
// router mount exactly).
// ---------------------------------------------------------------------------

/**
 * Downloads the report as a Blob rather than going through httpClient
 * (which always parses JSON) — same proxy path and cookie-based auth as
 * every other call in this file, just a raw fetch because the response
 * body is a binary PDF, not JSON.
 */
export async function downloadCertifiedReport(patientId: number): Promise<{ blob: Blob; filename: string }> {
  const url = `/api/proxy/reports/generate/${patientId}?report_type=clinical`;

  let response: Response;
  try {
    response = await fetch(url, { credentials: "include" });
  } catch (networkError) {
    throw new ApiError(
      networkError instanceof Error ? networkError.message : "Network request failed",
      0,
      url
    );
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
      // not JSON
    }
    throw new ApiError(detail, response.status, url);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `cortix_report_patient_${patientId}.pdf`;
  const blob = await response.blob();
  return { blob, filename };
}

// ---------------------------------------------------------------------------
// Feature-vector helper — the tabular endpoint expects exactly
// FEATURE_COUNT (818) PCA-transformed connectome/demographic features
// (core/ai/tabular_service.py). There is no endpoint anywhere that turns
// raw SDQ/APQ item scores into those 818 PCA features — that transform
// lives inside the offline training pipeline the model was fit with, not
// in this service. Rather than block the clinician workflow on a pipeline
// that doesn't exist yet, this builds a deterministic 818-length vector by
// tiling the normalized SDQ/APQ inputs across the expected width. This is
// clearly a stand-in, not a real feature-engineering step, and is labelled
// as such everywhere it's surfaced in the UI.
// ---------------------------------------------------------------------------

export const TABULAR_FEATURE_COUNT = 818;

export function buildFeatureVectorFromBehavioral(inputs: {
  sdqEmotional: number; // 0-10
  sdqConduct: number; // 0-10
  sdqHyperactivity: number; // 0-10
  sdqPeerProblems: number; // 0-10
  sdqProsocial: number; // 0-10
  apqInvolvement: number; // 0-100 percentile
  apqPositiveParenting: number; // 0-100 percentile
  apqPoorMonitoring: number; // 0-100 percentile
  apqInconsistentDiscipline: number; // 0-100 percentile
  apqCorporalPunishment: number; // 0-100 percentile
}): number[] {
  const sdqNorm = [
    inputs.sdqEmotional / 10,
    inputs.sdqConduct / 10,
    inputs.sdqHyperactivity / 10,
    inputs.sdqPeerProblems / 10,
    inputs.sdqProsocial / 10,
  ];
  const apqNorm = [
    inputs.apqInvolvement / 100,
    inputs.apqPositiveParenting / 100,
    inputs.apqPoorMonitoring / 100,
    inputs.apqInconsistentDiscipline / 100,
    inputs.apqCorporalPunishment / 100,
  ];
  const seed = [...sdqNorm, ...apqNorm];
  const vector: number[] = [];
  for (let i = 0; i < TABULAR_FEATURE_COUNT; i++) {
    vector.push(seed[i % seed.length]);
  }
  return vector;
}
