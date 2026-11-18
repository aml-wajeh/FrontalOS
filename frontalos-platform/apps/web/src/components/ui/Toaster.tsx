"use client";

/**
 * components/ui/Toaster.tsx
 *
 * Single global toast host, using sonner. Mounted once in app/providers.tsx
 * so every portal and the (auth) forms share one instance — import `toast`
 * from "sonner" directly wherever you need to fire one, no context needed.
 * Styled off the same brand tokens as everything else (packages/design-
 * tokens), not sonner's default theme.
 */
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border !border-primary/[0.06] !bg-surface !text-ink !shadow-[0_20px_40px_-24px_rgba(16,23,42,0.25)]",
          title: "!font-semibold",
          description: "!text-muted",
          success: "!border-l-4 !border-l-secondary",
          error: "!border-l-4 !border-l-accent",
        },
      }}
    />
  );
}
