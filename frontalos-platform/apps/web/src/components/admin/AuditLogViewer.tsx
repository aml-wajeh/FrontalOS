"use client";

import { ScrollText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/DataState";
import { useAdminAuditLog } from "@/lib/api/useAdminQueries";

/**
 * components/admin/AuditLogViewer.tsx
 *
 * Reads database/models/auth.py::AuditLog — modeled since the earlier
 * backend pass but never populated (nothing wrote rows to it) and never
 * displayed anywhere. Both gaps are closed now: auth/router.py and
 * api/v1/admin.py write real rows via core/audit.py::record_audit_event,
 * and this is the first UI that shows them.
 */
export function AuditLogViewer() {
  const { data: entries, isLoading, isError, refetch } = useAdminAuditLog(100);

  return (
    <Card id="audit-log" className="overflow-hidden">
      <div className="border-b border-primary/[0.06] px-5 py-4 sm:px-6">
        <h2 className="font-display text-lg font-bold text-primary-dark">Audit log</h2>
        <p className="mt-0.5 text-sm text-muted">Most recent 100 events — logins, registrations, and admin actions.</p>
      </div>

      <div className="p-5 sm:p-6">
        {isLoading ? (
          <SkeletonList rows={6} />
        ) : isError ? (
          <ErrorState title="Couldn't load the audit log" onRetry={() => refetch()} />
        ) : !entries || entries.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
            title="No events yet"
            subtitle="Logins, registrations, and admin actions will appear here as they happen."
          />
        ) : (
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-primary/[0.06] bg-canvas px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={actionTone(entry.action)}>{entry.action}</Badge>
                    {entry.userEmail && <span className="text-xs font-medium text-primary-dark">{entry.userEmail}</span>}
                  </div>
                  {entry.details && <p className="mt-1 truncate text-xs text-muted">{entry.details}</p>}
                </div>
                <div className="shrink-0 text-right text-xs text-muted">
                  <p>{new Date(entry.createdAt).toLocaleString()}</p>
                  {entry.ipAddress && <p className="text-[11px] text-muted/70">{entry.ipAddress}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function actionTone(action: string): "teal" | "amber" | "navy" {
  if (action.includes("failed") || action.includes("blocked")) return "amber";
  if (action.startsWith("admin.")) return "navy";
  return "teal";
}
