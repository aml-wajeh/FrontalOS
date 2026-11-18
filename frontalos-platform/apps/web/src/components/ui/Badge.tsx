import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "teal" | "amber" | "navy";

const tones: Record<Tone, string> = {
  teal: "bg-secondary-light text-primary-dark",
  amber: "bg-accent-soft text-primary-dark",
  navy: "bg-primary/[0.06] text-primary",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "teal", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
