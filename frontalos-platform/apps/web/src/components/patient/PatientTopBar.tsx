"use client";

import { motion } from "framer-motion";
import { Coins, Flame } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { usePrefersReducedMotion } from "@/lib/hooks";

interface PatientTopBarProps {
  firstName: string;
  level: number;
  levelTitle: string;
  dayStreak: number;
  coins: number;
  xpToday: number;
}

export function PatientTopBar({ firstName, level, levelTitle, dayStreak, coins, xpToday }: PatientTopBarProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  // Same 200-xp-per-level band levelForXp() already uses (lib/rewards/rewardWallet.ts) —
  // this is purely a visual read of that existing math, not a new rule.
  const xpIntoLevel = xpToday % 200;
  const xpProgressPct = Math.min(100, (xpIntoLevel / 200) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            {firstName.slice(0, 1).toUpperCase()}
            <span className="absolute -bottom-1 -right-1 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-primary-dark ring-2 ring-surface">
              {level}
            </span>
            {/* thin ring showing progress toward next level, reusing the exact
                200xp/level band from levelForXp() — no invented numbers */}
            <svg className="pointer-events-none absolute -inset-1 -rotate-90" viewBox="0 0 48 48" aria-hidden>
              <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(0,194,168,0.15)" strokeWidth="2" />
              <motion.circle
                cx="24"
                cy="24"
                r="22"
                fill="none"
                stroke="var(--color-secondary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 22}
                initial={false}
                animate={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - xpProgressPct / 100) }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-primary-dark sm:text-2xl">
              Hey {firstName} 👋 Ready to level up?
            </h1>
            <p className="text-xs font-medium text-muted">
              Level {level} &middot; {levelTitle}
            </p>
          </div>
        </div>

        <motion.div
          className="flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1.5"
          animate={
            prefersReducedMotion
              ? {}
              : { opacity: [1, 0.75, 1, 0.9, 1], scale: [1, 1.05, 1, 1.03, 1] }
          }
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Flame className="h-4 w-4 text-accent" />
          <span className="text-sm font-bold tabular-nums text-primary-dark">{dayStreak}</span>
        </motion.div>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-primary px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-accent" />
          <div>
            <AnimatedCounter value={coins} className="block text-base font-bold tabular-nums text-white" />
            <span className="text-[10px] uppercase tracking-wide text-white/50">Coin balance</span>
          </div>
        </div>
        <div className="text-right">
          <span className="block text-sm font-semibold text-white">{levelTitle}</span>
          <span className="text-[10px] uppercase tracking-wide text-white/50">{dayStreak}-day streak</span>
        </div>
      </div>
    </div>
  );
}
