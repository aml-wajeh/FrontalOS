"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { motion, useMotionTemplate, useSpring } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/**
 * components/ui/TiltCard.tsx
 *
 * Subtle mouse-driven 3D tilt + light-sheen wrapper. Used to give feature
 * cards / persona cards a "premium" physical feel on the marketing site
 * without touching clinical-portal chrome (those stay motion: "none" per
 * lib/shell/personaConfig.tsx and never use this component).
 *
 * Degrades to a plain static wrapper under prefers-reduced-motion or on
 * touch devices — this is a decorative enhancement, never required for
 * comprehension or interaction.
 */
export function TiltCard({
  children,
  className,
  maxTilt = 8,
}: {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const rotateX = useSpring(0, { stiffness: 220, damping: 20, mass: 0.6 });
  const rotateY = useSpring(0, { stiffness: 220, damping: 20, mass: 0.6 });
  const glowX = useSpring(50, { stiffness: 220, damping: 24 });
  const glowY = useSpring(50, { stiffness: 220, damping: 24 });
  const background = useMotionTemplate`radial-gradient(320px circle at ${glowX}% ${glowY}%, rgba(0,194,168,0.10), transparent 65%)`;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (prefersReducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * maxTilt * 2);
    rotateX.set(-(py - 0.5) * maxTilt * 2);
    glowX.set(px * 100);
    glowY.set(py * 100);
  }

  function handleMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
    glowX.set(50);
    glowY.set(50);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        prefersReducedMotion
          ? undefined
          : { rotateX, rotateY, transformPerspective: 900, transformStyle: "preserve-3d" }
      }
      className={cn("relative", className)}
    >
      {children}
      {!prefersReducedMotion && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ background }}
        />
      )}
    </motion.div>
  );
}
