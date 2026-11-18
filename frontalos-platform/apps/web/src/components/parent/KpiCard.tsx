"use client";

import type { ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { cn } from "@/lib/utils";

type Accent = "navy" | "teal" | "amber";

const accentBorder: Record<Accent, string> = {
  navy: "border-l-primary",
  teal: "border-l-secondary",
  amber: "border-l-accent",
};

const accentIconBg: Record<Accent, string> = {
  navy: "bg-primary/[0.08] text-primary",
  teal: "bg-secondary-light text-secondary",
  amber: "bg-accent-soft text-accent",
};

const accentGlow: Record<Accent, string> = {
  navy: "hover:shadow-[var(--glow-navy)]",
  teal: "hover:shadow-[var(--glow-teal)]",
  amber: "hover:shadow-[var(--glow-amber)]",
};

interface KpiCardProps {
  label: string;
  icon: ReactNode;
  accent: Accent;
  value: number | null;
  suffix?: string;
  decimals?: number;
  /** Percent (or percentage-point) change vs. the prior comparable window. Null hides the delta pill. */
  deltaPct?: number | null;
  isLoading?: boolean;
  unavailableReason?: string;
}

export function KpiCard({
  label,
  icon,
  accent,
  value,
  suffix = "",
  decimals = 0,
  deltaPct,
  isLoading,
  unavailableReason,
}: KpiCardProps) {
  return (
    <Card
      hover
      className={cn("border-l-4 transition-shadow duration-300", accentBorder[accent], accentGlow[accent])}
    >
      <CardBody className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl ring-4 ring-inset ring-white transition-transform duration-300",
              accentIconBg[accent]
            )}
          >
            {icon}
          </div>
          {typeof deltaPct === "number" && !isLoading && <DeltaPill deltaPct={deltaPct} />}
        </div>

        <div className="mt-3">
          {isLoading ? (
            <div className="h-7 w-20 animate-pulse rounded-md bg-primary/[0.08]" aria-hidden="true" />
          ) : value === null ? (
            <span className="block text-lg font-semibold text-muted" title={unavailableReason}>
              No data
            </span>
          ) : (
            <AnimatedCounter
              value={value}
              suffix={suffix}
              decimals={decimals}
              className="block text-2xl font-bold tabular-nums text-primary-dark"
            />
          )}
          <span className="mt-1 block text-xs font-medium text-muted">{label}</span>
          {value === null && !isLoading && unavailableReason && (
            <span className="mt-0.5 block text-[11px] text-muted/80">{unavailableReason}</span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function DeltaPill({ deltaPct }: { deltaPct: number }) {
  // Never harsh red — declines render in warm amber, improvements in teal.
  const isFlat = Math.abs(deltaPct) < 0.5;
  const isUp = deltaPct > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold tabular-nums text-primary-dark",
        isFlat ? "bg-primary/[0.06]" : isUp ? "bg-secondary-light" : "bg-accent-soft"
      )}
    >
      {isFlat ? (
        <Minus className="h-3 w-3" />
      ) : isUp ? (
        <TrendingUp className="h-3 w-3 text-secondary" />
      ) : (
        <TrendingDown className="h-3 w-3 text-accent" />
      )}
      {Math.abs(deltaPct).toFixed(1)}%
    </span>
  );
}
