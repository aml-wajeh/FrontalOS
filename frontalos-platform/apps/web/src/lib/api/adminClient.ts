/**
 * lib/api/adminClient.ts
 *
 * Typed client for the Admin Portal — built as part of the staff-audit
 * follow-up that closed docs/AUDIT.md §6.5 ("admin" was a registerable
 * role with no portal behind it). Every endpoint here is real:
 * services/cortix-api/api/v1/admin.py was already written in an earlier
 * pass but was never mounted in main.py and had no frontend calling it —
 * both gaps are closed alongside this file.
 *
 * Follows the same conventions as schoolClient.ts / parentClient.ts:
 * thin typed wrappers around httpClient(), which itself talks to
 * /api/proxy/* (same-origin BFF, httpOnly cookie auth) — never directly
 * to services/cortix-api from the browser.
 */
import { httpClient } from "./httpClient";

export { ApiError } from "./httpClient";

// ---------------------------------------------------------------------------
// Users — GET/PATCH/PUT /api/v1/admin/users*
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  isActive: boolean;
  isVerified: boolean;
  roles: string[];
  createdAt: string;
}

interface AdminUserApiShape {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_verified: boolean;
  roles: string[];
  created_at: string;
}

function fromApiUser(u: AdminUserApiShape): AdminUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    isActive: u.is_active,
    isVerified: u.is_verified,
    roles: u.roles,
    createdAt: u.created_at,
  };
}

export async function getUsers(): Promise<AdminUser[]> {
  const rows = await httpClient<AdminUserApiShape[]>("/api/v1/admin/users");
  return rows.map(fromApiUser);
}

export function deactivateUser(userId: number): Promise<{ status: string; is_active: boolean }> {
  return httpClient(`/api/v1/admin/users/${userId}/deactivate`, { method: "PATCH" });
}

export function reactivateUser(userId: number): Promise<{ status: string; is_active: boolean }> {
  return httpClient(`/api/v1/admin/users/${userId}/reactivate`, { method: "PATCH" });
}

/** Mirrors ADMIN_ASSIGNABLE_ROLES in api/v1/admin.py. "child" is included
 * there for completeness (existing child accounts can be relabeled) even
 * though it's excluded from self-registration — see authSchemas.ts. */
export const ADMIN_ASSIGNABLE_ROLES = [
  "parent",
  "child",
  "doctor",
  "psychologist",
  "school",
  "admin",
] as const;
export type AdminAssignableRole = (typeof ADMIN_ASSIGNABLE_ROLES)[number];

export function setUserRole(userId: number, role: AdminAssignableRole): Promise<{ status: string; role: string }> {
  return httpClient(`/api/v1/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

// ---------------------------------------------------------------------------
// Audit log — GET /api/v1/admin/audit-log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  userEmail: string | null;
  action: string;
  ipAddress: string | null;
  details: string | null;
  createdAt: string;
}

interface AuditLogApiShape {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  ip_address: string | null;
  details: string | null;
  created_at: string;
}

export async function getAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  const rows = await httpClient<AuditLogApiShape[]>(`/api/v1/admin/audit-log?limit=${limit}`);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email,
    action: r.action,
    ipAddress: r.ip_address,
    details: r.details,
    createdAt: r.created_at,
  }));
}

// ---------------------------------------------------------------------------
// System health — GET /api/v1/admin/system-health
// ---------------------------------------------------------------------------

export interface ServiceHealth {
  name: string;
  reachable: boolean;
  detail: Record<string, unknown> | null;
  error: string | null;
}

export function getSystemHealth(): Promise<ServiceHealth[]> {
  return httpClient<ServiceHealth[]>("/api/v1/admin/system-health");
}
