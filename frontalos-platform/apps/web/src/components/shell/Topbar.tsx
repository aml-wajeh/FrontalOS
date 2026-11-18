"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/auth/session";
import { PERSONA_THEME } from "@/lib/shell/personaConfig";
import { NotificationsBell } from "./NotificationsBell";
import { UserMenu } from "./UserMenu";

export function Topbar({ persona, title }: { persona: Persona; title?: string }) {
  const theme = PERSONA_THEME[persona];
  const router = useRouter();

  // No portal page has an in-app "back" affordance of its own (dashboards
  // are single-page-per-portal), so this is the one place users can step
  // back — to wherever they came from if the tab has history, otherwise to
  // the marketing home page.
  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-20 h-16 flex items-center justify-between px-4 sm:px-6 border-b backdrop-blur-xl",
        theme.chromeBg,
        persona === "patient" || persona === "doctor" || persona === "admin"
          ? "border-white/10"
          : "border-primary/[0.06]"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
            theme.chromeHoverBg,
            theme.chromeText
          )}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className={cn("font-display text-sm font-semibold sm:text-base truncate", theme.chromeText)}>
          {title ?? theme.portalName}
        </h2>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        <NotificationsBell chromeText={theme.chromeText} chromeHoverBg={theme.chromeHoverBg} />
        <UserMenu persona={persona} />
      </div>
    </header>
  );
}
