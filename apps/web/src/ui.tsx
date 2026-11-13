import { Unauthorized } from "@amerik/contracts";
import { useLocation } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import { createEffect, createSignal, createUniqueId, For, Show } from "solid-js";
import { css } from "styled-system/css";
import HouseFillIcon from "~icons/ph/house-fill";
import HouseIcon from "~icons/ph/house";
import PillFillIcon from "~icons/ph/pill-fill";
import PillIcon from "~icons/ph/pill";
import ReceiptFillIcon from "~icons/ph/receipt-fill";
import ReceiptIcon from "~icons/ph/receipt";
import WarningIcon from "~icons/ph/warning-circle-fill";

import { button, press } from "./styles";

export type Icon = (props: JSX.SvgSVGAttributes<SVGSVGElement>) => JSX.Element;

/** Clears the iPhone status bar when the page runs full screen. */
export const top = css.raw({ pt: "calc(env(safe-area-inset-top) + 14px)" });

export const muted = css.raw({ color: "inkMuted" });

export const sub = css.raw({ textStyle: "subhead", color: "inkMuted" });

export const section = css.raw({ px: "20px", mt: "34px" });

export const sectionHead = css.raw({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  mb: "14px",
});

// No fill mode: a kept final opacity would override the pending dim on the orders list.
export const appear = css.raw({
  animation: "appear .25s ease-out",
  _motionReduce: { animation: "none" },
});

export const spinner = css.raw({
  flex: "none",
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  border: "3px solid {colors.line}",
  borderTopColor: "ink",
  animation: "spin 0.9s linear infinite",
  _motionReduce: { animation: "none" },
});

/** A white section on the cream. Rows inside it are split by `hairline`. */
export const panel = css.raw({
  bg: "card",
  borderRadius: "14px",
  boxShadow: "card",
  overflow: "hidden",
});

/** A 1px line between two rows of a panel, inset from the left like iOS lists. */
export const hairline = css.raw({
  position: "relative",
  "& + &": {
    _before: {
      content: '""',
      position: "absolute",
      zIndex: 1,
      top: 0,
      left: "16px",
      right: 0,
      height: "1px",
      bg: "line",
    },
  },
});

/** A panel's bold title, above it on the cream. */
export const groupHead = css.raw({
  display: "flex",
  alignItems: "baseline",
  gap: "8px",
  mt: "20px",
  mb: "8px",
  mx: "2px",
  textStyle: "headline",
  fontWeight: "700",
  "& small": { ml: "auto", textStyle: "subhead", fontWeight: "500", color: "inkMuted" },
});

/** Content scrolls under it through frosted material. */
const frosted = css.raw({
  bg: "page/84",
  backdropFilter: "blur(16px) saturate(160%)",
});

export const glassBar = css.raw(frosted, {
  position: "sticky",
  top: 0,
  zIndex: 5,
  px: "14px",
  pt: "calc(env(safe-area-inset-top) + 8px)",
  pb: "8px",
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
  bg: "card",
  borderRadius: "12px",
  boxShadow: "inset 0 0 0 1px {colors.line}",
  px: "14px",
  py: "12px",
  textStyle: "body",
  color: "ink",
  outline: "none",
  _focus: { boxShadow: "inset 0 0 0 2px {colors.ink}" },
});

export const searchBox = css.raw({
  height: "42px",
  borderRadius: "12px",
  bg: "fill",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  px: "12px",
  color: "inkMuted",
  "& svg": { fontSize: "18px", flex: "none" },
  "& input": {
    flex: 1,
    minWidth: 0,
    bg: "transparent",
    outline: "none",
    color: "ink",
    textStyle: "body",
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
          borderRadius: "12px",
          bg: "waitBg",
          color: "waitInk",
          textStyle: "subhead",
          fontWeight: "600",
          textAlign: "left",
          "& svg": { fontSize: "19px", color: "wait", flex: "none" },
        },
        props.large && { textStyle: "body", px: "14px", py: "12px" },
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
  height: "26px",
  px: "10px",
  borderRadius: "13px",
  textStyle: "footnote",
  fontWeight: "600",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  "& svg": { fontSize: "14px" },
});

export const tones = {
  owe: css.raw({ bg: "oweBg", color: "owe" }),
  ok: css.raw({ bg: "okBg", color: "ok" }),
  wait: css.raw({ bg: "waitBg", color: "wait" }),
  neutral: css.raw({ bg: "fill", color: "ink" }),
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
        height: "44px",
        p: "3px",
        borderRadius: "12px",
        bg: "fill",
      })}
    >
      <span
        class={css({
          position: "absolute",
          top: "3px",
          bottom: "3px",
          left: "3px",
          borderRadius: "9px",
          bg: "card",
          boxShadow: "card",
          transition: "transform 250ms {easings.move}",
          _motionReduce: { transition: "none" },
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
                textStyle: "body",
                fontWeight: "600",
                color: "inkMuted",
                cursor: "pointer",
                transition: "color .2s ease",
                "& svg": { fontSize: "18px" },
                "&:has(:focus-visible)": {
                  outline: "2px solid {colors.ink}",
                  outlineOffset: "-2px",
                  borderRadius: "9px",
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
        <p class={css({ pb: "12px", color: "owe", textStyle: "subhead", textAlign: "center" })}>
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
        class={button({ tone: "butter", wide: true })}
      >
        {props.children}
      </button>
    </>
  );
}

/** Copies text for a Messenger chat; `copied` holds for 2 seconds after each copy. */
export const createCopied = () => {
  // Every copy notifies, so a second one within 2 seconds restarts the timer.
  // A browser that refuses the clipboard says so instead of doing nothing.
  const [copied, setCopied] = createSignal<"copied" | "failed" | undefined>(undefined, {
    equals: false,
  });

  createEffect(copied, (state) => {
    if (state === undefined) return;

    const reset = setTimeout(() => setCopied(undefined), 2000);

    return () => clearTimeout(reset);
  });

  const copy = (text: string) =>
    navigator.clipboard.writeText(text).then(
      () => setCopied("copied"),
      () => setCopied("failed"),
    );

  return { copied, copy };
};

/** A failed read, or an expired session. */
export function Problem(props: { error: unknown }) {
  const unauthorized = () => props.error instanceof Unauthorized;

  return (
    <div class={css(panel, { m: "16px", p: "20px", display: "grid", gap: "14px" })}>
      <Show when={unauthorized()} fallback={<p>Ачаалж чадсангүй. Дахин оролдоно уу.</p>}>
        <p>Дахин нэвтэрнэ үү.</p>
        <a href="/login" class={button({ tone: "butter" })}>
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
        borderRadius: "20px 20px 0 0",
        boxShadow: "0 -8px 30px oklch(0.2 0.02 60 / .12)",
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
            bg: "line",
          },
        })}
      />
      <h2 class={css({ textStyle: "headline", pt: "6px", pb: "18px" })}>{props.title}</h2>
      <Show when={props.prompt}>{(prompt) => <div class={css(sheetPrompt)}>{prompt()}</div>}</Show>
      {props.children}
    </dialog>
  );
}

export function Dock(props: { children: JSX.Element }) {
  return (
    <div
      class={css(frosted, {
        position: "fixed",
        zIndex: 10,
        left: 0,
        right: 0,
        bottom: 0,
        display: "grid",
        gap: "10px",
        // On a wide screen the buttons keep to the page's 640px column.
        px: "max(16px, calc((100% - 608px) / 2))",
        pt: "12px",
        pb: "calc(env(safe-area-inset-bottom) + 16px)",
      })}
    >
      {props.children}
    </div>
  );
}

const tab = css.raw({
  flex: 1,
  borderRadius: "999px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "2px",
  fontSize: "12px",
  fontWeight: "600",
  color: "ink/72",
  "& svg": { fontSize: "22px" },
});

const activeTab = css.raw({ bg: "butter", color: "ink" });

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
        left: "12px",
        right: "12px",
        bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        maxWidth: "480px",
        mx: "auto",
        height: "62px",
        borderRadius: "999px",
        display: "flex",
        gap: "4px",
        p: "6px",
        bg: "card/82",
        backdropFilter: "blur(18px) saturate(170%)",
        boxShadow: "float",
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
