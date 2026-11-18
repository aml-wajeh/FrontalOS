"use client";

/**
 * lib/auth/useMarketingSession.ts
 *
 * The marketing Navbar (components/marketing/Navbar.tsx) lives outside any
 * portal's <Providers> tree (no react-query client mounted on "/"), so it
 * can't reuse useDoctorQueries.ts's useCurrentUser() the way the portal
 * UserMenu/Topbar components do. This is a minimal, dependency-free
 * equivalent: a plain fetch to the same-origin GET /api/auth/me route
 * (httpOnly cookie, credentials included automatically by the browser),
 * so the Navbar can tell "Log in" apart from "go to my dashboard" instead
 * of always rendering the logged-out state regardless of session.
 *
 * Deliberately NOT using lib/api/httpClient.ts's /api/proxy/* path here —
 * that path 401-redirects logic assumes a portal context (session-expiry
 * handler registered by AppShell). This hook just wants a yes/no + persona,
 * and treats any non-200 as "not logged in" without side effects.
 */
import { useEffect, useState } from "react";

export type MarketingPersona = "patient" | "parent" | "doctor" | "school" | "admin" | null;

const PERSONA_HOME: Record<Exclude<MarketingPersona, null>, string> = {
  patient: "/dashboard",
  parent: "/parent/dashboard",
  doctor: "/doctor/dashboard",
  school: "/school/dashboard",
  admin: "/admin/dashboard",
};

const ROLE_TO_PERSONA: Record<string, Exclude<MarketingPersona, null>> = {
  child: "patient",
  parent: "parent",
  doctor: "doctor",
  psychologist: "doctor",
  school: "school",
  admin: "admin",
};

interface MarketingSessionState {
  /** undefined while the check is in flight, so the Navbar can render the
   * logged-out state by default without a flash of the wrong link. */
  isLoading: boolean;
  isAuthenticated: boolean;
  homePath: string | null;
}

export function useMarketingSession(): MarketingSessionState {
  const [state, setState] = useState<MarketingSessionState>({
    isLoading: true,
    isAuthenticated: false,
    homePath: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { roles?: string[] } | null) => {
        if (cancelled) return;
        const role = data?.roles?.[0];
        if (!role) {
          setState({ isLoading: false, isAuthenticated: false, homePath: null });
          return;
        }
        const persona = ROLE_TO_PERSONA[role] ?? null;
        setState({
          isLoading: false,
          isAuthenticated: true,
          homePath: persona ? PERSONA_HOME[persona] : null,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ isLoading: false, isAuthenticated: false, homePath: null });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}