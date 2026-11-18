"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePrefersReducedMotion, useMediaQuery, useHasMounted } from "@/lib/hooks";
import { PERSONA_THEME } from "@/lib/shell/personaConfig";
import type { Persona } from "@/lib/auth/session";
import { AmbientSceneFallback } from "./AmbientSceneFallback";

const AmbientScene = dynamic(() => import("./AmbientScene").then((mod) => mod.AmbientScene), {
  ssr: false,
});

const TEAL = "#00C2A8";
const AMBER = "#F4A261";
const NAVY_SOFT = "#2C375C";

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

/**
 * components/shared/AmbientBackdrop.tsx
 *
 * Mounted once by components/shell/AppShell.tsx, behind every portal's
 * <main>. Brings the "one connected platform" 3D language from the
 * marketing Hero (components/marketing/HeroScene.tsx) into the logged-in
 * experience, without overriding the persona motion levels already decided
 * in lib/shell/personaConfig.tsx:
 *
 *  - motion: "none"    (Doctor / School / Admin) -> always the static SVG
 *    fallback, no animation, no WebGL cost. These portals stay
 *    professional-calm on purpose; this only adds quiet depth, not motion.
 *  - motion: "subtle"  (Parent)  -> gentle WebGL drift when available.
 *  - motion: "playful" (Patient) -> slightly warmer/larger WebGL drift.
 *
 * Falls back to the same static SVG (instead of WebGL) whenever the
 * viewport is small, WebGL isn't supported, or the OS has
 * prefers-reduced-motion set — identical guard pattern to
 * components/marketing/Hero.tsx.
 *
 * Purely decorative: aria-hidden, pointer-events-none, absolutely
 * positioned behind real content, faded via a mask so it never competes
 * with dashboard data. Never touches auth/data/routing/state.
 */
export function AmbientBackdrop({ persona }: { persona: Persona }) {
  const theme = PERSONA_THEME[persona];
  const mounted = useHasMounted();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isSmallViewport = useMediaQuery("(max-width: 767px)");
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    setWebglOk(supportsWebGL());
  }, []);

  const secondaryColor = persona === "patient" ? AMBER : NAVY_SOFT;
  const canAnimate = theme.motion !== "none" && !prefersReducedMotion;
  const use3D = mounted && canAnimate && !isSmallViewport && webglOk;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{
        maskImage: "radial-gradient(65% 65% at 78% 15%, black, transparent 72%)",
        WebkitMaskImage: "radial-gradient(65% 65% at 78% 15%, black, transparent 72%)",
      }}
    >
      <div className="absolute -right-16 -top-16 h-[32rem] w-[32rem]">
        {use3D ? (
          <AmbientScene
            primaryColor={TEAL}
            secondaryColor={secondaryColor}
            intensity={theme.motion === "playful" ? "playful" : "subtle"}
          />
        ) : (
          <AmbientSceneFallback
            primaryColor={TEAL}
            secondaryColor={secondaryColor}
            animation={canAnimate ? "drift" : "static"}
          />
        )}
      </div>
    </div>
  );
}
