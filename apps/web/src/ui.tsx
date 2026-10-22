import { Unauthorized } from "@amerik/contracts";
import { useLocation } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import { createEffect, createUniqueId, For, Show } from "solid-js";
import { css } from "styled-system/css";
import HouseFillIcon from "~icons/ph/house-fill";
import HouseIcon from "~icons/ph/house";
import PillFillIcon from "~icons/ph/pill-fill";
import PillIcon from "~icons/ph/pill";
import ReceiptFillIcon from "~icons/ph/receipt-fill";
import ReceiptIcon from "~icons/ph/receipt";
import WarningIcon from "~icons/ph/warning-circle-fill";

export type Icon = (props: JSX.SvgSVGAttributes<SVGSVGElement>) => JSX.Element;

/** Clears the iPhone status bar when the page runs full screen. */
export const top = css.raw({ pt: "calc(env(safe-area-inset-top) + 14px)" });

export const muted = css.raw({ color: "inkMuted" });

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

export const section = css.raw({ px: "20px", mt: "34px" });

export const sectionHead = css.raw({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  mb: "14px",
});

export const appear = css.raw({
  animation: "appear .25s ease-out both",
  _motionReduce: { animation: "none" },
});

export const spinner = css.raw({
  flex: "none",
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  border: "3px solid {colors.selSoft}",
  borderTopColor: "sel",
  animation: "spin 0.9s linear infinite",
  _motionReduce: { animation: "none" },
});

export const panel = css.raw({
  bg: "surface",
  borderRadius: "22px",
  boxShadow: "inset 0 1px 0 {colors.white}, {shadows.raise}",
});

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

export const act = css.raw({ bg: "ink", color: "surface", boxShadow: "lift" });

export const large = css.raw({ height: "56px", fontSize: "18px" });

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

export const tones = {
  owes: css.raw({ bg: "owesBg", color: "owes" }),
  paid: css.raw({ bg: "paidBg", color: "paid" }),
  wait: css.raw({ bg: "waitBg", color: "wait" }),
  soft: css.raw({ bg: "selSoft", color: "sel" }),
  neutral: css.raw({ bg: "chip", color: "inkMuted" }),
};

export type Tone = keyof typeof tones;

export function Pill(props: { tone: Tone; children: JSX.Element }) {
  return <span class={css(pillBase, tones[props.tone])}>{props.children}</span>;
}

export function Segmented<T extends string>(props: {
  options: ReadonlyArray<readonly [T, string, Icon?]>;
  value: T;
  onChange: (value: T) => void;
}) {
  const name = createUniqueId();

  const index = () => props.options.findIndex(([value]) => value === props.value);

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

/** A form's one write, with why the last try failed right above it. */
export function SaveButton(props: {
  failed: string | undefined;
  disabled: boolean;
  onClick: () => void;
  children: JSX.Element;
}) {
  return (
    <>
      <Failed text={props.failed} />
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => props.onClick()}
        class={css(button, act, wide)}
      >
        {props.children}
      </button>
    </>
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

export const sheetPrompt = css.raw(sub, { pb: "18px", mt: "-10px" });

/** A bottom sheet on the native dialog: Escape, the backdrop and the grabber close it. */
export function Sheet(props: {
  open: boolean;
  title: string;
  prompt?: JSX.Element;
  onClose: () => void;
  children: JSX.Element;
}) {
  let dialog: HTMLDialogElement | undefined;

  createEffect(
    () => props.open,
    (open) => {
      if (open) dialog?.showModal();
      else dialog?.close();
    },
  );

  return (
    <dialog
      ref={(element) => {
        dialog = element;
      }}
      // Only her own close counts: a sheet closed because another opened says nothing.
      onClose={() => {
        if (props.open) props.onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog) dialog.close();
      }}
      class={css({
        mt: "auto",
        mx: 0,
        mb: 0,
        width: "100%",
        maxWidth: "100%",
        bg: "page",
        color: "ink",
        border: "none",
        borderRadius: "22px 22px 0 0",
        p: "0 20px calc(env(safe-area-inset-bottom) + 20px)",
        "&::backdrop": { bg: "scrim" },
      })}
    >
      <button
        type="button"
        aria-label="Хаах"
        onClick={() => dialog?.close()}
        class={css({
          display: "block",
          mx: "auto",
          width: "60px",
          height: "22px",
          cursor: "pointer",
          _after: {
            content: '""',
            display: "block",
            width: "38px",
            height: "5px",
            mx: "auto",
            borderRadius: "3px",
            bg: "ink/18",
          },
        })}
      />
      <h2 class={css(title3, { pt: "6px", pb: "18px" })}>{props.title}</h2>
      <Show when={props.prompt}>{(prompt) => <div class={css(sheetPrompt)}>{prompt()}</div>}</Show>
      {props.children}
    </dialog>
  );
}

/** The screen's main action, docked to the bottom. */
export function Dock(props: { children: JSX.Element }) {
  return (
    <div
      class={css({
        position: "fixed",
        zIndex: 10,
        left: 0,
        right: 0,
        bottom: 0,
        display: "grid",
        gap: "10px",
        px: "16px",
        pt: "14px",
        pb: "calc(env(safe-area-inset-bottom) + 16px)",
        bg: "page/92",
        backdropFilter: "blur(24px) saturate(180%)",
        maskImage: "linear-gradient(transparent, {colors.black} 14px)",
      })}
    >
      {props.children}
    </div>
  );
}

const tab = css.raw({
  flex: 1,
  borderRadius: "27px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "2px",
  fontSize: "12px",
  fontWeight: "600",
  color: "ink",
  transition: "background .25s ease",
  "& svg": { fontSize: "25px" },
});

const activeTab = css.raw({ bg: "selSoft", color: "sel" });

const tabs = [
  { href: "/", label: "Нүүр", Icon: HouseIcon, Active: HouseFillIcon },
  { href: "/orders", label: "Захиалга", Icon: ReceiptIcon, Active: ReceiptFillIcon },
  { href: "/products", label: "Бараа", Icon: PillIcon, Active: PillFillIcon },
] satisfies ReadonlyArray<{ href: string; label: string; Icon: Icon; Active: Icon }>;

export function TabBar() {
  const location = useLocation();

  const at = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <nav
      class={css({
        position: "fixed",
        zIndex: 10,
        left: "18px",
        right: "18px",
        bottom: "calc(env(safe-area-inset-bottom) + 12px)",
        height: "64px",
        borderRadius: "32px",
        display: "flex",
        p: "5px",
        bg: "surface/88",
        backdropFilter: "blur(24px) saturate(180%)",
        boxShadow:
          "inset 0 1px 0 {colors.white/85}, 0 0 0 .5px {colors.ink/9}, 0 14px 34px -12px {colors.ink/28}",
      })}
    >
      <For each={tabs}>
        {(link) => (
          <a href={link.href} class={css(press, tab, at(link.href) && activeTab)}>
            <Show when={at(link.href)} fallback={<link.Icon />}>
              <link.Active />
            </Show>
            {link.label}
          </a>
        )}
      </For>
    </nav>
  );
}
