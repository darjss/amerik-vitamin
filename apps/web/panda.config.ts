import { defineConfig } from "@pandacss/dev";
import presetBase from "@pandacss/preset-base";
import pandaPreset from "@pandacss/preset-panda";

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
      // Four sizes: 28 for a page title, 17, 15 and 13.
      textStyles: {
        title: {
          value: {
            fontFamily: "display",
            fontSize: "28px",
            lineHeight: "32px",
            fontWeight: "600",
            letterSpacing: "-0.02em",
            textWrap: "balance",
          },
        },
        headline: { value: { fontSize: "17px", lineHeight: "22px", fontWeight: "650" } },
        body: { value: { fontSize: "17px", lineHeight: "1.35" } },
        subhead: { value: { fontSize: "15px", lineHeight: "20px" } },
        footnote: { value: { fontSize: "13px", lineHeight: "17px" } },
      },
      keyframes: {
        appear: {
          from: { opacity: 0, transform: "translateY(4px)" },
          to: { opacity: 1, transform: "none" },
        },
        shimmer: {
          from: { backgroundPosition: "100% 0" },
          to: { backgroundPosition: "-100% 0" },
        },
      },
      tokens: {
        colors: {
          page: { value: "oklch(0.972 0.012 88)" },
          card: { value: "#fff" },
          ink: { value: "oklch(0.26 0.02 60)" },
          inkMuted: { value: "oklch(0.47 0.025 70)" },
          fill: { value: "oklch(0.94 0.012 85)" },
          line: { value: "oklch(0.9 0.012 80)" },
          scrim: { value: "oklch(0.2 0.02 60 / .42)" },
          butter: { value: "oklch(0.9 0.14 95)" },
          butterEdge: { value: "oklch(0.78 0.13 90)" },
          ok: { value: "oklch(0.47 0.11 150)" },
          okBg: { value: "oklch(0.94 0.05 155)" },
          owe: { value: "oklch(0.52 0.17 28)" },
          oweBg: { value: "oklch(0.95 0.035 20)" },
          wait: { value: "oklch(0.5 0.1 70)" },
          waitBg: { value: "oklch(0.95 0.07 95)" },
          waitInk: { value: "oklch(0.4 0.08 70)" },
          // The dot before an order's status word.
          status: {
            new: { value: "oklch(0.58 0.13 245)" },
            paid: { value: "{colors.ok}" },
            shipped: { value: "oklch(0.55 0.13 300)" },
            delivered: { value: "oklch(0.6 0.03 90)" },
            cancelled: { value: "oklch(0.7 0.01 80)" },
          },
        },
        fonts: {
          sans: { value: "'Onest Variable', -apple-system, system-ui, sans-serif" },
          display: { value: "'Unbounded Variable', 'Onest Variable', sans-serif" },
        },
        shadows: {
          card: { value: "0 1px 2px oklch(0.3 0.02 60 / 0.07)" },
          butter: {
            value: "inset 0 -2px 0 {colors.butterEdge}, 0 1px 3px oklch(0.4 0.08 90 / 0.25)",
          },
          float: { value: "0 8px 24px oklch(0.3 0.02 60 / 0.16)" },
        },
        easings: {
          out: { value: "cubic-bezier(0.23, 1, 0.32, 1)" },
          move: { value: "cubic-bezier(0.65, 0, 0.35, 1)" },
          drawer: { value: "cubic-bezier(0.32, 0.72, 0, 1)" },
        },
      },
    },
  },
});
