"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Gamepad2, HeartHandshake, Stethoscope, ArrowUpRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TiltCard } from "@/components/ui/TiltCard";
import { use3DCapable } from "@/lib/use3d";
import { cn } from "@/lib/utils";

const PersonaOrb = dynamic(() => import("./PersonaOrb").then((mod) => mod.PersonaOrb), {
  ssr: false,
});

const PERSONAS = [
  {
    id: "patient",
    icon: Gamepad2,
    name: "Patient Portal",
    tagline: "Gamified, for the child",
    description:
      "Bright quests, a Dopamine Menu of bite-size wins, and a live AI vision observer that turns focus itself into a game worth playing.",
    preview: {
      bg: "linear-gradient(155deg, #1B2340 0%, #00C2A8 140%)",
      chips: ["Level 7", "Focus streak", "Reward: +40"],
      light: false,
      orbColor: "#00C2A8",
    },
  },
  {
    id: "parent",
    icon: HeartHandshake,
    name: "Parent Portal",
    tagline: "Calm and analytical, for the family",
    description:
      "A clear, low-stress view of trends over time — sleep, screen time, and focus — with gentle guidance instead of overwhelming charts.",
    preview: {
      bg: "linear-gradient(155deg, #F5F7FB 0%, #E6F9F6 100%)",
      chips: ["This week +12%", "Sleep on track", "Note from Dr. Lee"],
      light: true,
      orbColor: "#F4A261",
    },
  },
  {
    id: "doctor",
    icon: Stethoscope,
    name: "Clinician Portal",
    tagline: "Strict clinical dark mode, for the doctor",
    description:
      "MRI and behavioral-AI fusion, predictive forecasting, and certified PDF reports — precise, dense, and built for clinical rigor.",
    preview: {
      bg: "linear-gradient(155deg, #0B1020 0%, #10172A 100%)",
      chips: ["Cohort n=248", "Forecast ↑", "Report ready"],
      light: false,
      orbColor: "#1B9E8C",
    },
  },
] as const;

export function ThreePersonas() {
  const use3D = use3DCapable();

  return (
    <section id="personas" className="bg-canvas py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="One platform, three portals"
          title="Built differently for who's using it"
          description="Same clinical backbone underneath. A completely different experience on top — because a 9-year-old, a parent at 11pm, and a clinician between appointments need different things."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PERSONAS.map((persona, i) => (
            <motion.div
              key={persona.id}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <TiltCard maxTilt={5} className="group h-full">
                <article className="relative h-full overflow-hidden rounded-3xl border border-primary/[0.06] shadow-[0_20px_50px_-28px_rgba(16,23,42,0.35)] transition-shadow duration-500 hover:shadow-[var(--glow-teal)]">
                  <div
                    className="relative flex h-64 flex-col justify-between overflow-hidden p-6 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    style={{ background: persona.preview.bg }}
                  >
                    {use3D && (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -right-8 -top-10 h-48 w-48 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
                      >
                        <PersonaOrb color={persona.preview.orbColor} />
                      </div>
                    )}

                    <div
                      className={cn(
                        "relative z-10 inline-flex h-11 w-11 items-center justify-center rounded-2xl",
                        persona.preview.light ? "bg-primary/8" : "bg-white/10"
                      )}
                    >
                      <persona.icon
                        size={20}
                        className={persona.preview.light ? "text-primary" : "text-white"}
                        aria-hidden
                      />
                    </div>

                    <div className="relative z-10 flex flex-wrap gap-2">
                      {persona.preview.chips.map((chip) => (
                        <span
                          key={chip}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm transition-all duration-500 group-hover:translate-y-[-2px]",
                            persona.preview.light
                              ? "bg-white/70 text-primary-dark"
                              : "bg-white/10 text-white"
                          )}
                        >
                          {chip}
                        </span>
                      ))}
                    </div>

                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-secondary/20 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    />
                  </div>

                  <div className="bg-surface p-6">
                    <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                      {persona.tagline}
                    </p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-primary-dark">
                      {persona.name}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{persona.description}</p>
                    <a
                      href="/login"
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors group-hover:text-secondary"
                    >
                      Preview portal
                      <ArrowUpRight
                        size={15}
                        aria-hidden
                        className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </a>
                  </div>
                </article>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
