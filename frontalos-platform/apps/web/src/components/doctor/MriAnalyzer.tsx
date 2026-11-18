"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Brain, Loader2, UploadCloud } from "lucide-react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMriPrediction } from "@/lib/api/useDoctorQueries";
import { ErrorState, SkeletonBlock } from "@/components/ui/DataState";
import type { MriPredictionResponse } from "@/lib/api/doctorClient";

interface MriAnalyzerProps {
  patientId: number;
}

/** Three honest bands, not a gradient guess: low/mid read as calm teal,
 * only the clinically higher band pulls in the amber accent — keeps the
 * "no neons, 60/30/10" rule from the brand palette intact. */
function gaugeColor(pct: number) {
  if (pct >= 66) return "var(--color-accent)";
  if (pct >= 33) return "var(--color-text-muted, #6B7280)";
  return "var(--color-secondary)";
}

function ProbabilityGauge({ pct }: { pct: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const color = gaugeColor(pct);
  const motionPct = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  const offset = useTransform(motionPct, (v) => circumference * (1 - v / 100));

  useEffect(() => {
    const controls = animate(motionPct, pct, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct]);

  return (
    <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
      <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
        <circle cx="66" cy="66" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <motion.circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset, filter: `drop-shadow(0 0 8px ${color}66)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-3xl font-bold tabular-nums text-white">{display.toFixed(1)}%</span>
        <span className="text-[10px] uppercase tracking-widest text-white/40">ADHD Probability</span>
      </div>
    </div>
  );
}

/** Sweeping scan-line shown only while inference is actually in flight —
 * ties the wait to what's happening (a slice being analyzed) instead of a
 * generic spinner, without inventing progress percentages we don't have. */
function ScanningPreview() {
  return (
    <div className="relative flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <Brain className="h-10 w-10 text-white/15" />
      <motion.div
        aria-hidden
        className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-secondary/25 to-transparent"
        initial={{ top: "-10%" }}
        animate={{ top: "100%" }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

export function MriAnalyzer({ patientId }: MriAnalyzerProps) {
  const [dragOver, setDragOver] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [result, setResult] = useState<MriPredictionResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useMriPrediction();

  const runUpload = useCallback(
    (file: File) => {
      setResult(null);
      mutation.mutate(
        { patientId, file },
        {
          onSuccess: (data) => setResult(data),
        }
      );
    },
    [mutation, patientId]
  );

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) runUpload(file);
  }

  return (
    <section className="glass-dark flex flex-col gap-4 rounded-2xl border border-white/10 p-5 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-white/80">
          <Brain className="h-4 w-4 text-secondary" />
          Neuroimaging Module
        </h2>
        {result && (
          <label className="flex items-center gap-2 text-[11px] text-white/50">
            <span>Grad-CAM XAI Overlay</span>
            <button
              role="switch"
              aria-checked={showHeatmap}
              onClick={() => setShowHeatmap((v) => !v)}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                showHeatmap ? "bg-secondary" : "bg-white/15"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                  showHeatmap ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </label>
        )}
      </div>

      {result?.inference_mode === "demo" && (
        <div className="flex items-start gap-2 rounded-lg border border-dashed border-accent/50 bg-accent/[0.08] px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <div>
            <p className="text-xs font-semibold text-accent">DEMO DATA — no trained MRI model loaded</p>
            {result.demo_note && <p className="mt-0.5 text-[11px] leading-snug text-accent/80">{result.demo_note}</p>}
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 text-center transition-all duration-200",
          dragOver ? "scale-[1.01] border-secondary bg-secondary/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".dcm,.nii,.nii.gz,.png,.jpg,.jpeg,.bmp,.tif,.tiff"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) runUpload(file);
            e.target.value = "";
          }}
        />
        <UploadCloud className="h-6 w-6 text-white/30" />
        <p className="text-xs text-white/50">
          Drag &amp; drop a scan, or <span className="text-secondary">click to browse</span>
        </p>
        <p className="text-[10px] text-white/25">.dcm · .nii/.nii.gz · .png · .jpg</p>
      </div>

      {mutation.isPending && (
        <div className="flex flex-col items-center gap-3 py-4 sm:flex-row sm:items-start sm:gap-4">
          <ScanningPreview />
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin text-secondary" />
            Running inference on the uploaded scan…
          </div>
        </div>
      )}

      {mutation.isError && (
        <p className="rounded-lg border border-danger-on-dark/20 bg-danger-on-dark-bg px-3 py-2 text-xs text-danger-on-dark">
          {mutation.error instanceof Error ? mutation.error.message : "Scan analysis failed."}
        </p>
      )}

      {result && !mutation.isPending && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-4 sm:flex-row sm:items-start"
        >
          <div className="relative shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${showHeatmap ? result.heatmap_image_base64 : result.slice_image_base64}`}
              alt="MRI slice"
              className="h-40 w-40 object-cover"
            />
          </div>

          <ProbabilityGauge pct={result.adhd_probability_pct} />

          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Supporting Findings</p>
            <ul className="space-y-1">
              {result.findings.map((f, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 + i * 0.06 }}
                  className="text-xs leading-relaxed text-white/70"
                >
                  {f}
                </motion.li>
              ))}
            </ul>
            <p className="pt-1 text-[10px] text-white/30">{result.model} · prediction #{result.prediction_id}</p>
          </div>
        </motion.div>
      )}
    </section>
  );
}