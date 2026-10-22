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
      textStyles: {
        largeTitle: {
          value: {
            fontSize: "34px",
            lineHeight: "40px",
            fontWeight: "700",
            letterSpacing: "-0.025em",
            textWrap: "balance",
          },
        },
        title2: {
          value: {
            fontSize: "22px",
            lineHeight: "28px",
            fontWeight: "700",
            letterSpacing: "-0.02em",
          },
        },
        title3: {
          value: {
            fontSize: "20px",
            lineHeight: "25px",
            fontWeight: "650",
            letterSpacing: "-0.015em",
          },
        },
        headline: {
          value: {
            fontSize: "17px",
            lineHeight: "22px",
            fontWeight: "600",
            letterSpacing: "-0.01em",
          },
        },
        body: { value: { fontSize: "17px", lineHeight: "1.3" } },
        callout: { value: { fontSize: "16px", lineHeight: "20px" } },
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
          page: { value: "#f8f4ec" },
          surface: { value: "#fffdf9" },
          ink: { value: "#1e1b17" },
          inkMuted: { value: "#665e54" },
          inkFaint: { value: "#857d72" },
          line: { value: "#e9e3d8" },
          chip: { value: "#efeae0" },
          track: { value: "#e1d9cb" },
          dot: { value: "#d9d1c3" },
          tick: { value: "#c9c0b1" },
          scrim: { value: "rgba(15,14,12,.45)" },
          sel: { value: "#0f4c5c" },
          selSoft: { value: "#e1ecee" },
          paid: { value: "#2f6b3a" },
          paidBg: { value: "#e5efe2" },
          owes: { value: "#b4233c" },
          owesBg: { value: "#fbe6e8" },
          wait: { value: "#8a5a00" },
          waitBg: { value: "#f8ecce" },
          waitInk: { value: "#4d3400" },
        },
        fonts: {
          sans: { value: "'Inter Variable', -apple-system, system-ui, sans-serif" },
        },
        shadows: {
          raise: {
            value:
              "0 0 0 .5px rgba(30,27,23,.07), 0 1px 2px rgba(30,27,23,.06), 0 4px 10px -4px rgba(30,27,23,.08), 0 16px 30px -16px rgba(30,27,23,.16)",
          },
          raiseSm: {
            value:
              "0 0 0 .5px rgba(30,27,23,.08), 0 1px 2px rgba(30,27,23,.06), 0 6px 12px -8px rgba(30,27,23,.14)",
          },
          lift: {
            value:
              "inset 0 1px 0 rgba(255,255,255,.12), 0 1px 2px rgba(30,27,23,.22), 0 8px 18px -10px rgba(30,27,23,.55)",
          },
          glass: {
            value:
              "inset 0 1px 0 rgba(255,255,255,.9), 0 0 0 .5px rgba(30,27,23,.1), 0 6px 14px -6px rgba(30,27,23,.2)",
          },
        },
        easings: {
          spring: {
            value:
              "linear(0,.057,.188,.346,.503,.642,.758,.847,.913,.959,.989,1.007,1.016,1.02,1.02,1.017,1.014,1.011,1.008,1.006,1.004,1.002,1.001,1)",
          },
        },
      },
    },
  },
});
