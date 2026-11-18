"use client";

import { useState } from "react";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useMarketingSession } from "@/lib/auth/useMarketingSession";

const PORTAL_LINKS = [
  { href: "#personas", label: "Patient Portal" },
  { href: "#personas", label: "Parent Portal" },
  { href: "#personas", label: "Clinician Portal" },
];

const NAV_LINKS = [
  { href: "#features", label: "Platform" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#personas", label: "Portals" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();
  // Was previously hardcoded to always render "Log in" regardless of
  // session state — see docs/AUDIT.md §6.3. Every portal's Topbar/UserMenu
  // already did this correctly; this brings the marketing page in line.
  const { isLoading, isAuthenticated, homePath } = useMarketingSession();
  const loggedInHref = homePath ?? "/login";
  const loggedInLabel = homePath ? "Dashboard" : "Continue";

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 24);
  });

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <motion.div
        initial={false}
        animate={{
          backgroundColor: scrolled ? "rgba(16, 23, 42, 0.72)" : "rgba(16, 23, 42, 0)",
          backdropFilter: scrolled ? "blur(16px)" : "blur(0px)",
          borderColor: scrolled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0)",
        }}
        transition={{ duration: 0.3 }}
        className="border-b"
      >
        <nav
          aria-label="Primary"
          className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8"
        >
          <a href="#top" className="flex items-center" aria-label="FrontalOS home">
            <Logo theme="light" height={28} />
          </a>

          <div className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-white/80 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            {!isLoading && (
              <a
                href={isAuthenticated ? loggedInHref : "/login"}
                className="text-sm font-medium text-white/80 hover:text-white"
              >
                {isAuthenticated ? loggedInLabel : "Log in"}
              </a>
            )}
            <ButtonLink href="#personas" size="md">
              Explore portals
            </ButtonLink>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>
      </motion.div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-b border-white/10 bg-primary-dark/95 backdrop-blur-xl lg:hidden"
          >
            <div className="flex flex-col gap-1 px-4 pb-6 pt-2 sm:px-6">
              {PORTAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-medium text-white/85 hover:bg-white/5"
                >
                  {link.label}
                </a>
              ))}
              <div className={cn("my-2 h-px bg-white/10")} />
              {!isLoading && (
                <a
                  href={isAuthenticated ? loggedInHref : "/login"}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl px-3 py-3 text-base font-medium text-white/85 hover:bg-white/5"
                >
                  {isAuthenticated ? loggedInLabel : "Log in"}
                </a>
              )}
              <ButtonLink href="#personas" size="md" className="mt-2 w-full" onClick={() => setMobileOpen(false)}>
                Explore portals
              </ButtonLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}