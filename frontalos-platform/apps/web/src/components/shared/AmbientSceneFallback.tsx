import { cn } from "@/lib/utils";

interface AmbientSceneFallbackProps {
  primaryColor: string;
  secondaryColor: string;
  /** "static" = no animation at all (motion: "none" personas, and always
   * when prefers-reduced-motion is set). "drift" = the same very slow
   * CSS float already used by HeroSceneFallback, for "subtle"/"playful"
   * personas on small viewports or without WebGL. */
  animation: "static" | "drift";
}

/**
 * components/shared/AmbientSceneFallback.tsx
 *
 * Cheap, dependency-free stand-in for AmbientScene. Two circles is all it
 * is — this is deliberately quieter than HeroSceneFallback since it sits
 * behind real dashboard content, not a marketing hero.
 */
export function AmbientSceneFallback({ primaryColor, secondaryColor, animation }: AmbientSceneFallbackProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-full w-full"
      role="presentation"
      aria-hidden="true"
    >
      <circle
        cx="290"
        cy="110"
        r="90"
        fill="none"
        stroke={primaryColor}
        strokeWidth="1.4"
        opacity="0.22"
        className={cn(animation === "drift" && "animate-float")}
      />
      <circle cx="230" cy="230" r="46" fill={secondaryColor} opacity="0.08" />
      <circle
        cx="330"
        cy="250"
        r="16"
        fill={secondaryColor}
        opacity="0.28"
        className={cn(animation === "drift" && "animate-pulse-slow")}
      />
    </svg>
  );
}
