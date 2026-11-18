"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ApiError,
  deactivateUser,
  getAuditLog,
  getSystemHealth,
  getUsers,
  reactivateUser,
  setUserRole,
  type AdminAssignableRole,
} from "./adminClient";

function retryUnlessClientError(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: getUsers,
    staleTime: 30_000,
    retry: retryUnlessClientError,
  });
}

export function useAdminAuditLog(limit = 100) {
  return useQuery({
    queryKey: ["admin", "audit-log", limit],
    queryFn: () => getAuditLog(limit),
    staleTime: 15_000,
    retry: retryUnlessClientError,
  });
}

export function useAdminSystemHealth() {
  return useQuery({
    queryKey: ["admin", "system-health"],
    queryFn: getSystemHealth,
    staleTime: 10_000,
    // Best-effort dashboard even if one service is down — the endpoint
    // itself already reports per-service reachability rather than
    // throwing, so retries here just cover transport-level failures.
    retry: 1,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
}

export function useDeactivateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (userId: number) => deactivateUser(userId),
    onSuccess: () => {
      toast.success("User deactivated");
      invalidate();
    },
    onError: (error) => {
      toast.error("Couldn't deactivate user", {
        description: error instanceof Error ? error.message : undefined,
      });
    },
  });
}

export function useReactivateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (userId: number) => reactivateUser(userId),
    onSuccess: () => {
      toast.success("User reactivated");
      invalidate();
    },
    onError: (error) => {
      toast.error("Couldn't reactivate user", {
        description: error instanceof Error ? error.message : undefined,
      });
    },
  });
}

export function useSetUserRole() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: AdminAssignableRole }) => setUserRole(userId, role),
    onSuccess: () => {
      toast.success("Role updated");
      invalidate();
    },
    onError: (error) => {
      toast.error("Couldn't update role", {
        description: error instanceof Error ? error.message : undefined,
      });
    },
  });
}
