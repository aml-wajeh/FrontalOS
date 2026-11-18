"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Coins, Lock, RefreshCw, Sparkle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { SkeletonList } from "@/components/ui/DataState";
import type { RewardCatalogItem } from "@/lib/rewards/rewardWallet";
import { cn } from "@/lib/utils";

interface RewardWalletProps {
  coins: number;
  rewards: RewardCatalogItem[];
  onRedeem: (rewardId: string) => void;
  /** True only while the very first balance fetch is in flight (no local
   * cache and no server data yet) — see useRewardWallet.walletSyncing. */
  isSyncing?: boolean;
  /** True when the first-ever balance fetch failed outright — as opposed
   * to a later background refetch failing after we already have a
   * trustworthy last-known balance, which stays silent on purpose. */
  isSyncError?: boolean;
  onRetrySync?: () => void;
}

export function RewardWallet({
  coins,
  rewards,
  onRedeem,
  isSyncing = false,
  isSyncError = false,
  onRetrySync,
}: RewardWalletProps) {
  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-primary-dark">Reward Wallet</h3>
          {isSyncing ? (
            <div
              aria-hidden="true"
              className="h-7 w-16 animate-pulse rounded-full bg-canvas"
            />
          ) : isSyncError ? (
            <button
              type="button"
              onClick={onRetrySync}
              className="flex items-center gap-1.5 rounded-full bg-alert-bg px-3 py-1.5 text-xs font-semibold text-primary-dark"
              title="Couldn't load your balance — tap to retry"
            >
              <RefreshCw className="h-3.5 w-3.5 text-accent" />
              Retry
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5">
              <Coins className="h-4 w-4 text-accent" />
              <AnimatedCounter value={coins} className="text-sm font-bold tabular-nums text-primary-dark" />
            </div>
          )}
        </div>

        {isSyncing ? (
          <SkeletonList rows={3} />
        ) : (
          <div className="space-y-3">
            {rewards.map((reward) => (
              <RewardRow key={reward.id} reward={reward} coins={coins} onRedeem={() => onRedeem(reward.id)} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function RewardRow({
  reward,
  coins,
  onRedeem,
}: {
  reward: RewardCatalogItem;
  coins: number;
  onRedeem: () => void;
}) {
  const pct = Math.min(100, Math.round((coins / reward.coinCost) * 100));
  const unlocked = coins >= reward.coinCost;
  const wasUnlockedRef = useRef(unlocked);
  const [justUnlocked, setJustUnlocked] = useState(false);

  useEffect(() => {
    if (unlocked && !wasUnlockedRef.current) {
      setJustUnlocked(true);
      const t = setTimeout(() => setJustUnlocked(false), 900);
      return () => clearTimeout(t);
    }
    wasUnlockedRef.current = unlocked;
  }, [unlocked]);

  return (
    <motion.div
      animate={justUnlocked ? { scale: [1, 1.03, 1] } : {}}
      transition={{ duration: 0.6 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-3.5 transition-colors",
        unlocked ? "border-secondary/30 bg-secondary-light/60" : "border-primary/[0.06] bg-canvas"
      )}
    >
      {justUnlocked && (
        <motion.div
          className="pointer-events-none absolute inset-0"
          initial={{ boxShadow: "0 0 0 0 rgba(0,194,168,0.5)" }}
          animate={{ boxShadow: "0 0 0 14px rgba(0,194,168,0)" }}
          transition={{ duration: 0.8 }}
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{reward.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-primary-dark">{reward.title}</p>
            <p className="text-xs text-muted">{reward.coinCost} coins</p>
          </div>
        </div>
        {unlocked ? (
          <button
            onClick={onRedeem}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-primary-dark transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary/90 hover:shadow-[0_6px_16px_-6px_rgba(0,194,168,0.6)] active:translate-y-0"
          >
            <Sparkle className="h-3.5 w-3.5" /> Redeem
          </button>
        ) : (
          <Lock className="h-4 w-4 shrink-0 text-muted" />
        )}
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/70">
        <motion.div
          className="h-full rounded-full bg-secondary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>
    </motion.div>
  );
}
