"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Pill, Plus } from "lucide-react";
import { useProgressAnalytics } from "@/lib/api/useDoctorQueries";
import { EmptyState, ErrorState, SkeletonBlock } from "@/components/ui/DataState";
import type { MedicationDose } from "@/lib/clinician/clinicianWorkspace";
import { cn } from "@/lib/utils";

interface BehavioralSyncTimelineProps {
  patientId: number;
  doses: MedicationDose[];
  onAddDose: (dose: Omit<MedicationDose, "id">) => void;
}

const WIDTH = 900;
const HEIGHT = 140;
const GANTT_HEIGHT = 46;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const DAYS = 30;

const DOSE_COLORS = ["var(--color-secondary)", "var(--color-accent)", "var(--color-primary-soft)"];

export function BehavioralSyncTimeline({ patientId, doses, onAddDose }: BehavioralSyncTimelineProps) {
  const { data, isLoading, isError, refetch } = useProgressAnalytics(patientId);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [pinnedDay, setPinnedDay] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [showDoseForm, setShowDoseForm] = useState(false);

  const points = useMemo(() => {
    const trend = data?.attention_trend ?? [];
    const last30 = trend.slice(-DAYS);
    return last30.map((p, i) => ({
      day: i,
      date: p.date,
      score: Math.max(0, Math.min(100, p.attention_score)),
    }));
  }, [data]);

  const activeDay = pinnedDay ?? hoverDay;
  const activePoint = points.find((p) => p.day === activeDay) ?? null;
  const activeDoses = activeDay !== null ? doses.filter((d) => d.dayOffset === activeDay) : [];

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const dayWidth = plotWidth / Math.max(1, points.length - 1 || 1);
  const xFor = (day: number) => PAD_LEFT + (points.length > 1 ? day * (plotWidth / (points.length - 1)) : plotWidth / 2);
  const yFor = (score: number) => 10 + (1 - score / 100) * (HEIGHT - 24);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.day)} ${yFor(p.score)}`).join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${xFor(points[points.length - 1].day)} ${HEIGHT} L ${xFor(points[0].day)} ${HEIGHT} Z`
      : "";

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const dayFloat = ((relX - PAD_LEFT) / plotWidth) * (points.length - 1);
    const day = Math.max(0, Math.min(points.length - 1, Math.round(dayFloat)));
    setHoverDay(day);
  }

  return (
    <section className="col-span-full flex flex-col gap-4 rounded-2xl border border-white/10 bg-primary/50 p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-white/80">
          <Activity className="h-4 w-4 text-secondary" />
          Behavioral Sync Timeline
        </h2>
        <button
          onClick={() => setShowDoseForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/60 hover:border-secondary/40 hover:text-secondary"
        >
          <Plus className="h-3 w-3" />
          Add dose block
        </button>
      </div>

      {showDoseForm && (
        <AddDoseForm
          patientId={patientId}
          maxDay={Math.max(0, points.length - 1)}
          onAdd={(d) => {
            onAddDose(d);
            setShowDoseForm(false);
          }}
        />
      )}

      {isLoading && <SkeletonBlock height="h-40" tone="dark" />}

      {isError && !isLoading && (
        <ErrorState
          tone="dark"
          title="Couldn't load the attention trend"
          subtitle="Check your connection and try again."
          onRetry={() => refetch()}
          height="h-40"
        />
      )}

      {!isLoading && !isError && points.length === 0 && (
        <EmptyState
          tone="dark"
          title="No check-ins yet"
          subtitle="No check-in data in the last 30 days for this patient yet."
          height="h-32"
        />
      )}

      {!isLoading && points.length > 0 && (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full cursor-crosshair"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverDay(null)}
            onClick={() => setPinnedDay((d) => (d === hoverDay ? null : hoverDay))}
          >
            <defs>
              <linearGradient id="attnFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[0, 25, 50, 75, 100].map((g) => (
              <line key={g} x1={0} x2={WIDTH} y1={yFor(g)} y2={yFor(g)} stroke="#ffffff" strokeOpacity={0.05} />
            ))}

            {areaPath && (
              <motion.path
                d={areaPath}
                fill="url(#attnFill)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              />
            )}
            <motion.path
              d={linePath}
              fill="none"
              stroke="var(--color-secondary)"
              strokeWidth={2}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
              style={{ filter: "drop-shadow(0 0 4px rgba(0,194,168,0.35))" }}
            />

            {points.map((p, i) => (
              <motion.circle
                key={p.day}
                cx={xFor(p.day)}
                cy={yFor(p.score)}
                r={p.day === activeDay ? 4.5 : 2}
                fill={p.day === activeDay ? "var(--color-accent)" : "var(--color-secondary)"}
                className="transition-[r] duration-150"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.4 + Math.min(i, 30) * 0.015 }}
              />
            ))}

            {activeDay !== null && (
              <line
                x1={xFor(activeDay)}
                x2={xFor(activeDay)}
                y1={0}
                y2={HEIGHT}
                stroke="#ffffff"
                strokeOpacity={0.15}
                strokeDasharray="3 3"
              />
            )}
          </svg>

          {/* Gantt band */}
          <div className="relative mt-1 rounded-md bg-white/[0.03]" style={{ height: GANTT_HEIGHT }}>
            <svg viewBox={`0 0 ${WIDTH} ${GANTT_HEIGHT}`} className="absolute inset-0 h-full w-full">
              {doses
                .filter((d) => d.dayOffset < points.length)
                .map((d, i) => {
                  const x = xFor(d.dayOffset) - dayWidth / 2.2;
                  const w = Math.max(6, (dayWidth / 2.2) * 1.6);
                  const y = 8 + (d.startHour / 24) * (GANTT_HEIGHT - 16);
                  const h = Math.max(4, (d.durationHours / 24) * (GANTT_HEIGHT - 16));
                  const color = DOSE_COLORS[i % DOSE_COLORS.length];
                  const active = d.dayOffset === activeDay;
                  return (
                    <rect
                      key={d.id}
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx={2}
                      fill={color}
                      opacity={active ? 1 : 0.55}
                    />
                  );
                })}
            </svg>
          </div>
          <p className="mt-1 text-[10px] text-white/25">Attention trend (line) · Medication dose windows (band below)</p>

          {activePoint && (
            <div className="pointer-events-none absolute -top-1 left-0 w-full">
              <div
                className="pointer-events-auto absolute z-10 w-52 -translate-x-1/2 rounded-lg border border-white/10 bg-primary-dark/95 p-3 shadow-xl backdrop-blur"
                style={{ left: `${(xFor(activePoint.day) / WIDTH) * 100}%`, top: -8 }}
              >
                <p className="text-xs font-semibold text-white">
                  {new Date(activePoint.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
                <p className="mt-0.5 text-[11px] text-white/60">Attention score: {activePoint.score.toFixed(0)}</p>
                {activeDoses.length > 0 ? (
                  <ul className="mt-1.5 space-y-1 border-t border-white/10 pt-1.5">
                    {activeDoses.map((d) => (
                      <li key={d.id} className="flex items-center gap-1.5 text-[11px] text-white/60">
                        <Pill className="h-3 w-3 text-accent" />
                        {d.label} · {d.startHour}:00 ({d.durationHours}h)
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[11px] text-white/30">No dose logged this day</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AddDoseForm({
  patientId,
  maxDay,
  onAdd,
}: {
  patientId: number;
  maxDay: number;
  onAdd: (dose: Omit<MedicationDose, "id">) => void;
}) {
  const [label, setLabel] = useState("Methylphenidate 10mg");
  const [dayOffset, setDayOffset] = useState(Math.max(0, maxDay));
  const [startHour, setStartHour] = useState(8);
  const [durationHours, setDurationHours] = useState(4);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({ patientId, label, dayOffset, startHour, durationHours });
      }}
      className={cn("grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-primary/40 p-3 sm:grid-cols-4")}
    >
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Medication + dose"
        className="col-span-2 rounded-md border border-white/10 bg-primary-dark/60 px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 sm:col-span-1"
      />
      <input
        type="number"
        min={0}
        max={maxDay}
        value={dayOffset}
        onChange={(e) => setDayOffset(Number(e.target.value))}
        placeholder="Day (0-29)"
        className="rounded-md border border-white/10 bg-primary-dark/60 px-2.5 py-1.5 text-xs text-white"
      />
      <input
        type="number"
        min={0}
        max={23}
        value={startHour}
        onChange={(e) => setStartHour(Number(e.target.value))}
        placeholder="Start hour"
        className="rounded-md border border-white/10 bg-primary-dark/60 px-2.5 py-1.5 text-xs text-white"
      />
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          max={12}
          value={durationHours}
          onChange={(e) => setDurationHours(Number(e.target.value))}
          className="w-full rounded-md border border-white/10 bg-primary-dark/60 px-2.5 py-1.5 text-xs text-white"
        />
        <button type="submit" className="shrink-0 rounded-md bg-secondary px-3 text-xs font-semibold text-primary-dark">
          Add
        </button>
      </div>
    </form>
  );
}