"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/hooks";

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const prefersReducedMotion = usePrefersReducedMotion();

  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 30, stiffness: 90 });

  useEffect(() => {
    if (!inView) return;
    motionValue.set(prefersReducedMotion ? value : value);
  }, [inView, value, motionValue, prefersReducedMotion]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      if (!ref.current) return;
      ref.current.textContent = `${prefix}${latest.toFixed(decimals)}${suffix}`;
    });
    return unsubscribe;
  }, [spring, prefix, suffix, decimals]);

  // Reduced motion: skip the tween entirely and render the final value.
  if (prefersReducedMotion) {
    return (
      <span className={className}>
        {prefix}
        {value.toFixed(decimals)}
        {suffix}
      </span>
    );
  }

  return (
    <span ref={ref} className={className}>
      {prefix}
      {(0).toFixed(decimals)}
      {suffix}
    </span>
  );
}
