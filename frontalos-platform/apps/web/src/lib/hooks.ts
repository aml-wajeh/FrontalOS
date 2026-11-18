"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Tracks the user's `prefers-reduced-motion` OS setting. Any component
 * driving continuous animation (the 3D hero, scroll-linked motion, count-up
 * numbers) should read this and simplify/disable itself when true — this is
 * a hard accessibility requirement for this build, not a nice-to-have.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(query.matches);

    const listener = (event: MediaQueryListEvent) => setPrefersReduced(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return prefersReduced;
}

/**
 * Matches a CSS media query on the client. Used to swap the WebGL hero
 * scene for a lightweight SVG fallback below the `md` breakpoint, where a
 * three.js scene is unnecessary weight on constrained devices/networks.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

/**
 * True once the component has mounted on the client. Guards any hook above
 * from causing a hydration mismatch (SSR always renders the "false"/default
 * branch first).
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab/Shift+Tab focus inside `containerRef` while `active` is true —
 * required for any `role="dialog"`/`aria-modal` surface (Dopamine Menu, MRI
 * upload dialog) so keyboard users can't tab out to the page behind it.
 * On activation, focus moves into the dialog (first focusable element, or
 * the container itself); on deactivation, focus returns to whatever
 * triggered the dialog. Escape invokes `onEscape` (typically closing it).
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void
) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );

    const focusable = getFocusable();
    (focusable[0] ?? container).focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;

      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      } else if (!items.includes(activeEl as HTMLElement)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocused.current?.focus?.();
    };
  }, [active, containerRef, onEscape]);
}
