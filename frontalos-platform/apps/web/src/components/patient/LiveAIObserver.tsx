"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, RadioTower, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { useObserverSocket, type ObserverMetrics } from "@/lib/websocket/useObserverSocket";

type PermissionState = "idle" | "requesting" | "granted" | "denied" | "unsupported";

interface LiveAIObserverProps {
  sessionId: string;
  onMetricsUpdate?: (metrics: ObserverMetrics) => void;
}

const CAPTURE_INTERVAL_MS = 150; // ~6-7 fps, matches the engine's suggested 5-10 fps
const CAPTURE_MAX_DIMENSION = 320; // downscale before JPEG-encoding to keep frames small

export function LiveAIObserver({ sessionId, onMetricsUpdate }: LiveAIObserverProps) {
  const [permission, setPermission] = useState<PermissionState>("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const { status, metrics, sendFrame } = useObserverSocket({
    sessionId,
    enabled: permission === "granted",
  });

  useEffect(() => {
    if (metrics) onMetricsUpdate?.(metrics);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics]);

  const requestCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPermission("unsupported");
      return;
    }
    setPermission("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPermission("granted");
    } catch {
      setPermission("denied");
    }
  }, []);

  // Frame capture loop: draws the current video frame to a hidden canvas,
  // downsamples, encodes JPEG, and streams it over the socket.
  useEffect(() => {
    if (permission !== "granted") return;

    captureTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const scale = Math.min(1, CAPTURE_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale) || CAPTURE_MAX_DIMENSION;
      canvas.height = Math.round(video.videoHeight * scale) || CAPTURE_MAX_DIMENSION;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      const base64 = dataUrl.split(",")[1];
      if (base64) sendFrame(base64);
    }, CAPTURE_INTERVAL_MS);

    return () => {
      if (captureTimerRef.current) clearInterval(captureTimerRef.current);
    };
  }, [permission, sendFrame]);

  // Stop all tracks on unmount so the camera light actually turns off.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const engagement = metrics?.engagement ?? 0;
  const boredom = metrics?.boredom ?? 0;
  const confusion = metrics?.confusion ?? 0;
  const focusScore = metrics?.focus_score ?? 0;
  const isDemo = metrics?.inference_mode === "demo";

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 pt-5 sm:px-6 sm:pt-6">
        <h3 className="font-display text-lg font-semibold text-primary-dark">Live AI Observer</h3>
        <div className="flex items-center gap-2">
          {isDemo && (
            <Badge tone="amber" className="normal-case tracking-normal">
              Demo mode
            </Badge>
          )}
          <ConnectionBadge status={status} />
        </div>
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-primary-dark">
          {permission === "granted" ? (
            <>
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-full w-full scale-x-[-1] object-cover"
              />
              <FaceTrackingBox engagement={engagement} reducedMotion={prefersReducedMotion} />
            </>
          ) : (
            <PermissionState state={permission} onRequest={requestCamera} />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {permission === "granted" && (
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="space-y-3">
              <MetricBar label="Engagement" value={engagement} colorVar="var(--color-secondary)" />
              <MetricBar label="Boredom" value={boredom} colorVar="var(--color-accent)" />
              <MetricBar label="Confusion" value={confusion} colorVar="var(--color-muted)" />
            </div>
            <FocusGauge score={focusScore} reducedMotion={prefersReducedMotion} />
          </div>
        )}
      </div>
    </Card>
  );
}

function ConnectionBadge({ status }: { status: string }) {
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-dark">
        <Wifi className="h-3.5 w-3.5 text-secondary" /> Live
      </span>
    );
  }
  if (status === "connecting" || status === "reconnecting") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
        <RadioTower className="h-3.5 w-3.5 animate-pulse-slow" /> Reconnecting…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
      <WifiOff className="h-3.5 w-3.5" /> Offline
    </span>
  );
}

function PermissionState({
  state,
  onRequest,
}: {
  state: PermissionState;
  onRequest: () => void;
}) {
  if (state === "denied") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <ShieldAlert className="h-8 w-8 text-accent" />
        <p className="text-sm font-medium text-white">Camera access was blocked</p>
        <p className="text-xs text-white/60">
          Your stats will still update from your tasks — turn on camera access in your browser
          settings any time to bring the Live Observer back.
        </p>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <ShieldAlert className="h-8 w-8 text-accent" />
        <p className="text-sm font-medium text-white">This device can&apos;t open the camera</p>
        <p className="text-xs text-white/60">Try again on a phone, tablet, or laptop with a webcam.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <Camera className="h-8 w-8 text-secondary" />
      <p className="text-sm font-medium text-white">Turn on the Live Observer?</p>
      <p className="text-xs text-white/60">It watches your focus while you work and never records.</p>
      <button
        onClick={onRequest}
        disabled={state === "requesting"}
        className="mt-1 inline-flex h-10 items-center justify-center rounded-full bg-secondary px-5 text-sm font-medium text-primary-dark transition-colors hover:bg-secondary/90 disabled:opacity-60"
      >
        {state === "requesting" ? "Requesting…" : "Turn On Camera"}
      </button>
    </div>
  );
}

function FaceTrackingBox({
  engagement,
  reducedMotion,
}: {
  engagement: number;
  reducedMotion: boolean;
}) {
  // No face-box coordinates come back from the engine (see
  // services/frontalos-engine — the WS payload is metrics-only), so this
  // is an honest UI simulation: a centered tracking box that tightens and
  // brightens with engagement, rather than a claim of real coordinates.
  const size = 46 - engagement * 10; // percent of frame width
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{ width: `${size}%`, height: `${size * 1.15}%`, transform: "translate(-50%, -50%)" }}
    >
      <motion.div
        className="h-full w-full rounded-2xl border-2"
        style={{ borderColor: "var(--color-secondary)" }}
        animate={
          reducedMotion
            ? { opacity: 0.6 + engagement * 0.4 }
            : { opacity: [0.5, 0.85, 0.5], scale: [1, 1.015, 1] }
        }
        transition={reducedMotion ? { duration: 0.3 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="absolute -left-0.5 -top-0.5 h-3 w-3 rounded-tl border-l-2 border-t-2 border-secondary" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-tr border-r-2 border-t-2 border-secondary" />
        <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-bl border-b-2 border-l-2 border-secondary" />
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-br border-b-2 border-r-2 border-secondary" />
      </motion.div>
    </div>
  );
}

function MetricBar({ label, value, colorVar }: { label: string; value: number; colorVar: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
        <span>{label}</span>
        <span className="tabular-nums text-primary-dark">{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-canvas">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: colorVar }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>
    </div>
  );
}

function FocusGauge({ score, reducedMotion }: { score: number; reducedMotion: boolean }) {
  const pct = Math.max(0, Math.min(10, score)) / 10;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative mx-auto h-28 w-28 sm:mx-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} strokeWidth="10" className="fill-none stroke-canvas" />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          strokeWidth="10"
          strokeLinecap="round"
          className="fill-none"
          style={{ stroke: "var(--color-secondary)" }}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={
            reducedMotion ? { duration: 0.3 } : { type: "spring", stiffness: 90, damping: 20 }
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-primary-dark">{score.toFixed(1)}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Focus / 10</span>
      </div>
    </div>
  );
}

// Re-exported so page.tsx and DopamineMenu can key off the same metrics
// shape without importing the hook directly.
export type { ObserverMetrics };
