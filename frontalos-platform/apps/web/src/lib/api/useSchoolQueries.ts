"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ApiError,
  getLinkedStudents,
  getProgressAnalytics,
  postClassroomObservation,
  toComposedChartData,
  type ClassroomObservationInput,
} from "./schoolClient";

function retryUnlessClientError(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

/** Class-level roster — see getLinkedStudents() for the documented 404-is-empty-roster fallback. */
export function useLinkedStudents() {
  return useQuery({
    queryKey: ["school", "linked-students"],
    queryFn: getLinkedStudents,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Read-only Focus trend for one student — reuses the exact analytics endpoint the Parent Portal charts. */
export function useStudentFocusTrend(patientId: number | null) {
  const query = useQuery({
    queryKey: ["school", patientId, "progress"],
    queryFn: () => getProgressAnalytics(patientId as number),
    enabled: patientId !== null,
    staleTime: 60_000,
    retry: retryUnlessClientError,
  });

  return {
    ...query,
    chartData: query.data ? toComposedChartData(query.data) : undefined,
  };
}

export function useSubmitClassroomObservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClassroomObservationInput) => postClassroomObservation(input),
    onSuccess: () => {
      toast.success("Observation submitted");
      queryClient.invalidateQueries({ queryKey: ["school", "linked-students"] });
    },
    onError: (error) => {
      const notMountedYet = error instanceof ApiError && error.status === 404;
      toast.error(
        notMountedYet ? "This endpoint isn't live yet" : "Couldn't submit observation",
        {
          description: notMountedYet
            ? "POST /api/v1/clinical/observations hasn't been added to services/cortix-api yet — this form is wired and ready for when it is."
            : error instanceof Error
              ? error.message
              : "Please try again.",
        }
      );
    },
  });
}
