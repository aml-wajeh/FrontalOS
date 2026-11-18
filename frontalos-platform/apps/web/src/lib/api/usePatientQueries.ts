"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  getDailyProgress,
  getRewardWallet,
  postCheckin,
  postGameMetrics,
  spendRewardCoins,
  type CheckinPayload,
  type GameMetricsPayload,
  type SpendRewardPayload,
} from "./patientClient";

export function useDailyProgress(patientId: number) {
  return useQuery({
    queryKey: ["patient", patientId, "daily-progress"],
    queryFn: () => getDailyProgress(patientId),
    staleTime: 60_000,
    retry: (failureCount, error) => {
      // Don't burn retries on a 404/501 — that means the endpoint genuinely
      // isn't there yet, not a transient failure.
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 2;
    },
  });
}

export function useGameMetricsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GameMetricsPayload) => postGameMetrics(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["patient", variables.patient_id, "daily-progress"] });
      // A completed session also earns coins server-side (see games.py),
      // so the wallet balance is stale the moment this succeeds.
      queryClient.invalidateQueries({ queryKey: ["patient", variables.patient_id, "reward-wallet"] });
    },
  });
}

export function useCheckinMutation() {
  return useMutation({
    mutationFn: (payload: CheckinPayload) => postCheckin(payload),
  });
}

export function useRewardWalletBalance(patientId: number) {
  return useQuery({
    queryKey: ["patient", patientId, "reward-wallet"],
    queryFn: () => getRewardWallet(patientId),
    staleTime: 15_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 2;
    },
  });
}

export function useSpendRewardMutation(patientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SpendRewardPayload) => spendRewardCoins(patientId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["patient", patientId, "reward-wallet"], {
        patient_id: data.patient_id,
        balance: data.balance,
      });
    },
  });
}
