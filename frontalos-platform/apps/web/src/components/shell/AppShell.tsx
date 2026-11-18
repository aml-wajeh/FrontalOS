"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/auth/session";
import { PERSONA_THEME } from "@/lib/shell/personaConfig";
import { useSessionExpiry } from "@/lib/shell/useSessionExpiry";
import { AmbientBackdrop } from "@/components/shared/AmbientBackdrop";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * components/shell/AppShell.tsx
 *
 * The one shell component all four portals mount. It never hardcodes a
 * persona's colors/nav/motion itself — everything persona-specific comes
 * from lib/shell/personaConfig.ts, so adding a fifth persona later is a
 * config change here, not a new shell component.
 *
 * Also owns the friendly "wrong portal" toast: middleware.ts redirects a
 * signed-in user who opened someone else's portal back to their own
 * dashboard with `?unauthorized=1` rather than serving a raw 403. This
 * fires the toast once on mount and strips the param so refreshing/sharing
 * the link doesn't re-trigger it.
 */
export function AppShell({
  persona,
  title,
  children,
}: {
  persona: Persona;
  title?: string;
  children: React.ReactNode;
}) {
  const theme = PERSONA_THEME[persona];
  const router = useRouter();
  const searchParams = useSearchParams();
  useSessionExpiry();

  useEffect(() => {
    if (searchParams.get("unauthorized") === "1") {
      toast.error("You don't have access to that portal", {
        description: "We've brought you back to your own dashboard.",
      });
      const params = new URLSearchParams(searchParams.toString());
      params.delete("unauthorized");
      router.replace(params.toString() ? `?${params.toString()}` : window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={cn(
        "min-h-screen flex",
        // BUG FIX (staff audit follow-up): "admin" was added to
        // lib/shell/personaConfig.tsx with a dark navy chromeBg (matching
        // "doctor"), but this condition — written before the admin portal
        // existed — never included it, so the page background would have
        // stayed light canvas behind a dark sidebar/topbar the first time
        // this shell actually rendered for an admin.
        persona === "patient" || persona === "doctor" || persona === "admin" ? "bg-primary-dark" : "bg-canvas"
      )}
      data-motion={theme.motion}
    >
      <Sidebar persona={persona} />
      <div className="relative flex-1 flex flex-col min-w-0">
        <AmbientBackdrop persona={persona} />
        <Topbar persona={persona} title={title} />
        <main id="main-content" className="scroll-quiet relative z-10 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
