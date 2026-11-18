"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ScanFace, LineChart, ClipboardCheck } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const STEPS = [
  {
    icon: ScanFace,
    title: "Observe",
    description:
      "The Live AI Vision Observer and behavioral sensors quietly capture focus, engagement, and routine signals during real sessions.",
  },
  {
    icon: LineChart,
    title: "Understand",
    description:
      "MRI and behavioral-AI fusion turns raw signal into a forecasted trajectory — visible differently to the family and the clinician.",
  },
  {
    icon: ClipboardCheck,
    title: "Act",
    description:
      "Dopamine Menu adjustments, gentle family guidance, and certified clinical reports close the loop — for the child, the family, and the care team.",
  },
] as const;

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.75", "end 0.4"],
  });

  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="how-it-works" ref={sectionRef} className="bg-canvas py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From signal to certified care, in three steps"
          description="The same loop runs underneath all three portals — only the presentation changes."
        />

        <div className="relative mt-20">
          {/* Track (full width) */}
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-primary/10 md:block" aria-hidden />
          {/* Drawing progress line */}
          <motion.div
            style={{ scaleX: lineScale }}
            className="absolute left-0 right-0 top-7 hidden h-px origin-left bg-secondary md:block"
            aria-hidden
          />

          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="relative"
              >
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-dark text-white shadow-[0_12px_28px_-12px_rgba(16,23,42,0.5)]">
                  <step.icon size={24} aria-hidden />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary-dark">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold text-primary-dark">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
