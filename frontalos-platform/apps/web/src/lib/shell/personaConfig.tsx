/**
 * lib/shell/personaConfig.tsx
 *
 * Single source of truth for how components/shell/AppShell.tsx (and its
 * children) differ per persona: theme classes, nav items, and motion
 * intensity. Adding a fifth persona later means adding one entry here —
 * AppShell/Sidebar/Topbar never hardcode a persona's look themselves.
 */
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  ClipboardList,
  GraduationCap,
  Brain,
  Trophy,
  MessageSquareText,
  FileBarChart,
  ClipboardCheck,
  ScrollText,
  Activity,
} from "lucide-react";
import type { Persona } from "@/lib/auth/session";

export interface NavItem {
  label: string;
  href: string;
  icon: (props: { className?: string }) => ReactNode;
}

export interface PersonaTheme {
  /** Sidebar + topbar surface. Patient stays dark/playful; clinical portals stay light/calm. */
  chromeBg: string;
  chromeText: string;
  chromeMuted: string;
  activeNavBg: string;
  /** Explicit hover tint for chrome icon buttons/nav links (bell, user menu,
   * nav rows). NOT `hover:bg-current/[x]` — Tailwind can't apply an opacity
   * modifier to `currentColor` (no known RGB channels to blend), so that
   * pattern silently renders as a full-opacity currentColor fill instead of
   * a subtle tint. This is the real, theme-aware fix. */
  chromeHoverBg: string;
  accentRing: string;
  /** Motion intensity — patient gets the most delight, clinical portals stay minimal per ADHD-friendly / professional-calm guidance in brand_color_palette.md. */
  motion: "playful" | "subtle" | "none";
  portalName: string;
}

export const PERSONA_THEME: Record<Persona, PersonaTheme> = {
  patient: {
    chromeBg: "bg-primary-dark",
    chromeText: "text-white",
    chromeMuted: "text-white/50",
    activeNavBg: "bg-secondary/20 text-secondary",
    chromeHoverBg: "hover:bg-white/[0.08]",
    accentRing: "ring-secondary",
    motion: "playful",
    portalName: "My Focus Zone",
  },
  parent: {
    chromeBg: "bg-white",
    chromeText: "text-primary-dark",
    chromeMuted: "text-muted",
    activeNavBg: "bg-secondary-light text-primary-dark",
    chromeHoverBg: "hover:bg-primary/[0.06]",
    accentRing: "ring-secondary",
    motion: "subtle",
    portalName: "Parent Command Center",
  },
  doctor: {
    chromeBg: "bg-primary-dark",
    chromeText: "text-white",
    chromeMuted: "text-white/50",
    activeNavBg: "bg-white/10 text-white",
    chromeHoverBg: "hover:bg-white/[0.08]",
    accentRing: "ring-secondary",
    motion: "none",
    portalName: "Clinical Portal",
  },
  school: {
    chromeBg: "bg-white",
    chromeText: "text-primary-dark",
    chromeMuted: "text-muted",
    activeNavBg: "bg-secondary-light text-primary-dark",
    chromeHoverBg: "hover:bg-primary/[0.06]",
    accentRing: "ring-secondary",
    motion: "none",
    portalName: "School Portal",
  },
  admin: {
    chromeBg: "bg-primary-dark",
    chromeText: "text-white",
    chromeMuted: "text-white/50",
    activeNavBg: "bg-white/10 text-white",
    chromeHoverBg: "hover:bg-white/[0.08]",
    accentRing: "ring-secondary",
    motion: "none",
    portalName: "Admin Console",
  },
};

export const PERSONA_NAV: Record<Persona, NavItem[]> = {
  patient: [
    { label: "My Dashboard", href: "/dashboard", icon: (p) => <LayoutDashboard {...p} /> },
    { label: "Rewards", href: "/dashboard#rewards", icon: (p) => <Trophy {...p} /> },
  ],
  parent: [
    { label: "Overview", href: "/parent/dashboard", icon: (p) => <LayoutDashboard {...p} /> },
    { label: "Notes & Goals", href: "/parent/dashboard#notes", icon: (p) => <ClipboardList {...p} /> },
  ],
  doctor: [
    { label: "Patients", href: "/doctor/dashboard", icon: (p) => <Users {...p} /> },
    { label: "MRI Analyzer", href: "/doctor/dashboard#mri", icon: (p) => <Brain {...p} /> },
    { label: "Reports", href: "/doctor/dashboard#reports", icon: (p) => <FileBarChart {...p} /> },
  ],
  school: [
    { label: "Class Roster", href: "/school/dashboard", icon: (p) => <GraduationCap {...p} /> },
    { label: "Observations", href: "/school/dashboard#observations", icon: (p) => <ClipboardCheck {...p} /> },
    { label: "Focus Trends", href: "/school/dashboard#trends", icon: (p) => <Stethoscope {...p} /> },
  ],
  admin: [
    { label: "Users", href: "/admin/dashboard", icon: (p) => <Users {...p} /> },
    { label: "Audit Log", href: "/admin/dashboard#audit-log", icon: (p) => <ScrollText {...p} /> },
    { label: "System Health", href: "/admin/dashboard#system-health", icon: (p) => <Activity {...p} /> },
  ],
};

export const ROLE_BADGE_LABEL: Record<Persona, string> = {
  patient: "Patient",
  parent: "Parent",
  doctor: "Doctor",
  school: "Teacher",
  admin: "Admin",
};

// Kept here (not imported at every call site) so any future "AI observer"
// nav badge across portals shares one icon reference.
export const AiIcon = (p: { className?: string }) => <MessageSquareText {...p} />;