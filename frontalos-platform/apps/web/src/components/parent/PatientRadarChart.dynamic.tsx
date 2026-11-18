"use client";

import dynamic from "next/dynamic";
import { ChartLoadingFallback } from "@/components/ui/ChartLoadingFallback";

export const PatientRadarChartDynamic = dynamic(
  () => import("./PatientRadarChart").then((mod) => mod.PatientRadarChart),
  { ssr: false, loading: () => <ChartLoadingFallback /> }
);
