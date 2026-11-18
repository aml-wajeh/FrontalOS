"use client";

import { motion } from "framer-motion";
import { ChevronDown, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { LinkedPatient } from "@/lib/api/parentClient";
import { cn } from "@/lib/utils";

interface ParentTopBarProps {
  patientName: string;
  patients: LinkedPatient[];
  selectedPatientId: number;
  onSelectPatient: (patientId: number) => void;
  /** Same real 7-day focus KPI already computed for the KPI strip below —
   * surfaced here too so the header itself carries one honest signal
   * instead of being purely decorative chrome. */
  focusTrendDeltaPct?: number | null;
}

export function ParentTopBar({
  patientName,
  patients,
  selectedPatientId,
  onSelectPatient,
  focusTrendDeltaPct,
}: ParentTopBarProps) {
  const isFlat = focusTrendDeltaPct === null || focusTrendDeltaPct === undefined || Math.abs(focusTrendDeltaPct) < 0.5;
  const isUp = typeof focusTrendDeltaPct === "number" && focusTrendDeltaPct > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/[0.06] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(16,23,42,0.04)] sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-secondary-light/60 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary-dark sm:text-3xl">Parent Command Center</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            30-day behavioral &amp; physiological overview for {patientName}.
            {typeof focusTrendDeltaPct === "number" && (
              <motion.span
                key={focusTrendDeltaPct}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary-dark",
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
                Focus {isUp ? "up" : isFlat ? "steady" : "down"} {Math.abs(focusTrendDeltaPct).toFixed(1)}%
              </motion.span>
            )}
          </p>
        </div>

        {patients.length > 1 && (
          <label className="relative inline-flex w-fit items-center">
            <span className="sr-only">Select child</span>
            <select
              value={selectedPatientId}
              onChange={(event) => onSelectPatient(Number(event.target.value))}
              className={cn(
                "appearance-none rounded-full border border-primary/10 bg-white py-2 pl-4 pr-9 text-sm font-semibold text-primary-dark",
                "shadow-[0_1px_2px_rgba(16,23,42,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              )}
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted" />
          </label>
        )}
      </div>
    </div>
  );
}
