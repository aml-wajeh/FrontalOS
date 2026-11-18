import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a smooth hover lift + deeper shadow — opt-in so dense data-grid
   * cards (tables, roster rows) aren't forced to animate on hover. */
  hover?: boolean;
}

export function Card({ className, hover = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-primary/[0.06] bg-surface shadow-[0_1px_2px_rgba(16,23,42,0.04),0_20px_40px_-24px_rgba(16,23,42,0.15)]",
        hover &&
          "transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_1px_2px_rgba(16,23,42,0.04),0_32px_56px_-24px_rgba(16,23,42,0.22)]",
        className
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 sm:p-8", className)} {...props} />;
}
