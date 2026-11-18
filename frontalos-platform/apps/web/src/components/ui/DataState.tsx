"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface DataStateBaseProps {
  title: string;
  subtitle?: string;
  /** Tailwind height class controlling the block's min-height, e.g. "h-48".
   * Keeps the surrounding layout (card, grid row) from jumping between the
   * loading/empty/error/data states. */
  height?: string;
  icon?: ReactNode;
  className?: string;
  /** "light" (default) targets the Parent/Patient/School bg-canvas surfaces.
   * "dark" targets the Doctor Portal's navy chrome (bg-primary/bg-primary-dark
   * cards, white/60 text) so the same primitives read correctly there instead
   * of rendering dark-on-dark. */
  tone?: "light" | "dark";
}

/**
 * First-time-use / no-data-yet state. Distinct from ErrorState on purpose —
 * conflating "nothing here yet" with "the request failed" is exactly the
 * bug class step 3 in REMAINING_STEPS.md calls out (screens that were
 * treating a silent 401 as "empty").
 */
export function EmptyState({
  title,
  subtitle,
  height = "h-40",
  icon,
  className,
  tone = "light",
}: DataStateBaseProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 text-center",
        tone === "dark" ? "border-white/10 bg-white/[0.03]" : "border-primary/10 bg-canvas",
        height,
        className
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full",
          tone === "dark" ? "bg-white/[0.06] text-white/50" : "bg-secondary-light/60 text-secondary"
        )}
      >
        {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
      </div>
      <p className={cn("font-display text-sm font-semibold", tone === "dark" ? "text-white/80" : "text-primary-dark")}>
        {title}
      </p>
      {subtitle && (
        <p className={cn("max-w-xs text-xs", tone === "dark" ? "text-white/40" : "text-muted")}>{subtitle}</p>
      )}
    </div>
  );
}

interface ErrorStateProps extends DataStateBaseProps {
  onRetry?: () => void;
  /** Overrides the default generic message with something more specific —
   * pass ApiError.message here when it's safe to show the user. */
  retryLabel?: string;
}

/**
 * Request-failed state (network error, non-2xx, or an unrecoverable
 * session expiry that slipped through). Always offers a retry when the
 * caller can provide one — a dead end with only "an error occurred" is
 * what step 3 is meant to remove.
 */
export function ErrorState({
  title,
  subtitle,
  height = "h-40",
  icon,
  className,
  onRetry,
  retryLabel = "Try again",
  tone = "light",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 text-center",
        tone === "dark" ? "border-accent/30 bg-accent/[0.06]" : "border-accent/30 bg-accent-soft/60",
        height,
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
        {icon ?? <AlertTriangle className="h-5 w-5" aria-hidden="true" />}
      </div>
      <p className={cn("font-display text-sm font-semibold", tone === "dark" ? "text-white/80" : "text-primary-dark")}>
        {title}
      </p>
      {subtitle && (
        <p className={cn("max-w-xs text-xs", tone === "dark" ? "text-white/50" : "text-muted")}>{subtitle}</p>
      )}
      {onRetry && (
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={onRetry}
          className="mt-1 h-9 px-4 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

interface SkeletonBlockProps {
  height?: string;
  className?: string;
  tone?: "light" | "dark";
}

/** Generic skeleton block for loading states that don't need the
 * chart-bar shape (e.g. list rows, stat cards, wallet balance). Shaped
 * like the eventual content's bounding box rather than a bare spinner,
 * per the "loading = skeleton, not spinner-on-blank-screen" rule. */
export function SkeletonBlock({ height = "h-40", className, tone = "light" }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "w-full animate-pulse rounded-2xl",
        tone === "dark" ? "bg-white/[0.03]" : "bg-canvas",
        height,
        className
      )}
    />
  );
}

/** Skeleton for a row of stat/number cards (e.g. StatCards, KPI rows). */
export function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-primary/[0.06] bg-canvas p-4">
          <div className="mb-2 h-3 w-14 rounded bg-primary/[0.08]" />
          <div className="h-5 w-10 rounded bg-primary/[0.12]" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a short list of rows (notes, roster entries, notifications). */
export function SkeletonList({ rows = 3, tone = "light" }: { rows?: number; tone?: "light" | "dark" }) {
  return (
    <div aria-hidden="true" className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn("animate-pulse rounded-xl p-3", tone === "dark" ? "bg-white/[0.03]" : "bg-canvas")}
        >
          <div className={cn("mb-2 h-3 w-1/3 rounded", tone === "dark" ? "bg-white/10" : "bg-primary/[0.1]")} />
          <div className={cn("h-3 w-3/4 rounded", tone === "dark" ? "bg-white/[0.06]" : "bg-primary/[0.06]")} />
        </div>
      ))}
    </div>
  );
}