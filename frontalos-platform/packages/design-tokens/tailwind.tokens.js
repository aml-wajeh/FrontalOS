// packages/design-tokens/tailwind.tokens.js
//
// Tailwind theme extension generated from tokens.json / brand_color_palette.md.
// Import this into any app's tailwind.config — do NOT redefine brand hex
// values locally in an app-level config; extend from here instead.
//
// 60-30-10 rule (brand_color_palette.md, section 5): compose layouts as
// ~60% canvas/neutral (bg-canvas, surface), ~30% primary navy (structure,
// nav, headers), ~10% teal/amber (CTAs, highlights). Enforce this at the
// component level — Tailwind cannot enforce a ratio rule for you.
//
// No-neons rule (brand_color_palette.md, section 5): never add saturated
// fire-red or bright-yellow utilities to this palette. ADHD-friendly UX
// depends on the restrained, low-arousal palette below.

/** @type {{ colors: Record<string, string | Record<string, string>> }} */
const tailwindTokens = {
  colors: {
    // Core brand (60-30-10)
    primary: {
      DEFAULT: "var(--color-primary)", // Deep Navy Blue #1B2340 — 60% dominant
      dark: "var(--color-primary-dark)", // #10172A
      soft: "var(--color-primary-soft)", // #2C375C — hover state
    },
    secondary: {
      DEFAULT: "var(--color-secondary)", // Calming Teal #00C2A8 — 30% support
      light: "var(--color-secondary-light)", // #E6F9F6
    },
    accent: {
      DEFAULT: "var(--color-accent)", // Soft Amber Coral #F4A261 — 10% highlight
      soft: "var(--color-accent-soft)", // #FDF0E6
    },

    // Neutrals / backgrounds
    ink: "var(--color-ink)", // Slate Ink #10172A — body text
    surface: "var(--color-surface)", // Pure White #FFFFFF — card surface
    canvas: "var(--color-canvas)", // Cloud White #F5F7FB — app background
    muted: "var(--color-muted)", // Muted Grey #6B7280 — captions/subtext

    // Semantic aliases
    success: {
      bg: "var(--color-success-bg)", // #E6F9F6
    },
    alert: {
      bg: "var(--color-alert-bg)", // #FDF0E6
    },
    danger: {
      DEFAULT: "var(--color-danger)", // #B3483D — muted terracotta, not fire-red
      soft: "var(--color-danger-soft)", // #F6E8E6 — light-surface error bg
      "on-dark": "var(--color-danger-on-dark)", // #E2A79E — error text/border on dark chrome
      "on-dark-bg": "var(--color-danger-on-dark-bg)", // dark-chrome error bg
    },
  },
};

module.exports = { tailwindTokens };
