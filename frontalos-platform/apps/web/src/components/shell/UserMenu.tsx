"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/auth/session";
import { PERSONA_THEME, ROLE_BADGE_LABEL } from "@/lib/shell/personaConfig";

interface MeResponse {
  full_name: string;
  email: string;
}

export function UserMenu({ persona }: { persona: Persona }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const theme = PERSONA_THEME[persona];

  const { data: me } = useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
    retry: false,
  });

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  const displayName = me?.full_name ?? "…";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn("flex items-center gap-2.5 rounded-full pl-1 pr-2.5 py-1 transition-colors", theme.chromeHoverBg, theme.chromeText)}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary-dark ring-2 ring-secondary/25 ring-offset-2 ring-offset-transparent">
          {initials || "?"}
        </span>
        <span className="hidden sm:block text-sm font-medium">{displayName}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-30 cursor-default"
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 z-40 mt-2 w-56 origin-top-right rounded-2xl border border-primary/[0.06] bg-white p-1.5 shadow-[0_20px_40px_-24px_rgba(16,23,42,0.35)]"
            >
              <div className="px-3 py-2.5">
                <p className="text-sm font-semibold text-primary-dark truncate">{displayName}</p>
                <p className="text-xs text-muted truncate">{me?.email}</p>
                <span className="mt-1.5 inline-block rounded-full bg-secondary-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-dark">
                  {ROLE_BADGE_LABEL[persona]}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
