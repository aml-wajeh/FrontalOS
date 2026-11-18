import "@testing-library/jest-dom/vitest";

// jsdom has neither matchMedia nor IntersectionObserver. Components in
// this app (AnimatedCounter, the 3D hero, etc.) read `prefers-reduced-motion`
// via matchMedia and gate on-screen animation via IntersectionObserver —
// stub both so tests get deterministic, non-animated output rather than
// crashing or asserting against a mid-spring intermediate value.
// `matches: true` for prefers-reduced-motion specifically makes
// AnimatedCounter (and anything else honoring the hook) render its final
// value synchronously instead of tweening from 0.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error -- test-environment stub, not a spec-complete polyfill
window.IntersectionObserver = MockIntersectionObserver;
// @ts-expect-error -- same as above
global.IntersectionObserver = MockIntersectionObserver;
