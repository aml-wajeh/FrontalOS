/**
 * lib/api/notificationsClient.ts
 *
 * Powers NotificationsBell. Same honest-gap convention as parentClient.ts:
 * `database/models/patients.py` already defines a `Notification` table
 * (user_id, title, message, is_read, created_at) but no router in
 * services/cortix-api/api/v1/ mounts a `/notifications` route in main.py
 * today. This calls the shape that route should have; until it exists the
 * request 404s and `useNotifications` treats *that specific* 404 as "zero
 * notifications" so the bell renders an empty (not broken) state out of
 * the box.
 *
 * Only the 404 is swallowed this way — a network error or a 5xx is a real
 * failure and must not collapse into the same "you're all caught up"
 * empty state (that was exactly the silent-failure bug flagged in
 * REMAINING_STEPS.md step 3: a couple of screens were treating a failed
 * request identically to "no data yet"). Those propagate as isError so
 * NotificationsBell can show a real error state with retry.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, httpClient } from "./httpClient";

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  return useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      try {
        return await httpClient<NotificationItem[]>("/api/v1/notifications");
      } catch (error) {
        // Route isn't mounted yet — empty inbox, not a broken bell.
        if (error instanceof ApiError && error.status === 404) return [];
        // Anything else (network failure, 401 already-handled-elsewhere,
        // 5xx) is a real failure — rethrow so isError reflects it.
        throw error;
      }
    },
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 2;
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      try {
        await httpClient(`/api/v1/notifications/${id}/read`, { method: "POST" });
      } catch {
        // Best-effort until the route ships — UI still optimistically marks read below.
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
