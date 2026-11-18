"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { usePrefersReducedMotion, useHasMounted } from "@/lib/hooks";
import { use3DCapable } from "@/lib/use3d";
import { HeroSceneFallback } from "./HeroSceneFallback";

const HeroScene = dynamic(() => import("./HeroScene").then((mod) => mod.HeroScene), {
  ssr: false,
});

export function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);
  const mounted = useHasMounted();
  const prefersReducedMotion = usePrefersReducedMotion();
  const use3D = use3DCapable();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      scrollProgressRef.current = latest;
    });
    return unsubscribe;
  }, [scrollYProgress]);

  const copyY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : 80]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section
      id="top"
      ref={sectionRef}
      className="grain-overlay relative flex min-h-[100svh] items-center overflow-hidden bg-primary-dark"
    >
      {/* Ambient gradient wash beneath the 3D/SVG scene */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 55% at 72% 38%, rgba(0,194,168,0.16), transparent 70%), radial-gradient(45% 40% at 15% 75%, rgba(244,162,97,0.10), transparent 70%)",
        }}
      />

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-4 pt-24 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:pt-20">
        <motion.div style={{ y: copyY, opacity: copyOpacity }} className="relative z-10 max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Badge tone="teal" className="bg-secondary/15 text-secondary">
              ADHD Digital Therapeutics
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 font-display text-4xl font-semibold leading-[1.05] text-white sm:text-5xl lg:text-[3.4rem]"
          >
            One platform,
            <br />
            three experiences.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-lg leading-relaxed text-white/70"
          >
            FrontalOS gives the child a world worth engaging with, the family a calm and
            clear picture of progress, and the clinician a decision-support tool built to
            clinical standards — unified by one connected platform.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.44, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <ButtonLink href="#personas" size="lg">
              Explore the three portals
              <ArrowRight size={18} aria-hidden />
            </ButtonLink>
            <ButtonLink href="#how-it-works" size="lg" variant="ghost" className="text-white">
              See how it works
            </ButtonLink>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-8 text-xs uppercase tracking-[0.18em] text-white/40"
          >
            A clinical decision-support tool — not a standalone diagnostic device
          </motion.p>
        </motion.div>

        <div
          className="relative z-0 mx-auto aspect-square w-full max-w-md lg:max-w-none"
          aria-hidden={false}
        >
          {mounted && use3D ? (
            <HeroScene scrollProgress={scrollProgressRef} />
          ) : (
            <HeroSceneFallback />
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-white/40 sm:flex"
      >
        <span className="text-[11px] uppercase tracking-[0.2em]">Scroll</span>
        <ChevronDown size={16} className={prefersReducedMotion ? "" : "animate-bounce"} aria-hidden />
      </motion.div>
    </section>
  );
}
