"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, RefreshCw, Sparkles, WifiOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap, usePrefersReducedMotion } from "@/lib/hooks";
import { useGameMetricsMutation } from "@/lib/api/usePatientQueries";
import type { GameMetricsPayload } from "@/lib/api/patientClient";

interface DopamineActivity {
  id: string;
  title: string;
  emoji: string;
  coinReward: number;
  blurb: string;
}

const ACTIVITIES: DopamineActivity[] = [
  { id: "break-task-into-3", title: "Break Task Into 3", emoji: "🧩", coinReward: 15, blurb: "Split what's next into 3 tiny steps" },
  { id: "eye-game", title: "2-Min Eye Game", emoji: "👀", coinReward: 15, blurb: "Follow the dot to reset your focus" },
  { id: "box-breathing", title: "Box Breathing", emoji: "🌬️", coinReward: 20, blurb: "A calm 4-4-4-4 breathing pattern" },
  { id: "dance-reset", title: "60s Dance Reset", emoji: "💃", coinReward: 15, blurb: "Shake it out for one full minute" },
  { id: "stretch-reset", title: "30s Stretch", emoji: "🙆", coinReward: 15, blurb: "Reach up, roll your shoulders, let go" },
  { id: "gratitude-1", title: "Name One Win", emoji: "⭐", coinReward: 15, blurb: "Say one thing that went okay today" },
];

interface DopamineMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: number;
  autoTriggered?: boolean;
  onRewardEarned?: (coins: number) => void;
}

export function DopamineMenu({
  open,
  onOpenChange,
  patientId,
  autoTriggered,
  onRewardEarned,
}: DopamineMenuProps) {
  const [activeActivity, setActiveActivity] = useState<DopamineActivity | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [lastReward, setLastReward] = useState<number | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastPayload, setLastPayload] = useState<GameMetricsPayload | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const gameMetrics = useGameMetricsMutation();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open, () => onOpenChange(false));

  useEffect(() => {
    if (!open) {
      setActiveActivity(null);
      setLastReward(null);
    }
  }, [open]);

  const handleComplete = (activity: DopamineActivity, durationSeconds: number) => {
    const payload: GameMetricsPayload = {
      patient_id: patientId,
      game_name: activity.id,
      accuracy: 1,
      reaction_time: durationSeconds,
      mistakes: 0,
      breaks: 1,
      difficulty: "adaptive",
      session_duration: durationSeconds,
    };
    setLastPayload(payload);
    gameMetrics.mutate(payload);
    setLastReward(activity.coinReward);
    setBurstKey((k) => k + 1);
    setSessionCount((c) => c + 1);
    onRewardEarned?.(activity.coinReward);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(12);
    }
  };

  const retrySync = () => {
    if (lastPayload) gameMetrics.mutate(lastPayload);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-primary-dark/40 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Dopamine Menu — quick focus resets"
            tabIndex={-1}
            className="relative w-full max-w-md rounded-t-3xl bg-surface p-6 shadow-[0_-8px_40px_-12px_rgba(16,23,42,0.35)] sm:rounded-3xl focus:outline-none"
            initial={prefersReducedMotion ? { opacity: 0 } : { y: 60, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted transition-colors hover:bg-canvas hover:text-primary-dark"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                <h3 className="font-display text-xl font-semibold text-primary-dark">Dopamine Menu</h3>
              </div>
              {sessionCount > 0 && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-full bg-secondary-light px-2.5 py-1 text-[11px] font-semibold text-primary-dark"
                >
                  {sessionCount} reset{sessionCount > 1 ? "s" : ""} today
                </motion.span>
              )}
            </div>
            <p className="mb-5 text-sm text-muted">
              {autoTriggered
                ? "Looks like your focus dipped — pick a quick reset."
                : "Need a reset? Pick something quick."}
            </p>

            <AnimatePresence mode="wait">
              {activeActivity ? (
                <ActivityRunner
                  key={activeActivity.id}
                  activity={activeActivity}
                  onFinish={(seconds) => handleComplete(activeActivity, seconds)}
                  onExit={() => setActiveActivity(null)}
                  reducedMotion={prefersReducedMotion}
                />
              ) : (
                <motion.div
                  key="grid"
                  className="grid grid-cols-2 gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {ACTIVITIES.map((activity) => (
                    <ActivityCard key={activity.id} activity={activity} onStart={() => setActiveActivity(activity)} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {lastReward !== null && <CoinBurst key={burstKey} coins={lastReward} reducedMotion={prefersReducedMotion} />}

            <AnimatePresence>
              {gameMetrics.isError && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-danger-soft bg-danger-soft/60 px-3 py-2"
                >
                  <span className="flex items-center gap-1.5 text-xs text-danger">
                    <WifiOff className="h-3.5 w-3.5 shrink-0" />
                    Reward didn&apos;t sync — your reset still counts.
                  </span>
                  <button
                    onClick={retrySync}
                    disabled={gameMetrics.isPending}
                    className="flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/20 disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-3 w-3", gameMetrics.isPending && "animate-spin")} />
                    Retry
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ActivityCard({ activity, onStart }: { activity: DopamineActivity; onStart: () => void }) {
  return (
    <motion.button
      onClick={onStart}
      whileHover={{ y: -4, boxShadow: "0 16px 32px -16px rgba(16,23,42,0.25)" }}
      whileTap={{ scale: 0.97 }}
      className="flex flex-col items-start gap-2 rounded-2xl border border-primary/[0.06] bg-canvas p-4 text-left"
    >
      <span className="text-2xl">{activity.emoji}</span>
      <span className="text-sm font-semibold text-primary-dark">{activity.title}</span>
      <span className="text-xs text-muted">{activity.blurb}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary-dark">
        <Coins className="h-3.5 w-3.5 text-accent" /> +{activity.coinReward}
      </span>
    </motion.button>
  );
}

function ActivityRunner({
  activity,
  onFinish,
  onExit,
  reducedMotion,
}: {
  activity: DopamineActivity;
  onFinish: (durationSeconds: number) => void;
  onExit: () => void;
  reducedMotion: boolean;
}) {
  if (activity.id === "box-breathing") {
    return <BoxBreathingExercise onFinish={onFinish} onExit={onExit} reducedMotion={reducedMotion} />;
  }
  return <TimedResetExercise activity={activity} onFinish={onFinish} onExit={onExit} />;
}

const BREATH_PHASES = [
  { label: "Breathe In", seconds: 4, scale: 1.5 },
  { label: "Hold", seconds: 4, scale: 1.5 },
  { label: "Breathe Out", seconds: 4, scale: 1 },
  { label: "Hold", seconds: 4, scale: 1 },
] as const;
const BREATH_CYCLES = 3;

function BoxBreathingExercise({
  onFinish,
  onExit,
  reducedMotion,
}: {
  onFinish: (durationSeconds: number) => void;
  onExit: () => void;
  reducedMotion: boolean;
}) {
  const [cycle, setCycle] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(BREATH_PHASES[0].seconds);
  const totalSeconds = BREATH_PHASES.reduce((s, p) => s + p.seconds, 0) * BREATH_CYCLES;

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;

        setPhaseIndex((prevPhase) => {
          const nextPhase = (prevPhase + 1) % BREATH_PHASES.length;
          if (nextPhase === 0) {
            setCycle((prevCycle) => prevCycle + 1);
          }
          return nextPhase;
        });
        return 0; // placeholder, corrected by phase-change effect below
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    setSecondsLeft(BREATH_PHASES[phaseIndex].seconds);
  }, [phaseIndex]);

  useEffect(() => {
    if (cycle >= BREATH_CYCLES) {
      onFinish(totalSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle]);

  if (cycle >= BREATH_CYCLES) {
    return <CompletionState onExit={onExit} title="Nice breathing! 🌬️" />;
  }

  const phase = BREATH_PHASES[phaseIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-5 py-4"
    >
      <div className="relative flex h-40 w-40 items-center justify-center">
        <motion.div
          className="absolute h-24 w-24 rounded-full"
          style={{ background: "radial-gradient(circle, var(--color-secondary-light), var(--color-secondary))" }}
          animate={reducedMotion ? { scale: 1.15 } : { scale: phase.scale }}
          transition={{ duration: reducedMotion ? 0.2 : phase.seconds, ease: "easeInOut" }}
        />
        <div className="relative flex flex-col items-center">
          <span className="font-display text-lg font-semibold text-primary-dark">{phase.label}</span>
          <span className="text-2xl font-bold tabular-nums text-primary-dark">{secondsLeft}</span>
        </div>
      </div>
      <p className="text-xs text-muted">Cycle {cycle + 1} of {BREATH_CYCLES}</p>
      <button onClick={onExit} className="text-xs font-medium text-muted underline underline-offset-2">
        Exit early
      </button>
    </motion.div>
  );
}

function TimedResetExercise({
  activity,
  onFinish,
  onExit,
}: {
  activity: DopamineActivity;
  onFinish: (durationSeconds: number) => void;
  onExit: () => void;
}) {
  const durationSeconds = useMemo(() => {
    if (activity.id === "dance-reset") return 60;
    if (activity.id === "stretch-reset") return 30;
    if (activity.id === "gratitude-1") return 20;
    return 120;
  }, [activity.id]);
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    if (secondsLeft <= 0) {
      setDone(true);
      onFinish(durationSeconds);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, done]);

  const instructions: Record<string, string> = {
    "break-task-into-3": "Write (or say out loud) the next 3 small steps of your task.",
    "eye-game": "Follow your finger slowly left-right, then up-down, without moving your head.",
    "dance-reset": "Stand up and move to your favorite song for the full minute.",
    "stretch-reset": "Reach both arms up high, then roll your shoulders back slowly.",
    "gratitude-1": "Think of one small thing that went okay today — say it out loud.",
  };

  if (done) return <CompletionState onExit={onExit} title="Reset complete! ✨" />;

  const pct = 1 - secondsLeft / durationSeconds;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-4 py-4 text-center"
    >
      <span className="text-3xl">{activity.emoji}</span>
      <p className="max-w-xs text-sm text-primary-dark">{instructions[activity.id]}</p>
      <div className="h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-canvas">
        <motion.div
          className="h-full rounded-full bg-secondary"
          animate={{ width: `${pct * 100}%` }}
          transition={{ ease: "linear", duration: 1 }}
        />
      </div>
      <span className="text-xl font-bold tabular-nums text-primary-dark">{secondsLeft}s</span>
      <button onClick={onExit} className="text-xs font-medium text-muted underline underline-offset-2">
        Exit early
      </button>
    </motion.div>
  );
}

function CompletionState({ onExit, title }: { onExit: () => void; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-3 py-6 text-center"
    >
      <p className="font-display text-lg font-semibold text-primary-dark">{title}</p>
      <button
        onClick={onExit}
        className="inline-flex h-10 items-center justify-center rounded-full bg-secondary px-5 text-sm font-medium text-primary-dark hover:bg-secondary/90"
      >
        Back to menu
      </button>
    </motion.div>
  );
}

function CoinBurst({ coins, reducedMotion }: { coins: number; reducedMotion: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        angle: (i / 10) * Math.PI * 2,
        color: i % 2 === 0 ? "var(--color-secondary)" : "var(--color-accent)",
      })),
    []
  );

  if (reducedMotion) {
    return (
      <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
        <span className="rounded-full bg-secondary-light px-3 py-1 text-xs font-semibold text-primary-dark">
          +{coins} coins
        </span>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center">
      <div className="relative h-1 w-1">
        {particles.map((p, i) => (
          <motion.span
            key={i}
            className="absolute h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color }}
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: Math.cos(p.angle) * 60, y: Math.sin(p.angle) * 60 - 20, opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        ))}
        <motion.span
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -10 }}
          exit={{ opacity: 0 }}
          className={cn(
            "absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-soft px-3 py-1",
            "text-xs font-semibold text-primary-dark"
          )}
        >
          +{coins} coins 🪙
        </motion.span>
      </div>
    </div>
  );
}
