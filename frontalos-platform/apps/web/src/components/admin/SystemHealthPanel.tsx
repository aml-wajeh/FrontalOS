"use client";

import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ErrorState, SkeletonList } from "@/components/ui/DataState";
import { useAdminSystemHealth } from "@/lib/api/useAdminQueries";
import { cn } from "@/lib/utils";

/**
 * components/admin/SystemHealthPanel.tsx
 *
 * Aggregates cortix-api's own /health with frontalos-engine's /health
 * (api/v1/admin.py::system_health) into one screen, so an admin doesn't
 * need to know both services' URLs to check platform status — the third
 * MVP item the staff audit recommended alongside users + audit log.
 */
export function SystemHealthPanel() {
  const { data: services, isLoading, isError, refetch } = useAdminSystemHealth();

  return (
    <Card id="system-health" className="overflow-hidden">
      <div className="border-b border-primary/[0.06] px-5 py-4 sm:px-6">
        <h2 className="font-display text-lg font-bold text-primary-dark">System health</h2>
        <p className="mt-0.5 text-sm text-muted">cortix-api and frontalos-engine, checked live.</p>
      </div>

      <div className="p-5 sm:p-6">
        {isLoading ? (
          <SkeletonList rows={2} />
        ) : isError ? (
          <ErrorState title="Couldn't check system health" onRetry={() => refetch()} />
        ) : !services || services.length === 0 ? (
          <p className="text-sm text-muted">No services reported.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {services.map((svc) => (
              <div
                key={svc.name}
                className={cn(
                  "rounded-2xl border p-4",
                  svc.reachable ? "border-secondary/20 bg-secondary-light/40" : "border-accent/30 bg-accent-soft/50"
                )}
              >
                <div className="flex items-center gap-2">
                  {svc.reachable ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-secondary" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-accent" />
                  )}
                  <span className="font-display text-sm font-bold text-primary-dark">{svc.name}</span>
                  <span className="ml-auto text-xs font-semibold text-primary-dark">
                    {svc.reachable ? "Reachable" : "Unreachable"}
                  </span>
                </div>

                {svc.reachable && svc.detail && (
                  <dl className="mt-3 space-y-1 text-xs text-muted">
                    {Object.entries(svc.detail).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-2">
                        <dt className="shrink-0 capitalize">{key.replace(/_/g, " ")}</dt>
                        <dd className="truncate text-right font-medium text-primary-dark">{formatDetailValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {!svc.reachable && svc.error && <p className="mt-2 text-xs text-primary-dark/80">{svc.error}</p>}
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted/80">
          <Activity className="h-3 w-3" aria-hidden="true" />
          Checked on every load — not a continuous monitor.
        </p>
      </div>
    </Card>
  );
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
