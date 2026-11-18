/**
 * src/lib/branding.ts
 *
 * Single source of truth for all brand asset paths used across the app.
 * Both Logo.tsx (client component) and app/layout.tsx (server metadata)
 * import from here so swapping brand files at /public/branding/ is a one-
 * line change instead of a grep-and-replace.
 *
 * All paths are relative to the Next.js /public directory root.
 */

export const BRANDING = {
  /** Full horizontal lockup — used in navbar, OG image, twitter card. */
  logoFull: "/branding/logo.svg",

  /** Dark variant of the horizontal lockup — for light backgrounds. */
  logoDark: "/branding/logo-dark.svg",

  /** Square/circular mark only — used in favicon-like tight spaces. */
  logoMark: "/branding/logo-mark.svg",

  /** Favicon path — referenced in layout.tsx metadata.icons. */
  favicon: "/branding/favicon.ico",

  /** App / platform display name. */
  appName: "FrontalOS",

  /** Full brand name including parent brand. */
  fullName: "FrontalOS by Cortix",
} as const;
