"use client";

/**
 * lib/rewards/rewardWallet.ts
 *
 * The Coin Balance / Day Streak / Level / Reward Wallet card's `coins`
 * field is now backed by services/cortix-api/api/v1/rewards.py — the
 * server ledger (SUM(RewardTransaction.amount)) is the source of truth,
 * fetched via useRewardWalletBalance and kept in sync here. Every other
 * field (XP, day streak, focus-streak minutes, task accuracy, badges,
 * reward catalog) still has no backing table anywhere in cortix-api, so
 * those stay a local, honest economy persisted to localStorage per
 * patient — reacting to real Dopamine Menu completions, not a random
 * number generator.
 *
 * `redeemReward` calls POST /rewards/wallet/{id}/spend instead of
 * decrementing localStorage directly, so a redemption only sticks once
 * the server has actually accepted it (and can't be spoofed by editing
 * localStorage, or double-spent across two open tabs).
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/httpClient";
import { useRewardWalletBalance, useSpendRewardMutation } from "@/lib/api/usePatientQueries";

export interface RewardCatalogItem {
  id: string;
  title: string;
  emoji: string;
  coinCost: number;
}

export interface WalletState {
  coins: number;
  xpToday: number;
  dayStreak: number;
  lastActiveDate: string; // yyyy-mm-dd
  taskAccuracyPct: number;
  focusStreakMinutes: number;
  badgesUnlocked: number;
  rewards: RewardCatalogItem[];
}

const DEFAULT_REWARDS: RewardCatalogItem[] = [
  { id: "movie-night", title: "Pick Movie Night", emoji: "🎬", coinCost: 150 },
  { id: "extra-screen", title: "30 Min Extra Screen Time", emoji: "📱", coinCost: 100 },
  { id: "ice-cream", title: "Ice Cream Trip", emoji: "🍦", coinCost: 200 },
  { id: "stay-up-late", title: "Stay Up 30 Min Late", emoji: "🌙", coinCost: 250 },
  { id: "new-sticker-pack", title: "New Sticker Pack", emoji: "✨", coinCost: 60 },
];

function defaultWallet(): WalletState {
  return {
    coins: 0,
    xpToday: 0,
    dayStreak: 0,
    lastActiveDate: "",
    taskAccuracyPct: 0,
    focusStreakMinutes: 0,
    badgesUnlocked: 0,
    rewards: DEFAULT_REWARDS,
  };
}

function storageKey(patientId: number) {
  return `frontalos_wallet_${patientId}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadWallet(patientId: number): WalletState {
  if (typeof window === "undefined") return defaultWallet();
  try {
    const raw = window.localStorage.getItem(storageKey(patientId));
    if (!raw) return defaultWallet();
    const parsed = JSON.parse(raw) as WalletState;
    const today = todayIso();
    if (parsed.lastActiveDate !== today) {
      // New day: streak bumps if yesterday was active, XP-today resets.
      const wasYesterday = isYesterday(parsed.lastActiveDate, today);
      return {
        ...parsed,
        xpToday: 0,
        dayStreak: wasYesterday ? parsed.dayStreak : parsed.lastActiveDate ? 0 : parsed.dayStreak,
        lastActiveDate: today,
      };
    }
    return parsed;
  } catch {
    return defaultWallet();
  }
}

function isYesterday(dateIso: string, todayIsoStr: string): boolean {
  if (!dateIso) return false;
  const d = new Date(dateIso);
  const today = new Date(todayIsoStr);
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  return diffDays === 1;
}

function saveWallet(patientId: number, wallet: WalletState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(patientId), JSON.stringify(wallet));
  } catch {
    // localStorage unavailable (private mode, quota) — fail silently, the
    // in-memory state for this session still works fine.
  }
}

export function levelForXp(totalXp: number): { level: number; title: string } {
  const level = Math.max(1, Math.floor(totalXp / 200) + 1);
  const titles = ["Rookie Explorer", "Focus Cadet", "Task Tamer", "Focus Ninja", "Attention Ace", "Mind Master"];
  const title = titles[Math.min(level - 1, titles.length - 1)];
  return { level, title };
}

export function useRewardWallet(patientId: number) {
  const [wallet, setWallet] = useState<WalletState>(() => defaultWallet());
  const [hydrated, setHydrated] = useState(false);

  // Server is the source of truth for `coins`; localStorage is only the
  // cache shown before the first successful fetch (or if the network is
  // down) so the UI never has to show a blank/zero balance.
  const walletQuery = useRewardWalletBalance(patientId);
  const spendMutation = useSpendRewardMutation(patientId);

  useEffect(() => {
    setWallet(loadWallet(patientId));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    if (!hydrated) return;
    saveWallet(patientId, wallet);
  }, [patientId, wallet, hydrated]);

  // Reconcile the locally-cached coin count with the authoritative server
  // balance every time a fetch/refetch succeeds.
  useEffect(() => {
    if (walletQuery.data === undefined) return;
    setWallet((prev) =>
      prev.coins === walletQuery.data.balance ? prev : { ...prev, coins: walletQuery.data.balance }
    );
  }, [walletQuery.data]);

  const markActiveToday = useCallback(() => {
    setWallet((prev) => {
      const today = todayIso();
      if (prev.lastActiveDate === today) return prev;
      const wasYesterday = isYesterday(prev.lastActiveDate, today);
      return {
        ...prev,
        lastActiveDate: today,
        dayStreak: wasYesterday ? prev.dayStreak + 1 : 1,
      };
    });
  }, []);

  const addCoins = useCallback((amount: number) => {
    setWallet((prev) => ({ ...prev, coins: Math.max(0, prev.coins + amount) }));
  }, []);

  const addXp = useCallback((amount: number) => {
    setWallet((prev) => ({ ...prev, xpToday: Math.max(0, prev.xpToday + amount) }));
  }, []);

  const recordFocusMinute = useCallback(() => {
    setWallet((prev) => ({ ...prev, focusStreakMinutes: prev.focusStreakMinutes + 1 }));
  }, []);

  const setTaskAccuracy = useCallback((pct: number) => {
    setWallet((prev) => ({ ...prev, taskAccuracyPct: Math.max(0, Math.min(100, pct)) }));
  }, []);

  const unlockBadge = useCallback(() => {
    setWallet((prev) => ({ ...prev, badgesUnlocked: prev.badgesUnlocked + 1 }));
  }, []);

  const redeemReward = useCallback(
    (rewardId: string) => {
      const reward = wallet.rewards.find((r) => r.id === rewardId);
      if (!reward) return;
      if (wallet.coins < reward.coinCost) {
        toast.error("Not enough coins yet — keep going!");
        return;
      }
      spendMutation.mutate(
        {
          amount: reward.coinCost,
          reason: "dopamine_menu_redeem",
          reference_type: "reward_catalog",
        },
        {
          onError: (error) => {
            const message =
              error instanceof ApiError && error.status === 400
                ? "Not enough coins yet — keep going!"
                : "Couldn't redeem that reward — check your connection and try again.";
            toast.error(message);
          },
        }
      );
    },
    [wallet.rewards, wallet.coins, spendMutation]
  );

  return {
    wallet,
    hydrated,
    // isLoading is only true on the very first fetch attempt with no
    // cached data yet — this is what should gate a skeleton, as opposed
    // to isFetching which would also flip true on every silent background
    // refetch and cause the coin badge to flicker every 15s (staleTime).
    walletSyncing: walletQuery.isLoading,
    walletSynced: walletQuery.isSuccess,
    // Only meaningful before the first successful sync — once we've had a
    // real server balance at least once, a later transient refetch failure
    // shouldn't alarm the user over their last-known-good local cache.
    walletError: walletQuery.isError && !walletQuery.isSuccess,
    retryWalletSync: walletQuery.refetch,
    ...levelForXp(wallet.xpToday),
    markActiveToday,
    addCoins,
    addXp,
    recordFocusMinute,
    setTaskAccuracy,
    unlockBadge,
    redeemReward,
  };
}
