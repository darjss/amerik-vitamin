import { css, cva } from "styled-system/css";

/** Squeezes on pointer-down for 120ms and lets go on release. */
export const press = css.raw({
  cursor: "pointer",
  transition: "transform 120ms {easings.out}, background-color 150ms ease",
  _active: { transform: "scale(.96)" },
  _motionReduce: { _active: { transform: "none" } },
});

/** The primary action: butter with a darker edge along the bottom. */
const butter = { bg: "butter", color: "ink", boxShadow: "butter" } as const;

export const button = cva({
  base: {
    ...press,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    flex: "none",
    height: "50px",
    px: "20px",
    borderRadius: "14px",
    textStyle: "headline",
    fontWeight: "600",
    whiteSpace: "nowrap",
    bg: "fill",
    color: "ink",
    "& svg": { fontSize: "20px" },
    _disabled: {
      bg: "fill",
      color: "inkMuted",
      boxShadow: "none",
      cursor: "default",
      _active: { transform: "none" },
    },
  },
  variants: {
    tone: { fill: {}, butter },
    // The next step on a list row: compact, but still the one filled action.
    size: {
      sm: {
        height: "36px",
        px: "12px",
        gap: "6px",
        borderRadius: "10px",
        textStyle: "subhead",
        fontWeight: "600",
        "& svg": { fontSize: "16px" },
      },
      md: {},
    },
    wide: { true: { width: "100%" } },
  },
  defaultVariants: { tone: "fill", size: "md" },
});

export const round = cva({
  base: {
    ...press,
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    flex: "none",
    fontSize: "20px",
    bg: "fill",
    color: "ink",
  },
  variants: {
    tone: {
      fill: {},
      butter,
      // Over a photo or scrolling content.
      glass: {
        bg: "card/80",
        backdropFilter: "blur(16px) saturate(160%)",
        boxShadow: "float",
      },
    },
  },
  defaultVariants: { tone: "fill" },
});

export const chip = cva({
  base: {
    ...press,
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    flex: "none",
    height: "36px",
    px: "14px",
    borderRadius: "18px",
    bg: "fill",
    textStyle: "subhead",
    fontWeight: "600",
    whiteSpace: "nowrap",
    "& b": { fontWeight: "600", color: "inkMuted", fontVariantNumeric: "tabular-nums" },
  },
  variants: {
    on: {
      true: { bg: "ink", color: "page", "& b": { color: "butter" } },
    },
  },
});
