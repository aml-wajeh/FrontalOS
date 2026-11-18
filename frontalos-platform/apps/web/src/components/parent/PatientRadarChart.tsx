"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardBody } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/DataState";
import type { RadarResponse } from "@/lib/api/parentClient";

interface PatientRadarChartProps {
  data: RadarResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

interface RadarRow {
  axis: string;
  patient: number | null;
  ageNorm: number;
}

export function PatientRadarChart({ data, isLoading, isError, onRetry }: PatientRadarChartProps) {
  const rows: RadarRow[] | null = data
    ? data.axes.map((axis, i) => ({
        axis,
        patient: data.patient_scores[i] ?? null,
        ageNorm: data.age_norm_baseline[i],
      }))
    : null;

  const untrackedAxes = rows?.filter((r) => r.patient === null).map((r) => r.axis) ?? [];

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-primary-dark">Whole-Picture Snapshot</h3>
            <p className="text-xs text-muted">30-day scores against an age-typical baseline</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] font-medium">
            <span className="flex items-center gap-1.5 text-primary-dark">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              {data ? `Patient ${data.patient_id}` : "Patient"}
            </span>
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full border border-primary/40" />
              Age-norm baseline
            </span>
          </div>
        </div>

        {isLoading && <RadarSkeleton />}

        {isError && !isLoading && (
          <ErrorState
            title="Couldn't load this snapshot"
            subtitle="Check your connection and try again in a bit."
            onRetry={onRetry}
            height="h-72"
          />
        )}

        {!isLoading && !isError && rows && (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={rows} outerRadius="72%">
                  <defs>
                    <radialGradient id="patientRadarFill">
                      <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity={0.42} />
                      <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity={0.12} />
                    </radialGradient>
                  </defs>
                  <PolarGrid stroke="var(--color-primary)" strokeOpacity={0.1} />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fontSize: 11, fill: "var(--color-muted)" }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 9, fill: "var(--color-muted)" }}
                    tickCount={5}
                    axisLine={false}
                  />
                  <Radar
                    name="Age-norm baseline"
                    dataKey="ageNorm"
                    stroke="var(--color-primary)"
                    strokeOpacity={0.5}
                    strokeDasharray="4 3"
                    fill="var(--color-primary)"
                    fillOpacity={0.06}
                    isAnimationActive
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                  <Radar
                    name="Patient"
                    dataKey="patient"
                    stroke="var(--color-secondary)"
                    fill="url(#patientRadarFill)"
                    fillOpacity={1}
                    connectNulls
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                  <Tooltip content={<RadarTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {untrackedAxes.length > 0 && (
              <p className="text-[11px] text-muted">
                {untrackedAxes.join(" & ")} {untrackedAxes.length === 1 ? "isn't" : "aren't"} tracked yet — shown
                as a gap on the patient shape rather than a guessed score.
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function RadarTooltip({
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
      {payload.map((entry) => (
        <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: {entry.value === null || entry.value === undefined ? "No data" : entry.value.toFixed(0)}
        </p>
      ))}
    </div>
  );
}

function RadarSkeleton() {
  return (
    <div className="flex h-72 w-full animate-pulse items-center justify-center rounded-2xl bg-canvas" aria-hidden="true">
      <div className="h-40 w-40 rounded-full bg-primary/[0.08]" />
    </div>
  );
}