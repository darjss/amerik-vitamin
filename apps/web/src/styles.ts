import { css, cva } from "styled-system/css";

export const press = css.raw({
  cursor: "pointer",
  transition: "transform .56s {easings.spring}",
  _active: { transform: "scale(.97)", transition: "transform .12s ease-out" },
});

const ink = { bg: "ink", color: "surface", boxShadow: "lift" } as const;

const lg = { height: "56px", fontSize: "18px" };

export const button = cva({
  base: {
    ...press,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    flex: "none",
    height: "48px",
    px: "20px",
    borderRadius: "999px",
    textStyle: "headline",
    whiteSpace: "nowrap",
    bg: "surface",
    color: "ink",
    boxShadow: "raiseSm",
    "& svg": { fontSize: "20px" },
    _disabled: {
      bg: "chip",
      color: "inkFaint",
      boxShadow: "none",
      cursor: "default",
      _active: { transform: "none" },
    },
  },
  variants: {
    tone: { surface: {}, ink },
    size: {
      sm: { height: "44px", px: "18px", fontSize: "16px" },
      md: {},
      lg,
    },
    wide: { true: { ...lg, width: "100%" } },
  },
  defaultVariants: { tone: "surface", size: "md" },
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
    bg: "surface",
    color: "ink",
    boxShadow: "raiseSm",
  },
  variants: {
    tone: {
      surface: {},
      ink,
      glass: {
        bg: "surface/78",
        backdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "glass",
      },
    },
  },
  defaultVariants: { tone: "surface" },
});

export const chip = cva({
  base: {
    ...press,
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    flex: "none",
    height: "40px",
    px: "15px",
    borderRadius: "20px",
    bg: "surface",
    boxShadow: "raiseSm",
    textStyle: "subhead",
    fontWeight: "600",
    whiteSpace: "nowrap",
    transition: "background .2s ease, color .2s ease",
    "& b": { fontWeight: "700", color: "inkMuted", fontVariantNumeric: "tabular-nums" },
  },
  variants: {
    on: {
      true: {
        bg: "sel",
        color: "white",
        boxShadow: "0 1px 2px {colors.sel/25}",
        "& b": { color: "white/78" },
      },
    },
  },
});
