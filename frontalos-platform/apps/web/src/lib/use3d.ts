"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion, useMediaQuery, useHasMounted } from "@/lib/hooks";

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

/**
 * Central gate for every WebGL/three.js scene on the marketing site.
 *
 * A scene should only mount once we're on the client, the user hasn't
 * requested reduced motion, WebGL is actually available, and — unless the
 * caller opts in with `allowMobile` for a genuinely lightweight scene — the
 * viewport isn't a small/constrained device. Centralizing this avoids each
 * new 3D component re-implementing (and potentially drifting from) the same
 * accessibility/performance guard that HeroScene originally established.
 */
export function use3DCapable(options?: { allowMobile?: boolean }): boolean {
  const mounted = useHasMounted();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isSmallViewport = useMediaQuery("(max-width: 767px)");
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    setWebglOk(supportsWebGL());
  }, []);

  return mounted && !prefersReducedMotion && (Boolean(options?.allowMobile) || !isSmallViewport) && webglOk;
}
