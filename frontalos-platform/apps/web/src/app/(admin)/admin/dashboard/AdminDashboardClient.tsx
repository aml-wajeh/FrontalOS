"use client";

import { AppShell } from "@/components/shell/AppShell";
import { AdminOverviewStats } from "@/components/admin/AdminOverviewStats";
import { UsersTable } from "@/components/admin/UsersTable";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { SystemHealthPanel } from "@/components/admin/SystemHealthPanel";

/**
 * app/(admin)/admin/dashboard/AdminDashboardClient.tsx
 *
 * Closes docs/AUDIT.md §6.5: anyone who registered with role=admin used to
 * land here at /admin/dashboard (roleToPersona("admin") -> personaHomePath
 * already pointed here — see lib/auth/edge.ts) and get bounced to the
 * marketing page with no explanation, because this route never existed.
 * middleware.ts, personaConfig.tsx, and the admin backend endpoints
 * (api/v1/admin.py) were all already built for this persona; this file is
 * the missing piece that actually renders something at that address.
 */
export default function AdminDashboardPage() {
  return (
    <AppShell persona="admin" title="Admin Console">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Admin Console</h1>
          <p className="mt-1 text-sm text-white/60">
            Manage users, review platform activity, and check service health.
          </p>
        </div>

        <AdminOverviewStats />
        <UsersTable />
        <AuditLogViewer />
        <SystemHealthPanel />
      </div>
    </AppShell>
  );
}
