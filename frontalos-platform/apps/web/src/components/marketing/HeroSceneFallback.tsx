import { usePrefersReducedMotion } from "@/lib/hooks";

const NODES = [
  { x: 200, y: 60, tone: "teal" },
  { x: 320, y: 130, tone: "amber" },
  { x: 340, y: 260, tone: "teal" },
  { x: 240, y: 340, tone: "amber" },
  { x: 120, y: 320, tone: "teal" },
  { x: 60, y: 200, tone: "amber" },
  { x: 100, y: 100, tone: "teal" },
] as const;

/**
 * Static-composition, CSS-animated stand-in for HeroScene. Used on small
 * viewports and whenever prefers-reduced-motion is set, so there is no
 * three.js/WebGL cost paid on constrained devices. `prefers-reduced-motion`
 * additionally strips the animation classes entirely (see globals.css).
 */
export function HeroSceneFallback() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animClass = prefersReducedMotion ? "" : "animate-float";

  return (
    <svg
      viewBox="0 0 400 400"
      className="h-full w-full"
      role="img"
      aria-label="Abstract animated illustration of connected neural nodes representing the FrontalOS platform"
    >
      <g stroke="#2C375C" strokeWidth="1.2" opacity="0.4">
        {NODES.map((node, i) => (
          <line key={i} x1="200" y1="200" x2={node.x} y2={node.y} />
        ))}
      </g>

      <circle cx="200" cy="200" r="52" fill="none" stroke="#00C2A8" strokeWidth="1.6" opacity="0.5" className={animClass} />
      <circle cx="200" cy="200" r="30" fill="none" stroke="#00C2A8" strokeWidth="1.2" opacity="0.35" />

      {NODES.map((node, i) => (
        <circle
          key={i}
          cx={node.x}
          cy={node.y}
          r={node.tone === "amber" ? 7 : 8}
          fill={node.tone === "amber" ? "#F4A261" : "#00C2A8"}
          className={prefersReducedMotion ? "" : "animate-pulse-slow"}
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      ))}
    </svg>
  );
}
