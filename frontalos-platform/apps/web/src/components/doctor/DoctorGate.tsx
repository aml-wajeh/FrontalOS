"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ShieldAlert, Stethoscope } from "lucide-react";
import { Providers } from "@/app/providers";
import { useCurrentUser } from "@/lib/api/useDoctorQueries";

/**
 * Role gate for the Clinical Portal. Note (see doctorClient.ts header): the
 * JWT itself carries no `role` claim to decode client-side, so this calls
 * the real GET /auth/me route — the source of truth for a user's roles
 * (database/models/auth.py Role/UserRole tables) — on every mount, rather
 * than trusting anything baked into the token.
 */
function DoctorGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading, isError } = useCurrentUser();

  const isDoctor = user?.roles.includes("doctor") ?? false;
  const denied = !isLoading && (isError || (user && !isDoctor));

  useEffect(() => {
    if (denied) {
      const timeout = setTimeout(() => router.replace("/"), 1800);
      return () => clearTimeout(timeout);
    }
  }, [denied, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-primary-dark">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-secondary/30 bg-secondary/10"
        >
          <Stethoscope className="h-5 w-5 text-secondary" />
        </motion.div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Verifying clinical access…
        </div>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-primary-dark text-center">
        <ShieldAlert className="h-8 w-8 text-accent" />
        <p className="text-sm font-medium text-white">Clinical Portal access requires a doctor role.</p>
        <p className="text-xs text-white/40">Redirecting…</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function DoctorLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen bg-primary-dark font-sans text-white">
        <DoctorGate>{children}</DoctorGate>
      </div>
    </Providers>
  );
}
