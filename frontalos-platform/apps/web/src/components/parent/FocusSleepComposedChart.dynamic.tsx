"use client";

import dynamic from "next/dynamic";
import { ChartLoadingFallback } from "@/components/ui/ChartLoadingFallback";

/**
 * Code-split wrapper — see components/ui/ChartLoadingFallback.tsx. Import
 * this instead of FocusSleepComposedChart directly from any page/section
 * that isn't already behind its own dynamic boundary.
 */
export const FocusSleepComposedChartDynamic = dynamic(
  () => import("./FocusSleepComposedChart").then((mod) => mod.FocusSleepComposedChart),
  { ssr: false, loading: () => <ChartLoadingFallback /> }
);
