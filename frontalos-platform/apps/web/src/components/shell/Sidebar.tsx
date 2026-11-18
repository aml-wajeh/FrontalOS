"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/auth/session";
import { PERSONA_NAV, PERSONA_THEME } from "@/lib/shell/personaConfig";

export function Sidebar({ persona }: { persona: Persona }) {
  const pathname = usePathname();
  const theme = PERSONA_THEME[persona];
  const items = PERSONA_NAV[persona];
  // Dark-chrome personas — kept as one flag so the border/logo-theme
  // conditions below can't drift out of sync with each other again (see
  // the analogous fix already applied in AppShell.tsx: "admin" was added
  // to personaConfig.tsx with a dark chromeBg, but a check written before
  // it existed only ever tested for "patient"/"doctor" here too).
  const isDarkChrome = persona === "patient" || persona === "doctor" || persona === "admin";

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 border-r relative z-10",
        theme.chromeBg,
        isDarkChrome ? "border-white/10" : "border-primary/[0.06]"
      )}
    >
      <div className="h-16 flex items-center px-6">
        <Logo variant="mark" theme={isDarkChrome ? "light" : "dark"} height={24} />
        <span className={cn("ml-2.5 font-display text-sm font-semibold", theme.chromeText)}>{theme.portalName}</span>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1" aria-label="Portal navigation">
        {items.map((item) => {
          const isActive = pathname === item.href.split("#")[0];
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? theme.activeNavBg : cn(theme.chromeMuted, theme.chromeHoverBg)
              )}
            >
              {/* Shared-layout active pill: slides smoothly between nav
                  items instead of popping, without touching routing —
                  purely a motion layer sitting behind the icon/label. */}
              {isActive && (
                <motion.span
                  layoutId={`sidebar-active-${persona}`}
                  className={cn(
                    "absolute inset-0 rounded-xl",
                    theme.activeNavBg,
                    isDarkChrome ? "shadow-[0_0_0_1px_rgba(0,194,168,0.25)]" : "shadow-[0_1px_2px_rgba(16,23,42,0.04)]"
                  )}
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4 shrink-0" />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={cn("mx-3 mb-4 h-px", isDarkChrome ? "bg-white/[0.06]" : "bg-primary/[0.05]")} />
      <div className={cn("px-6 pb-5 text-[10px] uppercase tracking-[0.16em]", theme.chromeMuted)}>
        FrontalOS · Cortix
      </div>
    </aside>
  );
}

