"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Award, Star, Target, Timer } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { cn } from "@/lib/utils";

interface StatCardsProps {
  xpToday: number;
  taskAccuracyPct: number;
  focusStreakMinutes: number;
  badgesUnlocked: number;
}

export function StatCards({ xpToday, taskAccuracyPct, focusStreakMinutes, badgesUnlocked }: StatCardsProps) {
  const cards = [
    { icon: <Star className="h-4 w-4" />, label: "XP Today", value: xpToday, tone: "secondary" as const },
    { icon: <Target className="h-4 w-4" />, label: "Task Accuracy", value: taskAccuracyPct, suffix: "%", tone: "accent" as const },
    { icon: <Timer className="h-4 w-4" />, label: "Focus Streak", value: focusStreakMinutes, suffix: "m", tone: "secondary" as const },
    { icon: <Award className="h-4 w-4" />, label: "Badges", value: badgesUnlocked, tone: "accent" as const },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
        >
          <StatCard icon={c.icon} label={c.label} value={c.value} suffix={c.suffix} tone={c.tone} />
        </motion.div>
      ))}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix = "",
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  suffix?: string;
  tone: "secondary" | "accent";
}) {
  return (
    <Card
      hover
      className={cn(
        "relative overflow-hidden p-3.5 transition-shadow duration-300 sm:p-4",
        tone === "secondary" ? "hover:shadow-[var(--glow-teal)]" : "hover:shadow-[var(--glow-amber)]"
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full blur-2xl",
          tone === "secondary" ? "bg-secondary/20" : "bg-accent/20"
        )}
      />
      <div
        className={cn(
          "relative mb-2 flex h-8 w-8 items-center justify-center rounded-xl",
          tone === "secondary" ? "bg-secondary-light text-secondary" : "bg-accent-soft text-accent"
        )}
      >
        {icon}
      </div>
      <AnimatedCounter
        value={value}
        suffix={suffix}
        className="relative block text-lg font-bold tabular-nums text-primary-dark"
      />
      <span className="relative text-[11px] font-medium text-muted">{label}</span>
    </Card>
  );
}
