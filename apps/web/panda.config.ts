import { defineConfig } from "@pandacss/dev";
import presetBase from "@pandacss/preset-base";
import pandaPreset from "@pandacss/preset-panda";

// The dashboard's look is decided in PRODUCT.md: cream and navy. Color
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
          page: { value: "#f8f4ec" },
          surface: { value: "#fffdf9" },
          // Navy-black, so text and the navy belong together.
          ink: { value: "#151a28" },
          inkMuted: { value: "#6b6862" },
          line: { value: "#e9e3d8" },
          chip: { value: "#efeae0" },
          // The one strong color: the main button, what's selected, ×N, done.
          navy: { value: "#1d2d50" },
          // The quiet version for marks that sit next to a navy button.
          navySoft: { value: "#e2e7f3" },
          paid: { value: "#2f6b3a" },
          paidBg: { value: "#e5efe2" },
          owes: { value: "#b4233c" },
          owesBg: { value: "#fbe6e8" },
          ship: { value: "#8a5a00" },
          shipBg: { value: "#f8ecce" },
        },
        fonts: {
          // Onest was drawn for Cyrillic screens and has Mongolian's Ө and Ү.
          sans: { value: "'Onest Variable', -apple-system, system-ui, sans-serif" },
        },
        shadows: {
          card: { value: "0 0 0 1px #e9e3d8, 0 2px 8px -4px rgba(21, 26, 40, 0.12)" },
          hairline: { value: "0 0 0 1px #e9e3d8" },
        },
      },
    },
  },
});
