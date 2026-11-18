"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/DataState";
import type { ComposedChartPoint } from "@/lib/api/parentClient";

interface FocusSleepComposedChartProps {
  data: ComposedChartPoint[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

export function FocusSleepComposedChart({ data, isLoading, isError, onRetry }: FocusSleepComposedChartProps) {
  const hasSleepData = (data ?? []).some((d) => d.sleepHours !== null);

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-primary-dark">Sleep &amp; Focus, 30 Days</h3>
          <p className="text-xs text-muted">Nightly sleep against daily focus score</p>
        </div>

        {isLoading && <ChartSkeleton />}

        {isError && !isLoading && (
          <ErrorState
            title="Couldn't load this chart"
            subtitle="Check your connection and try again in a bit."
            onRetry={onRetry}
            height="h-64"
          />
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sleepBarFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" stroke="var(--color-primary)" strokeOpacity={0.06} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="sleep"
                    domain={[0, 12]}
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                    label={{ value: "hrs", angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--color-muted)" }}
                  />
                  <YAxis
                    yAxisId="focus"
                    orientation="right"
                    domain={[0, 10]}
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip content={<ComposedTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, color: "var(--color-muted)" }}
                  />
                  <Bar
                    yAxisId="sleep"
                    dataKey="sleepHours"
                    name="Sleep (hrs)"
                    fill="url(#sleepBarFill)"
                    stroke="var(--color-primary)"
                    strokeOpacity={0.15}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                  <Line
                    yAxisId="focus"
                    type="monotone"
                    dataKey="focusScore"
                    name="Focus Score"
                    stroke="var(--color-secondary)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, fill: "var(--color-secondary)", stroke: "white", strokeWidth: 2 }}
                    connectNulls
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {!hasSleepData && (
              <p className="text-[11px] text-muted">
                Nightly sleep isn&apos;t tracked as a daily series yet — showing focus trend only.
              </p>
            )}
          </>
        )}

        {!isLoading && !isError && (!data || data.length === 0) && (
          <EmptyState
            title="No trend yet"
            subtitle="Once check-ins start coming in, the 30-day trend will appear here."
            height="h-64"
          />
        )}
      </CardBody>
    </Card>
  );
}

function ComposedTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | null; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-primary/[0.06] bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-primary-dark">{label}</p>
      {payload
        .filter((entry) => entry.value !== null && entry.value !== undefined)
        .map((entry) => (
          <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}
          </p>
        ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-64 w-full animate-pulse rounded-2xl bg-canvas" aria-hidden="true">
      <div className="flex h-full items-end gap-2 p-4">
        {[40, 65, 50, 80, 55, 70, 60, 45, 75, 58].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-primary/[0.08]" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}