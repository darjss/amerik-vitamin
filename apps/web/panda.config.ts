import { defineConfig } from "@pandacss/dev";
import presetBase from "@pandacss/preset-base";
import pandaPreset from "@pandacss/preset-panda";

// The dashboard's look is decided in PRODUCT.md: cream, ink and marigold. Color
// means a status or what's selected, never decoration.
export default defineConfig({
  include: ["./src/**/*.{ts,tsx}"],
  jsxFramework: "solid",
  // Styles go through css(); JSX props are never read as CSS.
  jsxStyleProps: "none",
  outdir: "styled-system",
  preflight: true,
  presets: [presetBase, pandaPreset],
  theme: {
    extend: {
      tokens: {
        colors: {
          page: { value: "#f6efdf" },
          surface: { value: "#fffbf3" },
          ink: { value: "#17150f" },
          inkMuted: { value: "#6a6253" },
          line: { value: "#e7ddc9" },
          chip: { value: "#efe7d5" },
          // A highlighter, always with ink on it: selected, ×N, done.
          marigold: { value: "#ffbe1a" },
          paid: { value: "#2f6b3a" },
          paidBg: { value: "#e3eedd" },
          owes: { value: "#b4233c" },
          owesBg: { value: "#fbe3e6" },
          // Blue, so "not shipped" never reads as marigold.
          ship: { value: "#2d4c78" },
          shipBg: { value: "#e2e9f4" },
        },
        fonts: {
          // Onest was drawn for Cyrillic screens and has Mongolian's Ө and Ү.
          sans: { value: "'Onest Variable', -apple-system, system-ui, sans-serif" },
        },
        shadows: {
          card: { value: "0 0 0 1px #e7ddc9, 0 2px 8px -4px rgba(60, 45, 10, 0.12)" },
          hairline: { value: "0 0 0 1px #e7ddc9" },
        },
      },
    },
  },
});
