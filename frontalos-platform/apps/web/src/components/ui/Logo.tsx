import Image from "next/image";
import { cn } from "@/lib/utils";
import { BRANDING } from "@/lib/branding";

interface LogoProps {
  /** "full" = mark + wordmark (default). "mark" = icon only, for tight spaces. */
  variant?: "full" | "mark";
  /** "light" for dark backgrounds (navbar-on-hero, dark footer). "dark" for light backgrounds. */
  theme?: "light" | "dark";
  className?: string;
  height?: number;
}

/**
 * Renders the FrontalOS logo across the app using the shared path constants
 * in src/lib/branding.ts (the actual single source of truth for the file
 * paths — see that file's docstring for why app/layout.tsx's <head> metadata
 * also imports from there instead of duplicating these paths). Swap the
 * files at /public/branding/ for final brand assets and both this component
 * and the root metadata pick them up automatically.
 */
export function Logo({ variant = "full", theme = "light", className, height = 32 }: LogoProps) {
  const src =
    variant === "mark" ? BRANDING.logoMark : theme === "dark" ? BRANDING.logoDark : BRANDING.logoFull;

  const width = variant === "mark" ? height : height * 4.2;

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src={src}
        alt="FrontalOS by Cortix"
        width={width}
        height={height}
        priority
        style={{ height, width: "auto" }}
      />
    </span>
  );
}