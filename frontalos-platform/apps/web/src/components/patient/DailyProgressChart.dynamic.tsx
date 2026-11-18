"use client";

import dynamic from "next/dynamic";
import { ChartLoadingFallback } from "@/components/ui/ChartLoadingFallback";

export const DailyProgressChartDynamic = dynamic(
  () => import("./DailyProgressChart").then((mod) => mod.DailyProgressChart),
  { ssr: false, loading: () => <ChartLoadingFallback /> }
);
