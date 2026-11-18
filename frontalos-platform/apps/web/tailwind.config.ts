import type { Config } from "tailwindcss";
// Foundation-only: consumes the single source of truth design tokens.
// Do NOT hardcode brand colors here in later prompts — extend from tokens.
import { tailwindTokens } from "../../packages/design-tokens/tailwind.tokens";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: tailwindTokens.colors,
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-space-grotesk)", "ui-monospace", "monospace"],
      },
      height: {
        13: "3.25rem",
      },
      keyframes: {
        "pulse-slow": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "pulse-slow": "pulse-slow 3.5s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
