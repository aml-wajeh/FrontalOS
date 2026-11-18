"use client";

/**
 * app/error.tsx — root error boundary.
 *
 * Next.js renders this instead of a blank/default crash screen whenever a
 * render-time exception escapes a page or one of its (non-isolated) child
 * components anywhere under the root layout. This is a defense-in-depth
 * layer: known request-failure states (loading/empty/error) are already
 * handled per-component via components/ui/DataState.tsx + react-query's
 * isLoading/isError, so this only fires for genuinely unexpected bugs —
 * but without it, that class of bug previously produced a raw, unstyled
 * Next.js error page (a "white screen" from the user's perspective).
 */
import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface it in the console/telemetry pipeline; never shown to the user.
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="mt-4 font-display text-xl font-semibold text-primary-dark">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        We hit an unexpected error loading this page. Your data is safe — try again, or head back home.
      </p>
      <div className="mt-6 flex gap-3">
        <Button type="button" variant="primary" size="md" onClick={reset}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={() => (window.location.href = "/")}>
          <Home className="h-4 w-4" aria-hidden="true" />
          Go home
        </Button>
      </div>
    </main>
  );
}
