"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ClipboardList, Info, Loader2, RotateCcw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { buildFeatureVectorFromBehavioral } from "@/lib/api/doctorClient";
import { useTabularPrediction } from "@/lib/api/useDoctorQueries";

interface BehavioralPanelProps {
  patientId: number;
}

type Severity = "normal" | "borderline" | "abnormal";

interface SdqField {
  key: "sdqEmotional" | "sdqConduct" | "sdqHyperactivity" | "sdqPeerProblems" | "sdqProsocial";
  label: string;
  short: string;
  /** Standard SDQ 3-band cutoffs (0-10 scale). `reverse` = higher score is healthier (Prosocial). */
  cutoffs: { borderline: number; abnormal: number };
  reverse?: boolean;
}

const SDQ_FIELDS: SdqField[] = [
  { key: "sdqEmotional", label: "Emotional Symptoms", short: "Emotional", cutoffs: { borderline: 5, abnormal: 6 } },
  { key: "sdqConduct", label: "Conduct Problems", short: "Conduct", cutoffs: { borderline: 4, abnormal: 5 } },
  {
    key: "sdqHyperactivity",
    label: "Hyperactivity/Inattention",
    short: "Hyperactivity",
    cutoffs: { borderline: 6, abnormal: 7 },
  },
  { key: "sdqPeerProblems", label: "Peer Problems", short: "Peer", cutoffs: { borderline: 3, abnormal: 4 } },
  {
    key: "sdqProsocial",
    label: "Prosocial Behavior",
    short: "Prosocial",
    cutoffs: { borderline: 5, abnormal: 4 },
    reverse: true,
  },
];

function sdqSeverity(field: SdqField, value: number): Severity {
  if (field.reverse) {
    if (value <= field.cutoffs.abnormal) return "abnormal";
    if (value <= field.cutoffs.borderline) return "borderline";
    return "normal";
  }
  if (value >= field.cutoffs.abnormal) return "abnormal";
  if (value >= field.cutoffs.borderline) return "borderline";
  return "normal";
}

const SEVERITY_STYLES: Record<Severity, { dot: string; text: string; label: string }> = {
  normal: { dot: "bg-secondary", text: "text-secondary", label: "Normal" },
  borderline: { dot: "bg-accent", text: "text-accent", label: "Borderline" },
  abnormal: { dot: "bg-danger-on-dark", text: "text-danger-on-dark", label: "Abnormal" },
};

interface ApqField {
  key: "apqInvolvement" | "apqPositiveParenting" | "apqPoorMonitoring" | "apqInconsistentDiscipline" | "apqCorporalPunishment";
  label: string;
}

const APQ_FIELDS: ApqField[] = [
  { key: "apqInvolvement", label: "Parental Involvement" },
  { key: "apqPositiveParenting", label: "Positive Parenting" },
  { key: "apqPoorMonitoring", label: "Poor Monitoring/Supervision" },
  { key: "apqInconsistentDiscipline", label: "Inconsistent Discipline" },
  { key: "apqCorporalPunishment", label: "Corporal Punishment" },
];

type Inputs = Record<SdqField["key"] | ApqField["key"], number>;

const DEFAULT_INPUTS: Inputs = {
  sdqEmotional: 3,
  sdqConduct: 2,
  sdqHyperactivity: 5,
  sdqPeerProblems: 2,
  sdqProsocial: 6,
  apqInvolvement: 60,
  apqPositiveParenting: 55,
  apqPoorMonitoring: 30,
  apqInconsistentDiscipline: 35,
  apqCorporalPunishment: 15,
};

export function BehavioralPanel({ patientId }: BehavioralPanelProps) {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const mutation = useTabularPrediction();

  const radarData = useMemo(
    () => SDQ_FIELDS.map((f) => ({ subscale: f.short, score: inputs[f.key], fullMark: 10 })),
    [inputs]
  );

  const apqData = useMemo(
    () => APQ_FIELDS.map((f) => ({ subscale: f.label.split(" ")[0], score: inputs[f.key] })),
    [inputs]
  );

  const flaggedCount = useMemo(
    () => SDQ_FIELDS.filter((f) => sdqSeverity(f, inputs[f.key]) !== "normal").length,
    [inputs]
  );

  const isDirty = useMemo(
    () => (Object.keys(DEFAULT_INPUTS) as (keyof Inputs)[]).some((k) => inputs[k] !== DEFAULT_INPUTS[k]),
    [inputs]
  );

  function setField(key: keyof Inputs, value: number) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function resetInputs() {
    setInputs(DEFAULT_INPUTS);
  }

  function runClassification() {
    const features = buildFeatureVectorFromBehavioral(inputs);
    mutation.mutate({ patientId, features });
  }

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-gradient-to-b from-primary/60 to-primary-dark/60 p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-white/80">
            <ClipboardList className="h-4 w-4 text-secondary" />
            Behavioral Module
          </h2>
          <p className="mt-1 text-[11px] text-white/40">SDQ (child symptoms) + APQ (parenting context) — scored live</p>
        </div>
        <div className="flex items-center gap-2">
          {flaggedCount > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent">
              {flaggedCount} subscale{flaggedCount > 1 ? "s" : ""} flagged
            </span>
          )}
          <button
            type="button"
            onClick={resetInputs}
            disabled={!isDirty}
            title="Reset to defaults"
            className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium text-white/50 transition-colors hover:border-white/25 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">SDQ Scores (0–10)</p>
          {SDQ_FIELDS.map((f) => {
            const severity = sdqSeverity(f, inputs[f.key]);
            const style = SEVERITY_STYLES[severity];
            return (
              <ScoreRow
                key={f.key}
                label={f.label}
                value={inputs[f.key]}
                max={10}
                onChange={(v) => setField(f.key, v)}
                accentVar={
                  severity === "abnormal"
                    ? "var(--color-danger-on-dark, #f87171)"
                    : severity === "borderline"
                      ? "var(--color-accent)"
                      : "var(--color-secondary)"
                }
                badge={
                  <span className={cn("flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide", style.text)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                    {style.label}
                  </span>
                }
              />
            );
          })}
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-black/10 p-1">
          <ResponsiveContainer width="100%" height={160}>
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="#ffffff" strokeOpacity={0.08} />
              <PolarAngleAxis dataKey="subscale" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.45)" }} />
              <Radar
                dataKey="score"
                stroke="var(--color-secondary)"
                fill="var(--color-secondary)"
                fillOpacity={0.28}
                strokeWidth={2}
                isAnimationActive
                animationDuration={450}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-primary-dark)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelStyle={{ color: "rgba(255,255,255,0.7)" }}
              />
            </RadarChart>
          </ResponsiveContainer>
          <span className="text-[9px] uppercase tracking-widest text-white/30">SDQ Profile</span>
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">APQ Percentiles</p>
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {APQ_FIELDS.map((f) => (
            <ScoreRow key={f.key} label={f.label} value={inputs[f.key]} max={100} onChange={(v) => setField(f.key, v)} />
          ))}
        </div>
      </div>

      <div className="h-32 w-full rounded-xl border border-white/5 bg-black/10 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={apqData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="#ffffff" strokeOpacity={0.06} vertical={false} />
            <XAxis dataKey="subscale" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "var(--color-primary-dark)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 11,
              }}
              labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            />
            <Bar dataKey="score" fill="var(--color-accent)" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={450} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <button
        onClick={runClassification}
        disabled={mutation.isPending}
        className="flex items-center justify-center gap-2 rounded-lg bg-secondary py-2.5 text-sm font-semibold text-primary-dark transition-all hover:bg-secondary/90 hover:shadow-[0_0_20px_rgba(0,194,168,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Run Combined AI Classification
      </button>

      <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-white/30">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        SDQ/APQ inputs are mapped to the model&apos;s 818-feature vector by tiling normalized scores — a stand-in for the
        offline connectome PCA pipeline, not real feature engineering. Treat the result as directional.
      </p>

      <AnimatePresence>
        {mutation.isError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-danger-on-dark/20 bg-danger-on-dark-bg px-3 py-2 text-xs text-danger-on-dark"
          >
            {mutation.error instanceof Error ? mutation.error.message : "Classification failed."}
          </motion.p>
        )}

        {mutation.data && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={cn(
              "space-y-2 rounded-xl border p-4",
              mutation.data.risk_level === "High"
                ? "border-accent/40 bg-accent/[0.08]"
                : "border-secondary/40 bg-secondary/[0.08]"
            )}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-sm font-semibold text-white">
                Combined Classification: {mutation.data.risk_level} Risk
              </p>
              {mutation.data.inference_mode === "demo" && (
                <span className="flex items-center gap-1 rounded-full border border-dashed border-accent/50 px-2 py-0.5 text-[10px] font-medium text-accent">
                  <AlertTriangle className="h-3 w-3" />
                  DEMO
                </span>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${mutation.data.probability * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={cn("h-full rounded-full", mutation.data.risk_level === "High" ? "bg-accent" : "bg-secondary")}
              />
            </div>
            <p className="text-xs text-white/60">
              Probability {(mutation.data.probability * 100).toFixed(1)}% · Confidence {(mutation.data.confidence * 100).toFixed(1)}%
            </p>
            {mutation.data.demo_note && <p className="text-[11px] leading-snug text-white/40">{mutation.data.demo_note}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ScoreRow({
  label,
  value,
  max,
  onChange,
  badge,
  accentVar = "var(--color-secondary)",
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  badge?: ReactNode;
  accentVar?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-[11px] text-white/60" title={label}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-1 flex-1 transition-[accent-color] duration-200"
        style={{ accentColor: accentVar }}
      />
      <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-white/70">{value}</span>
      <span className="w-16 shrink-0">{badge}</span>
    </div>
  );
}
