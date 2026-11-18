"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { use3DCapable } from "@/lib/use3d";

const StatsFieldScene = dynamic(
  () => import("./StatsFieldScene").then((mod) => mod.StatsFieldScene),
  { ssr: false }
);

const STATS = [
  { value: 94, suffix: "%", label: "Families report calmer daily routines" },
  { value: 3, suffix: "", label: "Unified portals, one clinical backbone" },
  { value: 40, suffix: "+", label: "Behavioral & imaging signals fused per session" },
  { value: 12, suffix: "min", label: "Average time to a certified clinical report" },
] as const;

export function StatsBand() {
  const use3D = use3DCapable({ allowMobile: true });

  return (
    <section className="grain-overlay relative overflow-hidden bg-primary-dark py-20 sm:py-24">
      {use3D && (
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
          <StatsFieldScene />
        </div>
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 60% at 20% 20%, rgba(0,194,168,0.12), transparent 70%), radial-gradient(40% 50% at 85% 80%, rgba(244,162,97,0.08), transparent 70%)",
        }}
      />
      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-12 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="text-center lg:text-left"
          >
            <AnimatedCounter
              value={stat.value}
              suffix={stat.suffix}
              className="font-display text-4xl font-semibold text-white sm:text-5xl"
            />
            <p className="mt-2 text-sm leading-snug text-white/60">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
