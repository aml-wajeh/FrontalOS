"use client";

import { SkeletonBlock } from "@/components/ui/DataState";

/**
 * Fallback shown by next/dynamic while a Recharts-heavy section's chunk is
 * still downloading. Recharts (+ d3 internals) is one of the heavier deps
 * in this bundle, so every chart section below is code-split out of the
 * initial route chunk via next/dynamic({ ssr: false }) — this is the
 * shared placeholder so the layout doesn't jump once the real chart mounts.
 */
export function ChartLoadingFallback({ tone = "light" }: { tone?: "light" | "dark" }) {
  return <SkeletonBlock height="h-64" tone={tone} className="w-full" />;
}
