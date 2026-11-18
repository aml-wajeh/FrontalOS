"use client";

import dynamic from "next/dynamic";
import { ChartLoadingFallback } from "@/components/ui/ChartLoadingFallback";

export const BehavioralPanelDynamic = dynamic(
  () => import("./BehavioralPanel").then((mod) => mod.BehavioralPanel),
  { ssr: false, loading: () => <ChartLoadingFallback tone="dark" /> }
);
