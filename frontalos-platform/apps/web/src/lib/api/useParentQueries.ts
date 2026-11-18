"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ApiError,
  getForecast,
  getLinkedPatients,
  getProgressAnalytics,
  getRadar,
  type LinkedPatient,
} from "./parentClient";
import { getRewardWallet } from "./patientClient";

function retryUnlessClientError(failureCount: number, error: unknown) {
  // A 4xx means the endpoint genuinely doesn't have this yet (or the
  // patient id is wrong) — retrying won't fix that, so don't burn retries.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function useProgressAnalytics(patientId: number) {
  return useQuery({
    queryKey: ["parent", patientId, "progress"],
    queryFn: () => getProgressAnalytics(patientId),
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });
}

export function useForecast(patientId: number) {
  return useQuery({
    queryKey: ["parent", patientId, "forecast"],
    queryFn: () => getForecast(patientId),
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });
}

export function useRadar(patientId: number) {
  return useQuery({
    queryKey: ["parent", patientId, "radar"],
    queryFn: () => getRadar(patientId),
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });
}

/**
 * Same server-backed wallet endpoint the Patient Portal uses
 * (services/cortix-api/api/v1/rewards.py) — reused here rather than
 * duplicated, since a parent and their child reading the same patient's
 * balance should always see the same ledger total.
 */
export function useCoinBalance(patientId: number) {
  return useQuery({
    queryKey: ["patient", patientId, "reward-wallet"],
    queryFn: () => getRewardWallet(patientId),
    staleTime: 15_000,
    retry: retryUnlessClientError,
  });
}

/**
 * GET /api/v1/patients/me/children isn't mounted server-side yet (see
 * parentClient.ts header), so a 404 here is expected, not exceptional —
 * it's treated as "exactly one known child" rather than bubbling an error
 * up into the dashboard chrome. `fallbackPatient` is the one patient id
 * the rest of the app already knows about (the page-level default),
 * ensuring the switcher still renders something sane pre-launch.
 */
export function useLinkedPatients(fallbackPatient: LinkedPatient) {
  const query = useQuery({
    queryKey: ["parent", "linked-patients"],
    queryFn: () => getLinkedPatients(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const patients = useMemo<LinkedPatient[]>(() => {
    if (query.data && query.data.length > 0) return query.data;
    return [fallbackPatient];
  }, [query.data, fallbackPatient]);

  const routeNotMountedYet = query.isError && query.error instanceof ApiError && query.error.status === 404;

  return {
    patients,
    isLoading: query.isLoading,
    // A 404 isn't a "real" error for this hook's purposes — surface only
    // genuine failures (network, 5xx) to callers.
    isError: query.isError && !routeNotMountedYet,
  };
}