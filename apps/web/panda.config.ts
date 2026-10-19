import { defineConfig } from "@pandacss/dev";
import presetBase from "@pandacss/preset-base";
import pandaPreset from "@pandacss/preset-panda";

// The dashboard's look is decided in PRODUCT.md: espresso and clay. Color means
// a status or what's selected, never decoration.
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
          page: { value: "#faf5ef" },
          surface: { value: "#fffdfa" },
          ink: { value: "#2a1d16" },
          inkMuted: { value: "#786a60" },
          line: { value: "#ece2d7" },
          chip: { value: "#f1e8de" },
          espresso: { value: "#33241d" },
          clay: { value: "#bf4f2c" },
          paid: { value: "#3b6338" },
          paidBg: { value: "#e4eedf" },
          owes: { value: "#9c2348" },
          owesBg: { value: "#f9e0e6" },
          ship: { value: "#6b5210" },
          shipBg: { value: "#f4e9cc" },
        },
        fonts: {
          // Onest was drawn for Cyrillic screens and has Mongolian's Ө and Ү.
          sans: { value: "'Onest Variable', -apple-system, system-ui, sans-serif" },
        },
        shadows: {
          card: { value: "0 0 0 1px #ece2d7, 0 2px 8px -4px rgba(80, 50, 30, 0.12)" },
          hairline: { value: "0 0 0 1px #ece2d7" },
        },
      },
    },
  },
});
