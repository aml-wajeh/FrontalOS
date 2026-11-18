"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registerSessionExpiredHandler } from "@/lib/api/httpClient";

/**
 * lib/shell/useSessionExpiry.ts
 *
 * Wires httpClient.ts's `registerSessionExpiredHandler` (fired when the
 * proxy route reports a 401 it could not resolve via silent refresh — see
 * app/api/proxy/[...path]/route.ts and lib/api/httpClient.ts headers) to
 * a real client-side logout: toast, POST /api/auth/logout to clear any
 * remaining cookies, then redirect to /login. Mounted once by AppShell so
 * every portal gets this without each page wiring it individually.
 */
export function useSessionExpiry() {
  const router = useRouter();

  useEffect(() => {
    registerSessionExpiredHandler(() => {
      toast.error("Your session has expired", {
        description: "Please sign in again to continue.",
      });
      fetch("/api/auth/logout", { method: "POST" }).finally(() => {
        router.replace("/login");
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
