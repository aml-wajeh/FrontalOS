/**
 * lib/api/schoolClient.ts
 *
 * Typed client for the School Portal, following the same conventions as
 * parentClient.ts (see that file's header): real endpoints are called as
 * real endpoints; endpoints that don't exist in services/cortix-api yet
 * are called against the shape they SHOULD have, with the gap documented
 * per-function so wiring them up later is a no-op here.
 *
 * What's real today:
 *   GET /api/v1/analytics/progress/{patient_id} — reused as-is for the
 *   read-only Focus trend (see toComposedChartData in parentClient.ts).
 *
 * What's not mounted yet (both gaps below, same as getLinkedPatients in
 * parentClient.ts):
 *   GET  /api/v1/patients/me/students — `Patient.school_id` already exists
 *     (database/models/clinical.py) but no route reads it. 404s to an
 *     empty roster rather than crashing the page.
 *   POST /api/v1/clinical/observations — this task's spec calls for a new
 *     endpoint here. Per "do not touch services/" for this pass, the
 *     lightweight model/router isn't added in this change; the request is
 *     written against the payload shape that endpoint should accept
 *     (mirrors TimelineEvent's event_type="school" shape already in
 *     database/models/clinical.py, so the eventual backend work is closer
 *     to "add a router" than "invent a schema"). Until it exists, submit
 *     surfaces a clear toast instead of a fake success.
 */
import { httpClient, ApiError } from "./httpClient";

export { ApiError } from "./httpClient";
export { getProgressAnalytics, toComposedChartData } from "./parentClient";
export type { ProgressAnalyticsResponse, ComposedChartPoint } from "./parentClient";

// ---------------------------------------------------------------------------
// GET /api/v1/patients/me/students  (not mounted server-side yet — see header)
// ---------------------------------------------------------------------------

export interface LinkedStudent {
  id: number;
  name: string;
  age: number;
  /** Simple status indicator for the roster — derived client-side (see StudentStatus below) once real data exists; null while unreachable. */
  status: "on_track" | "needs_attention" | "unknown";
}

export async function getLinkedStudents(): Promise<LinkedStudent[]> {
  try {
    return await httpClient<LinkedStudent[]>("/api/v1/patients/me/students");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return [];
    throw err;
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/clinical/observations  (does not exist yet — see header)
// ---------------------------------------------------------------------------

export interface ClassroomObservationInput {
  patientId: number;
  attentionDuringLesson: "consistently_focused" | "some_drifting" | "frequently_distracted";
  peerInteraction: "positive" | "mixed" | "withdrawn_or_conflict";
  taskCompletion: "completed_independently" | "completed_with_support" | "incomplete";
  notes?: string;
}

export function postClassroomObservation(input: ClassroomObservationInput): Promise<{ status: string }> {
  return httpClient<{ status: string }>("/api/v1/clinical/observations", {
    method: "POST",
    body: JSON.stringify({
      patient_id: input.patientId,
      attention_during_lesson: input.attentionDuringLesson,
      peer_interaction: input.peerInteraction,
      task_completion: input.taskCompletion,
      notes: input.notes ?? null,
    }),
  });
}
