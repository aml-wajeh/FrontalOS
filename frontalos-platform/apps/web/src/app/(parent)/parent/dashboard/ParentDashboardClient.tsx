"use client";

import { useState } from "react";
import { Coins, Gauge, Moon, Pill } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { ParentTopBar } from "@/components/parent/ParentTopBar";
import { KpiCard } from "@/components/parent/KpiCard";
import { FocusSleepComposedChartDynamic } from "@/components/parent/FocusSleepComposedChart.dynamic";
import { PatientRadarChartDynamic } from "@/components/parent/PatientRadarChart.dynamic";
import { ForecastCard } from "@/components/parent/ForecastCard";
import { WeeklyNotes } from "@/components/parent/WeeklyNotes";
import { useForecast, useCoinBalance, useLinkedPatients, useProgressAnalytics, useRadar } from "@/lib/api/useParentQueries";
import {
  coinBalanceKpi,
  focusScoreKpi,
  medicationAdherenceKpi,
  sleepQualityKpi,
  toComposedChartData,
  type LinkedPatient,
} from "@/lib/api/parentClient";

// Auth/session wiring for the Parent Portal isn't part of this deliverable
// (see lib/api/parentClient.ts header) — same placeholder pattern as the
// Patient Portal's PATIENT_ID, kept trivial to replace once a real
// parent session + /patients/me/children route exist.
const DEFAULT_PATIENT: LinkedPatient = { id: 1, name: "Alex", age: 9 };

export default function ParentDashboardPage() {
  const [selectedPatientId, setSelectedPatientId] = useState(DEFAULT_PATIENT.id);

  const { patients, isLoading: patientsLoading } = useLinkedPatients(DEFAULT_PATIENT);
  const activePatient =
    patients.find((p) => p.id === selectedPatientId) ?? patients[0] ?? DEFAULT_PATIENT;

  const progress = useProgressAnalytics(activePatient.id);
  const forecast = useForecast(activePatient.id);
  const radar = useRadar(activePatient.id);
  const coinWallet = useCoinBalance(activePatient.id);

  const chartData = progress.data ? toComposedChartData(progress.data) : undefined;

  const focusKpi = progress.data ? focusScoreKpi(progress.data) : null;
  const sleepKpi = radar.data ? sleepQualityKpi(radar.data) : null;
  const adherenceKpi = radar.data ? medicationAdherenceKpi(radar.data) : null;
  const coinsKpi = coinBalanceKpi(coinWallet.data?.balance);

  return (
    <AppShell persona="parent" title="Parent Command Center">
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
      <ParentTopBar
        patientName={activePatient.name}
        patients={patientsLoading ? [DEFAULT_PATIENT] : patients}
        selectedPatientId={activePatient.id}
        onSelectPatient={setSelectedPatientId}
        focusTrendDeltaPct={focusKpi?.deltaPct ?? null}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <KpiCard
          label="Focus Score (7d avg)"
          icon={<Gauge className="h-4 w-4" />}
          accent="teal"
          value={focusKpi?.value ?? null}
          decimals={1}
          suffix=" / 10"
          deltaPct={focusKpi?.deltaPct ?? null}
          isLoading={progress.isLoading}
          unavailableReason={focusKpi?.unavailableReason}
        />
        <KpiCard
          label="Sleep Quality (30d)"
          icon={<Moon className="h-4 w-4" />}
          accent="navy"
          value={sleepKpi?.value ?? null}
          decimals={0}
          suffix="%"
          deltaPct={sleepKpi?.deltaPct ?? null}
          isLoading={radar.isLoading}
          unavailableReason={sleepKpi?.unavailableReason}
        />
        <KpiCard
          label="Medication Adherence"
          icon={<Pill className="h-4 w-4" />}
          accent="amber"
          value={adherenceKpi?.value ?? null}
          decimals={0}
          suffix="%"
          deltaPct={adherenceKpi?.deltaPct ?? null}
          isLoading={radar.isLoading}
          unavailableReason={adherenceKpi?.unavailableReason}
        />
        <KpiCard
          label="Coin Balance"
          icon={<Coins className="h-4 w-4" />}
          accent="amber"
          value={coinsKpi.value}
          deltaPct={coinsKpi.deltaPct}
          isLoading={coinWallet.isLoading}
          unavailableReason={coinsKpi.unavailableReason}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <FocusSleepComposedChartDynamic
            data={chartData}
            isLoading={progress.isLoading}
            isError={progress.isError}
            onRetry={() => progress.refetch()}
          />
        </div>
        <div className="lg:col-span-2">
          <ForecastCard
            data={forecast.data}
            isLoading={forecast.isLoading}
            isError={forecast.isError}
            onRetry={() => forecast.refetch()}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PatientRadarChartDynamic
            data={radar.data}
            isLoading={radar.isLoading}
            isError={radar.isError}
            onRetry={() => radar.refetch()}
          />
        </div>
        <div className="lg:col-span-2">
          <WeeklyNotes
            progress={progress.data}
            radar={radar.data}
            isLoading={progress.isLoading}
            isError={progress.isError}
            onRetry={() => progress.refetch()}
          />
        </div>
      </div>
    </div>
    </AppShell>
  );
}