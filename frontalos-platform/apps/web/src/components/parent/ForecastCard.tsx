"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { usePrefersReducedMotion } from "@/lib/hooks";
import type { ForecastResponse } from "@/lib/api/parentClient";

interface ForecastCardProps {
  data: ForecastResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

export function ForecastCard({ data, isLoading, isError, onRetry }: ForecastCardProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary-dark via-primary to-primary-soft text-white">
      {/* Ambient glow — calm, slow pulse. Disabled entirely under reduced-motion. */}
      {!prefersReducedMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-secondary/30 blur-3xl"
          animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="relative p-6 sm:p-8">
        <div className="flex items-center gap-2 text-white/70">
          <Sparkles className="h-4 w-4 text-secondary" />
          <span className="text-xs font-semibold uppercase tracking-wide">AI Predictive Forecast</span>
        </div>

        {isLoading && <ForecastSkeleton />}

        {isError && !isLoading && (
          <div className="mt-4">
            <p className="text-sm font-medium text-white">Couldn&apos;t load the forecast</p>
            <p className="mt-1 text-xs text-white/60">Check your connection and try again in a bit.</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {!isLoading && !isError && data && data.status === "ok" && (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-5xl font-bold tabular-nums text-secondary sm:text-6xl">
                {data.predicted_next_day_focus_score?.toFixed(0)}
              </span>
              <span className="text-sm font-medium text-white/60">/ 100 predicted next-day focus</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="block text-[11px] uppercase tracking-wide text-white/50">Confidence</span>
                <span className="font-semibold text-white">{data.confidence_pct?.toFixed(0)}%</span>
              </div>
              <div>
                <span className="block text-[11px] uppercase tracking-wide text-white/50">Key driver</span>
                <span className="font-semibold capitalize text-white">{data.top_contributing_feature}</span>
              </div>
            </div>

            <p className="mt-5 rounded-2xl bg-white/[0.06] p-3.5 text-xs leading-relaxed text-white/80">
              {recommendationFor(data)}
            </p>
          </>
        )}

        {!isLoading && !isError && data && data.status === "insufficient_data" && (
          <div className="mt-4">
            <p className="text-sm font-medium text-white">Not enough check-ins yet</p>
            <p className="mt-1 text-xs text-white/60">{data.message ?? "A forecast needs a few more recent check-ins."}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Plain-language recommendation, composed client-side from the forecast's
 * real fields (predicted score, confidence, driver) — not a separate LLM
 * call. Kept as a pure function of the response so the copy always matches
 * the numbers shown above it.
 */
function recommendationFor(data: ForecastResponse): string {
  const score = data.predicted_next_day_focus_score ?? 0;
  const driver = data.top_contributing_feature ?? "recent trend";
  const confidence = data.confidence_pct ?? 0;

  const trendPhrase =
    score >= 70
      ? "Tomorrow is trending strong."
      : score >= 45
        ? "Tomorrow looks fairly typical."
        : "Tomorrow may be a lower-focus day.";

  const driverPhrase = driver === "sleep duration" ? "Sleep is the biggest lever right now — protecting bedtime tonight could help." : "Recent momentum is the biggest driver right now — keep today's routine steady.";

  const confidencePhrase =
    confidence < 40
      ? " This estimate is still low-confidence with limited recent data, so treat it as a rough guide."
      : "";

  return `${trendPhrase} ${driverPhrase}${confidencePhrase}`;
}

function ForecastSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-3" aria-hidden="true">
      <div className="h-12 w-32 rounded-lg bg-white/10" />
      <div className="h-4 w-48 rounded bg-white/10" />
      <div className="h-16 w-full rounded-2xl bg-white/[0.06]" />
    </div>
  );
}