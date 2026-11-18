"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { PatientTopBar } from "@/components/patient/PatientTopBar";
import { StatCards } from "@/components/patient/StatCards";
import { LiveAIObserver } from "@/components/patient/LiveAIObserver";
import { DopamineMenu } from "@/components/patient/DopamineMenu";
import { DailyProgressChartDynamic } from "@/components/patient/DailyProgressChart.dynamic";
import { RewardWallet } from "@/components/patient/RewardWallet";
import { useRewardWallet } from "@/lib/rewards/rewardWallet";
import { useDailyProgress } from "@/lib/api/usePatientQueries";
import type { ObserverMetrics } from "@/lib/websocket/useObserverSocket";

// Auth/session wiring for the Patient Portal isn't part of this deliverable
// (see lib/api/patientClient.ts header) — this is the one placeholder
// value the rest of the page is built to make trivial to replace once a
// real session exists.
const PATIENT_ID = 1;
const PATIENT_FIRST_NAME = "Alex";

const BOREDOM_TRIGGER_THRESHOLD = 0.65;
const CONFUSION_TRIGGER_THRESHOLD = 0.65;
const TRIGGER_HOLD_MS = 6_000;

export default function PatientDashboardPage() {
  const [sessionId] = useState(() =>
    typeof window !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}`
  );

  const [dopamineOpen, setDopamineOpen] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const elevatedSinceRef = useRef<number | null>(null);
  const hasAutoOpenedForEpisodeRef = useRef(false);

  const {
    wallet,
    level,
    title: levelTitle,
    walletSyncing,
    walletError,
    retryWalletSync,
    markActiveToday,
    addCoins,
    addXp,
    recordFocusMinute,
    redeemReward,
  } = useRewardWallet(PATIENT_ID);

  const dailyProgress = useDailyProgress(PATIENT_ID);

  useEffect(() => {
    markActiveToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusMinuteTickRef = useRef(0);

  const handleMetricsUpdate = useCallback(
    (metrics: ObserverMetrics) => {
      // Auto-trigger the Dopamine Menu when boredom/confusion stays
      // elevated for TRIGGER_HOLD_MS, debounced so a single noisy frame
      // doesn't pop the drawer.
      const elevated = metrics.boredom >= BOREDOM_TRIGGER_THRESHOLD || metrics.confusion >= CONFUSION_TRIGGER_THRESHOLD;

      if (elevated) {
        if (elevatedSinceRef.current === null) {
          elevatedSinceRef.current = Date.now();
        } else if (
          !hasAutoOpenedForEpisodeRef.current &&
          Date.now() - elevatedSinceRef.current >= TRIGGER_HOLD_MS
        ) {
          hasAutoOpenedForEpisodeRef.current = true;
          setAutoTriggered(true);
          setDopamineOpen(true);
        }
      } else {
        elevatedSinceRef.current = null;
        hasAutoOpenedForEpisodeRef.current = false;
      }

      // Roughly one focus-streak minute credited per 60 engaged samples
      // (~1 sample per capture interval while engagement stays healthy).
      if (metrics.engagement >= 0.55) {
        focusMinuteTickRef.current += 1;
        if (focusMinuteTickRef.current >= 60) {
          focusMinuteTickRef.current = 0;
          recordFocusMinute();
        }
      }
    },
    [recordFocusMinute]
  );

  const handleRewardEarned = useCallback(
    (coins: number) => {
      addCoins(coins);
      addXp(coins);
    },
    [addCoins, addXp]
  );

  return (
    <AppShell persona="patient" title="My Focus Zone">
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
      <PatientTopBar
        firstName={PATIENT_FIRST_NAME}
        level={level}
        levelTitle={levelTitle}
        dayStreak={wallet.dayStreak}
        coins={wallet.coins}
        xpToday={wallet.xpToday}
      />

      <div className="mt-6">
        <StatCards
          xpToday={wallet.xpToday}
          taskAccuracyPct={wallet.taskAccuracyPct}
          focusStreakMinutes={wallet.focusStreakMinutes}
          badgesUnlocked={wallet.badgesUnlocked}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LiveAIObserver sessionId={sessionId} onMetricsUpdate={handleMetricsUpdate} />

        <div className="flex flex-col gap-4">
          <button
            onClick={() => {
              setAutoTriggered(false);
              setDopamineOpen(true);
            }}
            className="group flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/40 bg-secondary-light/40 p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-secondary/70 hover:bg-secondary-light hover:shadow-[var(--glow-teal)] active:translate-y-0"
          >
            <Sparkles className="h-7 w-7 text-secondary transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
            <span className="font-display text-base font-semibold text-primary-dark">Open Dopamine Menu</span>
            <span className="text-xs text-muted">Quick resets whenever you need one</span>
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DailyProgressChartDynamic
          data={dailyProgress.data}
          isLoading={dailyProgress.isLoading}
          isError={dailyProgress.isError}
        />
        <RewardWallet
          coins={wallet.coins}
          rewards={wallet.rewards}
          onRedeem={redeemReward}
          isSyncing={walletSyncing}
          isSyncError={walletError}
          onRetrySync={() => retryWalletSync()}
        />
      </div>

      <DopamineMenu
        open={dopamineOpen}
        onOpenChange={setDopamineOpen}
        patientId={PATIENT_ID}
        autoTriggered={autoTriggered}
        onRewardEarned={handleRewardEarned}
      />
    </div>
    </AppShell>
  );
}
