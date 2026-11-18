import { usePrefersReducedMotion } from "@/lib/hooks";

/**
 * Static-composition, CSS-animated stand-in for FusionScene. Mirrors
 * HeroSceneFallback's pattern: used on small viewports and whenever
 * prefers-reduced-motion is set, so no three.js/WebGL cost is paid on
 * constrained devices.
 */
export function FusionSceneFallback() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animClass = prefersReducedMotion ? "" : "animate-float";

  return (
    <svg
      viewBox="0 0 400 300"
      className="h-full w-full"
      role="img"
      aria-label="Abstract illustration of two connected forms representing structural imaging and behavioral data fusing into one model"
    >
      <line x1="150" y1="150" x2="250" y2="150" stroke="#F4A261" strokeWidth="1.4" opacity="0.5" />

      <circle
        cx="150"
        cy="150"
        r="58"
        fill="none"
        stroke="#2C375C"
        strokeWidth="1.6"
        opacity="0.55"
        className={animClass}
      />
      <circle cx="150" cy="150" r="34" fill="#2C375C" opacity="0.12" />

      <g className={prefersReducedMotion ? "" : "animate-pulse-slow"}>
        <polygon
          points="250,96 292,124 292,176 250,204 208,176 208,124"
          fill="none"
          stroke="#00C2A8"
          strokeWidth="1.6"
          opacity="0.65"
        />
      </g>

      <circle cx="150" cy="150" r="4" fill="#00C2A8" />
      <circle cx="250" cy="150" r="4" fill="#00C2A8" />
    </svg>
  );
}
