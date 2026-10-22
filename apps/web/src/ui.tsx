import { Unauthorized } from "@amerik/contracts";
import type { OrderSummary } from "@amerik/contracts";
import type { JSX } from "@solidjs/web";
import { createUniqueId, For, Show, useContext } from "solid-js";
import { css } from "styled-system/css";
import CheckIcon from "~icons/ph/check-circle-fill";
import TruckIcon from "~icons/ph/truck-bold";
import WarningIcon from "~icons/ph/warning-circle-fill";

import { money } from "./format";
import { HeldSteps, nextStep } from "./steps";
import { Zoom } from "./zoom";
import type { Product } from "./zoom";

export type Icon = (props: JSX.SvgSVGAttributes<SVGSVGElement>) => JSX.Element;

/** Clears the iPhone status bar when the page runs full screen. */
export const top = css.raw({ pt: "calc(env(safe-area-inset-top) + 14px)" });

export const muted = css.raw({ color: "inkMuted" });

/** The iOS large title. */
export const largeTitle = css.raw({
  fontSize: "34px",
  lineHeight: "40px",
  fontWeight: "700",
  letterSpacing: "-0.025em",
  textWrap: "balance",
});

export const title2 = css.raw({
  fontSize: "22px",
  lineHeight: "28px",
  fontWeight: "700",
  letterSpacing: "-0.02em",
});

export const title3 = css.raw({
  fontSize: "20px",
  lineHeight: "25px",
  fontWeight: "650",
  letterSpacing: "-0.015em",
});

export const headline = css.raw({
  fontSize: "17px",
  lineHeight: "22px",
  fontWeight: "600",
  letterSpacing: "-0.01em",
});

export const sub = css.raw({ fontSize: "15px", lineHeight: "20px", color: "inkMuted" });

/** A section of a page: a title over content, with air between sections. */
export const section = css.raw({ px: "20px", mt: "34px" });

export const sectionHead = css.raw({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  mb: "14px",
});

/** A raised surface: something she handles, standing up off the cream. */
export const panel = css.raw({
  bg: "surface",
  borderRadius: "22px",
  boxShadow: "inset 0 1px 0 {colors.white}, {shadows.raise}",
});

/** Squeezes on touch-down and springs back on release. */
export const press = css.raw({
  cursor: "pointer",
  transition: "transform .56s {easings.spring}",
  _active: { transform: "scale(.97)", transition: "transform .12s ease-out" },
});

export const button = css.raw(press, {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  flex: "none",
  height: "48px",
  px: "20px",
  borderRadius: "999px",
  fontSize: "17px",
  fontWeight: "600",
  letterSpacing: "-0.01em",
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
});

/** A filled action: warm ink does things. */
export const act = css.raw({ bg: "ink", color: "surface", boxShadow: "lift" });

export const large = css.raw({ height: "56px", fontSize: "18px" });

/** A docked action across the whole width. */
export const wide = css.raw(large, { width: "100%" });

export const small = css.raw({ height: "44px", px: "18px", fontSize: "16px" });

export const round = css.raw(press, {
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
});

export const roundAct = css.raw({ bg: "ink", color: "surface", boxShadow: "lift" });

/** Frosted glass for buttons that float over the page. */
export const glass = css.raw({
  bg: "surface/78",
  backdropFilter: "blur(20px) saturate(180%)",
  boxShadow: "glass",
});

/** The frosted bar a pushed page opens with; each page lays out its own row. */
export const glassBar = css.raw({
  position: "sticky",
  top: 0,
  zIndex: 5,
  px: "14px",
  pt: "calc(env(safe-area-inset-top) + 8px)",
  pb: "8px",
  bg: "page/90",
  backdropFilter: "blur(22px) saturate(180%)",
});

/** A filter chip with an optional count in <b>; teal when on. */
export const chip = css.raw(press, {
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  flex: "none",
  height: "40px",
  px: "15px",
  borderRadius: "20px",
  bg: "surface",
  boxShadow: "raiseSm",
  fontSize: "15px",
  fontWeight: "600",
  whiteSpace: "nowrap",
  transition: "background .2s ease, color .2s ease",
  "& b": { fontWeight: "700", color: "inkMuted", fontVariantNumeric: "tabular-nums" },
});

export const chipOn = css.raw({
  bg: "sel",
  color: "white",
  boxShadow: "0 1px 2px {colors.sel/25}",
  "& b": { color: "white/78" },
});

/** A row of chips that scrolls sideways past the screen edge. */
export const chipRow = css.raw({
  display: "flex",
  gap: "8px",
  px: "16px",
  py: "4px",
  overflowX: "auto",
  scrollbarWidth: "none",
});

export const field = css.raw({
  width: "100%",
  bg: "surface",
  borderRadius: "14px",
  boxShadow: "0 0 0 .5px {colors.ink/12}, inset 0 1px 2px {colors.ink/5}",
  px: "14px",
  py: "12px",
  fontSize: "17px",
  color: "ink",
  outline: "none",
  _focus: { boxShadow: "0 0 0 2px {colors.sel}" },
});

export const searchBox = css.raw({
  height: "46px",
  borderRadius: "14px",
  bg: "surface",
  boxShadow: "0 0 0 .5px {colors.ink/10}, inset 0 1px 2px {colors.ink/5}",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  px: "14px",
  color: "inkMuted",
  "& svg": { fontSize: "20px", flex: "none" },
  "& input": {
    flex: 1,
    minWidth: 0,
    bg: "transparent",
    outline: "none",
    color: "ink",
    fontSize: "17px",
    _placeholder: { color: "inkMuted" },
  },
});

/** A note she must not miss: a door code, "call first". */
export function Note(props: { children: JSX.Element; large?: boolean }) {
  return (
    <div
      class={css(
        {
          display: "flex",
          gap: "8px",
          alignItems: "flex-start",
          px: "12px",
          py: "10px",
          borderRadius: "14px",
          bg: "waitBg",
          color: "waitInk",
          fontSize: "15px",
          lineHeight: "20px",
          fontWeight: "650",
          textAlign: "left",
          "& svg": { fontSize: "19px", color: "wait", flex: "none" },
        },
        props.large && { fontSize: "17px", lineHeight: "22px", px: "14px", py: "12px" },
      )}
    >
      <WarningIcon />
      <span>{props.children}</span>
    </div>
  );
}

const pillBase = css.raw({
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  flex: "none",
  height: "28px",
  px: "10px",
  borderRadius: "14px",
  fontSize: "15px",
  fontWeight: "650",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  "& svg": { fontSize: "15px" },
});

const tones = {
  owes: css.raw({ bg: "owesBg", color: "owes" }),
  paid: css.raw({ bg: "paidBg", color: "paid" }),
  wait: css.raw({ bg: "waitBg", color: "wait" }),
  soft: css.raw({ bg: "selSoft", color: "sel" }),
  neutral: css.raw({ bg: "chip", color: "inkMuted" }),
};

export function Pill(props: { tone: keyof typeof tones; children: JSX.Element }) {
  return <span class={css(pillBase, tones[props.tone])}>{props.children}</span>;
}

/** Money to collect in red, or paid in green. */
export function Money(props: { order: Pick<OrderSummary, "terms" | "paid" | "balance"> }) {
  return (
    <Show
      when={props.order.balance > 0}
      fallback={
        <Show when={props.order.paid > 0}>
          <Pill tone="paid">
            <CheckIcon />
            Төлсөн
          </Pill>
        </Show>
      }
    >
      <Show when={props.order.terms === "cod"} fallback={<Pill tone="owes">Төлбөр хүлээж</Pill>}>
        <Pill tone="owes">{money(props.order.balance)}</Pill>
      </Show>
    </Show>
  );
}

const tileBase = css.raw({
  position: "relative",
  display: "block",
  flex: "none",
  bg: "white",
  boxShadow: "raiseSm",
  "& img": {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    p: "9%",
  },
});

const rings = {
  page: css.raw({ boxShadow: "0 0 0 2.5px {colors.page}" }),
  surface: css.raw({ boxShadow: "0 0 0 2.5px {colors.surface}" }),
};

/**
 * A product photo as a raised white tile, with ×N as a teal badge on its
 * corner. A tap shows it full size unless `still`; sizes are inline styles
 * because Panda only builds classes for values written in a css() call.
 */
export function Tile(props: {
  product: Product;
  size?: number;
  quantity?: number;
  soft?: boolean;
  ring?: keyof typeof rings;
  still?: boolean;
}) {
  const zoom = useContext(Zoom);

  const box = () => {
    const radius = props.size === undefined || props.size >= 100 ? 20 : props.size >= 60 ? 17 : 14;

    return props.size === undefined
      ? { width: "100%", "aspect-ratio": "1", "border-radius": `${radius}px` }
      : { width: `${props.size}px`, height: `${props.size}px`, "border-radius": `${radius}px` };
  };

  const inside = () => (
    <>
      <Show when={props.product.image}>
        {(src) => (
          <img src={src()} alt={`${props.product.brand} ${props.product.name}`} loading="lazy" />
        )}
      </Show>
      <Show when={props.quantity}>
        {(quantity) => (
          <b
            class={css(
              {
                position: "absolute",
                zIndex: 2,
                top: "-7px",
                right: "-7px",
                minWidth: "28px",
                height: "28px",
                px: "7px",
                borderRadius: "14px",
                bg: "sel",
                color: "white",
                fontSize: "15px",
                fontWeight: "700",
                display: "grid",
                placeItems: "center",
                fontVariantNumeric: "tabular-nums",
                pointerEvents: "none",
              },
              rings[props.ring ?? "page"],
              props.soft && { bg: "selSoft", color: "sel" },
            )}
          >
            ×{quantity()}
          </b>
        )}
      </Show>
    </>
  );

  return (
    <Show
      when={!props.still && props.product.image}
      fallback={
        <span class={css(tileBase)} style={box()}>
          {inside()}
        </span>
      }
    >
      <button
        type="button"
        aria-label={`${props.product.name} томоор харах`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          zoom(props.product);
        }}
        class={css(tileBase, { zIndex: 1, cursor: "zoom-in" })}
        style={box()}
      >
        {inside()}
      </button>
    </Show>
  );
}

/** One choice out of a few: an iOS segmented control with a sliding thumb. */
export function Segmented<T extends string>(props: {
  options: ReadonlyArray<readonly [T, string, Icon?]>;
  value: T;
  onChange: (value: T) => void;
}) {
  const name = createUniqueId();

  const index = () =>
    Math.max(
      0,
      props.options.findIndex(([value]) => value === props.value),
    );

  // Native radios: arrow keys and one tab stop come with them.
  return (
    <div
      role="radiogroup"
      class={css({
        position: "relative",
        display: "grid",
        gridAutoFlow: "column",
        gridAutoColumns: "1fr",
        height: "46px",
        p: "3px",
        borderRadius: "14px",
        bg: "chip",
      })}
    >
      <span
        class={css({
          position: "absolute",
          top: "3px",
          bottom: "3px",
          left: "3px",
          borderRadius: "11px",
          bg: "surface",
          boxShadow: "0 0 0 .5px {colors.ink/6}, 0 3px 8px -2px {colors.ink/16}",
          transition: "transform .5s {easings.spring}",
        })}
        style={{
          width: `calc((100% - 6px) / ${props.options.length})`,
          transform: `translateX(${index() * 100}%)`,
        }}
      />
      <For each={props.options}>
        {([value, label, OptionIcon]) => (
          <label
            class={css(
              {
                position: "relative",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "16px",
                fontWeight: "600",
                color: "inkMuted",
                cursor: "pointer",
                transition: "color .2s ease",
                "& svg": { fontSize: "18px" },
                "&:has(:focus-visible)": {
                  outline: "2px solid {colors.sel}",
                  outlineOffset: "-2px",
                  borderRadius: "11px",
                },
              },
              props.value === value && { color: "ink" },
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={props.value === value}
              onChange={() => props.onChange(value)}
              class={css({ srOnly: true })}
            />
            {OptionIcon && <OptionIcon />}
            {label}
          </label>
        )}
      </For>
    </div>
  );
}

/**
 * An order's next step. A tap holds it for 5 seconds as [Болих N] with a bar
 * draining under it, then writes and calls `reload`. It stays disabled while
 * the write runs; a failure shows through `HeldSteps.failure`.
 */
export function StepButton(props: {
  order: Pick<OrderSummary, "id" | "status" | "terms">;
  reload: () => Promise<void>;
  wide?: boolean;
}) {
  const { hold, release, running, secondsLeft } = useContext(HeldSteps);

  return (
    <Show when={nextStep(props.order)}>
      {(next) => (
        <Show
          when={secondsLeft(props.order.id)}
          fallback={
            <button
              type="button"
              disabled={running(props.order.id)}
              class={css(button, act, { position: "relative", zIndex: 1 }, props.wide && wide)}
              onClick={() => hold(props.order.id, next().step, props.reload)}
            >
              <TruckIcon />
              {next().label}
            </button>
          }
        >
          {(left) => (
            <button
              type="button"
              class={css(
                button,
                {
                  position: "relative",
                  zIndex: 1,
                  overflow: "hidden",
                  fontVariantNumeric: "tabular-nums",
                },
                props.wide && wide,
              )}
              onClick={() => release(props.order.id)}
            >
              Болих {left()}
              <span
                class={css({
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  height: "4px",
                  bg: "sel",
                  transition: "width 1s linear",
                })}
                style={{ width: `${((left() - 1) / 5) * 100}%` }}
              />
            </button>
          )}
        </Show>
      )}
    </Show>
  );
}

/** Why a write didn't go through, right above the button she tapped. */
export function Failed(props: { text: string | undefined }) {
  return (
    <Show when={props.text}>
      {(text) => (
        <p class={css({ pb: "12px", color: "owes", fontSize: "15px", textAlign: "center" })}>
          {text()}
        </p>
      )}
    </Show>
  );
}

/** A failed read, or an expired session. */
export function Problem(props: { error: unknown }) {
  const unauthorized = () => props.error instanceof Unauthorized;

  return (
    <div class={css(panel, { m: "16px", p: "20px", display: "grid", gap: "14px" })}>
      <Show when={unauthorized()} fallback={<p>Ачаалж чадсангүй. Дахин оролдоно уу.</p>}>
        <p>Дахин нэвтэрнэ үү.</p>
        <a href="/login" class={css(button, act)}>
          Нэвтрэх
        </a>
      </Show>
    </div>
  );
}
