"use client";

import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/DataState";
import type { DailyProgressPoint } from "@/lib/api/patientClient";

interface DailyProgressChartProps {
  data: DailyProgressPoint[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

export function DailyProgressChart({ data, isLoading, isError, onRetry }: DailyProgressChartProps) {
  const hasBoredomData = (data ?? []).some((d) => d.boredomScore !== null);

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-primary-dark">Daily Progress</h3>
          <p className="text-xs text-muted">Focus score over the last 7 days</p>
        </div>

        {isLoading && <ChartSkeleton />}

        {isError && !isLoading && (
          <ErrorState
            title="Couldn't load your progress"
            subtitle="Check your connection and try again in a bit."
            onRetry={onRetry}
            height="h-48"
          />
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<ProgressTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="focusScore"
                    name="Focus"
                    stroke="var(--color-secondary)"
                    strokeWidth={2.5}
                    fill="url(#focusFill)"
                    dot={false}
                    isAnimationActive
                    animationDuration={900}
                    connectNulls
                  />
                  {hasBoredomData && (
                    <Line
                      type="monotone"
                      dataKey="boredomScore"
                      name="Boredom"
                      stroke="var(--color-accent)"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive
                      animationDuration={900}
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {!hasBoredomData && (
              <p className="text-[11px] text-muted">
                Boredom trend isn&apos;t tracked yet — showing focus score only.
              </p>
            )}
          </>
        )}

        {!isLoading && !isError && (!data || data.length === 0) && (
          <EmptyState
            title="No progress yet"
            subtitle="Complete a few check-ins to see your trend here."
            height="h-48"
          />
        )}
      </CardBody>
    </Card>
  );
}

function ProgressTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-primary/[0.06] bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-primary-dark">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}
        </p>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-48 w-full animate-pulse rounded-2xl bg-canvas" aria-hidden="true">
      <div className="flex h-full items-end gap-2 p-4">
        {[40, 65, 50, 80, 55, 70, 60].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-primary/[0.08]" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}