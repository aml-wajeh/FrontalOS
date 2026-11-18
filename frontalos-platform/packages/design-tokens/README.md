# @frontalos/design-tokens

Single source of truth for the FrontalOS / NeuroSync-Synapsa brand palette,
parsed directly from `brand_color_palette.md` at the repo root's original
upload location (see `docs/AUDIT.md` for provenance).

## Files

- **`tokens.json`** — canonical color data (hex, rgb, role) for every color
  and tint documented in `brand_color_palette.md`, section by section.
- **`tailwind.tokens.js`** — Tailwind `theme.extend.colors` object, wired to
  CSS variables (`var(--color-*)`) rather than raw hex, so both Tailwind
  utilities and plain CSS read from the same values.
- **`tokens.css`** — the `:root` CSS custom properties consumed by
  `tailwind.tokens.js` and by any non-Tailwind styling (charts, SVG, canvas).

## Design rules encoded as comments (not enforced by tooling — read before styling)

- **60-30-10 rule**: ~60% canvas/surface neutrals, ~30% Deep Navy primary
  (structure/nav), ~10% Teal/Amber (CTAs/highlights).
- **No neons**: no fire-red or bright-yellow anywhere in the product. Only
  the colors in this package are approved brand colors.

## Usage

From `apps/web` (already wired via the pnpm/npm workspace):

```ts
// tailwind.config.ts
import { tailwindTokens } from "@frontalos/design-tokens/tailwind.tokens";
```

```css
/* globals.css */
@import "@frontalos/design-tokens/tokens.css";
```

This package intentionally ships no build step — it's plain JSON/JS/CSS so
it can be consumed by Next.js, a future Python dashboard, or any other
future service without a compile step.
