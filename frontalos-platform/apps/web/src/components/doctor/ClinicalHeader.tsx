"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, CalendarCheck2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useProgressAnalytics } from "@/lib/api/useDoctorQueries";
import type { RosterEntry } from "@/lib/clinician/clinicianWorkspace";
import { cn } from "@/lib/utils";

interface ClinicalHeaderProps {
  doctorName: string;
  patient: RosterEntry | null;
}

const STATUS_META: Record<
  string,
  { label: string; icon: typeof TrendingUp; className: string }
> = {
  Improving: { label: "Improving", icon: TrendingUp, className: "text-secondary border-secondary/30 bg-secondary/10" },
  Declining: { label: "Declining", icon: TrendingDown, className: "text-accent border-accent/30 bg-accent/10" },
  Stable: { label: "Stable", icon: Minus, className: "text-white/70 border-white/15 bg-white/[0.06]" },
  insufficient_data: { label: "Not enough data yet", icon: Minus, className: "text-white/40 border-white/10 bg-white/[0.03]" },
};

export function ClinicalHeader({ doctorName, patient }: ClinicalHeaderProps) {
  const { data: analytics, isLoading } = useProgressAnalytics(patient?.patientId ?? null);

  const sparkData = useMemo(
    () => (analytics?.attention_trend ?? []).map((p) => ({ v: p.attention_score })),
    [analytics]
  );
  const latestScore = analytics?.attention_trend?.at(-1)?.attention_score;
  const statusKey = analytics?.overall_status ?? null;
  const status = statusKey ? STATUS_META[statusKey] ?? STATUS_META.Stable : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-primary-soft/60 via-primary/50 to-primary-dark/70 px-5 py-4 sm:px-6 sm:py-5">
      {/* faint radial glow, purely atmospheric — echoes the "focus" motif of the brand */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-secondary/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-secondary shadow-[0_0_10px_2px_rgba(0,194,168,0.6)]"
            aria-hidden
          />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Clinical Review</p>
            <h1 className="font-display text-xl font-semibold leading-tight text-white sm:text-2xl">
              Dr. {doctorName}
            </h1>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {patient ? (
            <motion.div
              key={patient.patientId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex flex-wrap items-center gap-3 sm:gap-4"
            >
              <div className="text-right">
                <p className="text-sm font-medium text-white">{patient.displayName}</p>
                <p className="text-[11px] text-white/40">
                  MRN CTX-{String(patient.patientId).padStart(4, "0")} · {patient.status}
                </p>
              </div>

              {/* real-data KPI chips — nothing here is fabricated: checkin_count and
                  overall_status come straight from /api/v1/analytics/progress */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
                  <CalendarCheck2 className="h-3.5 w-3.5 text-white/40" />
                  <span className="text-xs text-white/70">
                    {isLoading ? "…" : `${analytics?.checkin_count ?? 0} check-ins`}
                  </span>
                </div>

                {status && (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                      status.className
                    )}
                  >
                    <status.icon className="h-3.5 w-3.5" />
                    {status.label}
                  </div>
                )}

                {sparkData.length > 1 && (
                  <div className="flex h-8 w-20 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                        <defs>
                          <linearGradient id="headerSpark" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#00C2A8" stopOpacity={0.55} />
                            <stop offset="100%" stopColor="#00C2A8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="v"
                          stroke="#00C2A8"
                          strokeWidth={1.5}
                          fill="url(#headerSpark)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    {typeof latestScore === "number" && (
                      <span className="shrink-0 text-[10px] tabular-nums text-white/50">
                        {Math.round(latestScore)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-xs text-white/40"
            >
              <Activity className="h-3.5 w-3.5" />
              Select a patient from the roster to begin review.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
