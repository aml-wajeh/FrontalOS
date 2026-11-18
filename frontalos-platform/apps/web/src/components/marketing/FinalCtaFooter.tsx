"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";

const SITEMAP = [
  {
    heading: "Portals",
    links: [
      { label: "Patient Portal", href: "#personas" },
      { label: "Parent Portal", href: "#personas" },
      { label: "Clinician Portal", href: "#personas" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Cortix", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
] as const;

export function FinalCtaFooter() {
  return (
    <>
      <section className="grain-overlay relative overflow-hidden bg-primary-dark py-24 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 0%, rgba(0,194,168,0.10), transparent 70%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8"
        >
          <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl md:text-5xl">
            Ready to see all three portals?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
            One connected platform for the child, the family, and the clinician —
            walk through each experience in a guided preview.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <ButtonLink href="#personas" size="lg">
              Explore the three portals
              <ArrowRight size={18} aria-hidden />
            </ButtonLink>
            <ButtonLink href="/login" size="lg" variant="secondary">
              Log in
            </ButtonLink>
          </div>
        </motion.div>
      </section>

      <footer className="bg-primary-dark pb-10 pt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-10 border-t border-white/10 pt-14 sm:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2">
              <Logo theme="light" height={26} />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
                FrontalOS by Cortix is an ADHD digital therapeutics platform unifying
                patient, family, and clinical experiences on one backbone.
              </p>
            </div>

            {SITEMAP.map((group) => (
              <nav key={group.heading} aria-label={group.heading}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  {group.heading}
                </h3>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className="text-sm text-white/70 hover:text-white">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Cortix. All rights reserved.</p>
            <p className="max-w-2xl leading-relaxed sm:text-right">
              FrontalOS is a clinical decision-support tool intended to assist qualified
              professionals. It is not a standalone diagnostic device and does not replace
              clinical judgment.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
