"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Brain, Activity, Sparkles as SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { use3DCapable } from "@/lib/use3d";
import { FusionSceneFallback } from "./FusionSceneFallback";

const FusionScene = dynamic(() => import("./FusionScene").then((mod) => mod.FusionScene), {
  ssr: false,
});

const SIGNALS = [
  {
    icon: Brain,
    label: "Structural imaging",
    detail: "MRI-derived features, normalized against age-matched cohorts.",
  },
  {
    icon: Activity,
    label: "Behavioral signal",
    detail: "Live AI vision observer, session telemetry, and routine data.",
  },
  {
    icon: SparklesIcon,
    label: "One fused model",
    detail: "A single trajectory the family sees calmly and the clinician sees precisely.",
  },
] as const;

/**
 * Centerpiece 3D section illustrating the platform's core clinical claim —
 * structural imaging and behavioral-AI signal fused into one model. Sits
 * between FeatureGrid and StatsBand, giving the "MRI + Behavioral AI
 * Fusion" feature its own dedicated, visually led moment rather than a
 * single grid tile.
 */
export function FusionSection() {
  const use3D = use3DCapable();

  return (
    <section className="grain-overlay relative overflow-hidden bg-primary-dark py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 55% at 50% 45%, rgba(0,194,168,0.10), transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <Badge tone="teal" className="bg-secondary/15 text-secondary">
            The clinical core
          </Badge>
          <h2 className="mt-6 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
            Two signals.
            <br />
            One fused trajectory.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/65">
            FrontalOS doesn&apos;t treat imaging and behavior as separate reports living in
            separate tabs. Structural MRI features and real-time behavioral-AI signal are
            fused into a single model — the same underlying trajectory, rendered calmly for
            the family and with clinical precision for the doctor.
          </p>

          <ul className="mt-9 space-y-5">
            {SIGNALS.map((signal, i) => (
              <motion.li
                key={signal.label}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="flex items-start gap-4"
              >
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-secondary">
                  <signal.icon size={18} aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{signal.label}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/55">{signal.detail}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto aspect-square w-full max-w-md lg:max-w-none"
        >
          {use3D ? <FusionScene /> : <FusionSceneFallback />}
        </motion.div>
      </div>
    </section>
  );
}
