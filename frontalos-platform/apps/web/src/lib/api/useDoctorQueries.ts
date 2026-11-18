"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  downloadCertifiedReport,
  getCurrentUser,
  getMyPatients,
  getProgressAnalytics,
  predictMri,
  predictTabular,
  type RosterPatient,
} from "./doctorClient";

function retryUnlessClientError(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

/** Backs the whole (doctor) route group's role gate — see doctorClient.ts header. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["doctor", "me"],
    queryFn: getCurrentUser,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * GET /api/v1/patients isn't mounted server-side yet (see doctorClient.ts
 * header), so a 404 here is expected — the sidebar treats it as "no roster
 * endpoint yet" and falls back to the clinician-managed local roster rather
 * than surfacing a hard error.
 */
export function useMyPatients() {
  const query = useQuery({
    queryKey: ["doctor", "patients"],
    queryFn: getMyPatients,
    staleTime: 60_000,
    retry: false,
  });

  const routeNotMountedYet = query.isError && query.error instanceof ApiError && query.error.status === 404;

  return {
    patients: (query.data ?? []) as RosterPatient[],
    isLoading: query.isLoading,
    isError: query.isError && !routeNotMountedYet,
    routeNotMountedYet,
    refetch: query.refetch,
  };
}

export function useProgressAnalytics(patientId: number | null) {
  return useQuery({
    queryKey: ["doctor", patientId, "progress"],
    queryFn: () => getProgressAnalytics(patientId as number),
    enabled: patientId !== null,
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });
}

export function useTabularPrediction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, features }: { patientId: number; features: number[] }) =>
      predictTabular(patientId, features),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["doctor", variables.patientId] });
    },
  });
}

export function useMriPrediction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, file }: { patientId: number; file: File }) => predictMri(patientId, file),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["doctor", variables.patientId] });
    },
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: async (patientId: number) => {
      const { blob, filename } = await downloadCertifiedReport(patientId);
      // Real browser download of the returned file — no fake anchor href,
      // the bytes actually came from the streamed PDF response.
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      return filename;
    },
  });
}
