"use client";

import { motion } from "framer-motion";
import { Lock, ShieldCheck, FileClock, KeyRound } from "lucide-react";

const TRUST_POINTS = [
  {
    icon: Lock,
    title: "Encrypted in transit & at rest",
    description: "Session data, imaging, and reports are encrypted end to end.",
  },
  {
    icon: ShieldCheck,
    title: "Strict role-based access",
    description: "Every portal enforces least-privilege access by design, not by convention.",
  },
  {
    icon: FileClock,
    title: "Full audit logging",
    description: "Every clinical read and write is attributable and time-stamped.",
  },
  {
    icon: KeyRound,
    title: "Clinician-verified accounts",
    description: "Clinical roles require verified credentials before elevated access is granted.",
  },
] as const;

/**
 * Compact trust/compliance band. Purely informational — it never claims a
 * specific certification the product hasn't actually attained — but gives
 * clinicians and IT reviewers a fast, credible signal that security was
 * treated as a first-class concern, not an afterthought.
 */
export function TrustBand() {
  return (
    <section className="bg-canvas py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 rounded-3xl border border-primary/[0.06] bg-surface p-8 sm:grid-cols-2 sm:p-10 lg:grid-cols-4">
          {TRUST_POINTS.map((point, i) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="flex items-start gap-3"
            >
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.06] text-primary">
                <point.icon size={18} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-primary-dark">{point.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{point.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
