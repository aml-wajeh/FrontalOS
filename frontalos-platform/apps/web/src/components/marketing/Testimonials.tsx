"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card, CardBody } from "@/components/ui/Card";
import { use3DCapable } from "@/lib/use3d";

const PersonaOrb = dynamic(() => import("./PersonaOrb").then((mod) => mod.PersonaOrb), {
  ssr: false,
});

const TESTIMONIALS = [
  {
    quote:
      "The forecast view changes how I plan a visit. I'm no longer reconstructing three weeks of behavior from a parent's memory — I open the trajectory and we talk about what actually happened.",
    name: "Dr. Rana El-Sayed",
    role: "Developmental Pediatrician",
    color: "#00C2A8",
  },
  {
    quote:
      "I used to dread the nightly screen-time argument. Now I get one calm number on the parent app instead of a fight — and a note from the doctor when something actually needs my attention.",
    name: "Yasmin K.",
    role: "Parent of a 9-year-old patient",
    color: "#F4A261",
  },
  {
    quote:
      "Coordinating with a student's clinician used to mean phone tag. The shared care-team thread means the classroom accommodation plan and the clinical plan are finally reading from the same page.",
    name: "Mostafa Adel",
    role: "School Counselor",
    color: "#1B9E8C",
  },
] as const;

/**
 * Social-proof section giving each of the platform's three real-world
 * audiences (clinician, parent, school) a distinct, credible voice. Sits
 * after HowItWorks — after the visitor understands the loop, before the
 * final CTA.
 */
export function Testimonials() {
  const use3D = use3DCapable();

  return (
    <section id="testimonials" className="bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Trusted across the care team"
          title="What clinicians, families, and schools say"
          description="Three different audiences, three different jobs to be done — and the same platform underneath all of them."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              <Card hover className="flex h-full flex-col">
                <CardBody className="flex h-full flex-col">
                  <Quote size={22} className="text-secondary" aria-hidden />
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-ink/80">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-6 flex items-center gap-3 border-t border-primary/[0.06] pt-5">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary/[0.06]">
                      {use3D ? (
                        <PersonaOrb color={t.color} />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{ background: t.color, opacity: 0.35 }}
                          aria-hidden
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary-dark">{t.name}</p>
                      <p className="text-xs text-muted">{t.role}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
