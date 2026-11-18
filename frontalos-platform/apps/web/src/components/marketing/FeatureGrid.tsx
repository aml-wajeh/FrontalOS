"use client";

import { motion } from "framer-motion";
import {
  Eye,
  Sparkles,
  Brain,
  TrendingUp,
  FileCheck2,
  ShieldCheck,
  Bell,
  Users,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card, CardBody } from "@/components/ui/Card";
import { TiltCard } from "@/components/ui/TiltCard";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Eye,
    tone: "teal",
    title: "Live AI Vision Observer",
    description: "Real-time attention and engagement signal during sessions, without a wearable.",
  },
  {
    icon: Sparkles,
    tone: "amber",
    title: "Dopamine Menu",
    description: "Bite-size, gamified rewards tuned to keep motivation steady, not spiky.",
  },
  {
    icon: Brain,
    tone: "navy",
    title: "MRI + Behavioral AI Fusion",
    description: "Structural imaging and behavioral data combined into one coherent model.",
  },
  {
    icon: TrendingUp,
    tone: "teal",
    title: "Predictive Forecasting",
    description: "Early signal on trajectory, so care plans adjust before a setback, not after.",
  },
  {
    icon: FileCheck2,
    tone: "amber",
    title: "Certified PDF Reports",
    description: "Clinic-ready exports formatted for records, insurers, and referrals.",
  },
  {
    icon: ShieldCheck,
    tone: "navy",
    title: "RBAC Multi-Portal Security",
    description: "Strict role-based access across patient, parent, and clinician portals.",
  },
  {
    icon: Bell,
    tone: "teal",
    title: "Gentle Care Alerts",
    description: "Meaningful nudges for families and clinicians — never sensory-overloading.",
  },
  {
    icon: Users,
    tone: "amber",
    title: "Care-Team Collaboration",
    description: "Shared context across parents, doctors, and school staff in one thread.",
  },
] as const;

const toneStyles: Record<string, string> = {
  teal: "bg-secondary-light text-secondary",
  amber: "bg-accent-soft text-accent",
  navy: "bg-primary/[0.06] text-primary",
};

export function FeatureGrid() {
  return (
    <section id="features" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The platform underneath"
          title="Clinical rigor, built to feel calm"
          description="Every feature follows the same brand rule the interface does — 60% calm space, 30% structure, 10% signal. Nothing here shouts for attention."
        />

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (i % 4) * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              <TiltCard maxTilt={6} className="group h-full">
                <Card
                  hover
                  className="h-full overflow-hidden transition-shadow duration-300 group-hover:shadow-[0_24px_48px_-24px_rgba(16,23,42,0.25)]"
                >
                  <CardBody className="flex h-full flex-col">
                    <span
                      className={cn(
                        "inline-flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3",
                        toneStyles[feature.tone]
                      )}
                    >
                      <feature.icon size={20} aria-hidden />
                    </span>
                    <h3 className="mt-5 font-display text-base font-semibold text-primary-dark">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{feature.description}</p>
                  </CardBody>
                </Card>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
