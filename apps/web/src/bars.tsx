import { useLocation } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import { createEffect, For, Loading, Show } from "solid-js";
import { css } from "styled-system/css";
import CaretLeftIcon from "~icons/ph/caret-left-bold";
import MoreIcon from "~icons/ph/dots-three-bold";
import HouseFillIcon from "~icons/ph/house-fill";
import HouseIcon from "~icons/ph/house";
import PillFillIcon from "~icons/ph/pill-fill";
import PillIcon from "~icons/ph/pill";
import ReceiptFillIcon from "~icons/ph/receipt-fill";
import ReceiptIcon from "~icons/ph/receipt";

import { press, round } from "./styles";
import { frosted, glassBar } from "./ui";
import type { Icon } from "./ui";

/** A pushed page's bar: ‹ back to where she came from, the page's name, and ⋯. */
export function NavBar(props: {
  back: string;
  backLabel: string;
  title: JSX.Element;
  onMore: () => void;
}) {
  return (
    <header
      class={css(glassBar, {
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        px: "6px",
        pb: "2px",
      })}
    >
      <a
        href={props.back}
        class={css(press, {
          justifySelf: "start",
          display: "inline-flex",
          alignItems: "center",
          gap: "2px",
          height: "44px",
          px: "8px",
          textStyle: "headline",
          fontWeight: "600",
          "& svg": { fontSize: "20px" },
        })}
      >
        <CaretLeftIcon />
        {props.backLabel}
      </a>
      <b class={css({ textStyle: "headline", fontWeight: "700" })}>{props.title}</b>
      <button
        type="button"
        aria-label="Бусад үйлдэл"
        onClick={() => props.onMore()}
        class={css(round.raw(), { justifySelf: "end", bg: "transparent" })}
      >
        <MoreIcon />
      </button>
    </header>
  );
}

/**
 * A list's search and tabs, held on top while she scrolls. Content scrolls
 * under it and under the status bar's strip when she runs it full screen.
 */
export function StickyBar(props: { children: JSX.Element }) {
  return (
    <>
      <div
        class={css(frosted, {
          position: "fixed",
          zIndex: 4,
          top: 0,
          left: 0,
          right: 0,
          height: "env(safe-area-inset-top)",
        })}
      />
      <div
        class={css(frosted, {
          position: "sticky",
          zIndex: 4,
          top: "env(safe-area-inset-top)",
          mx: "-16px",
          px: "16px",
          pt: "2px",
        })}
      >
        {props.children}
      </div>
    </>
  );
}

/** Scrolls the strip just enough that the chosen tab and its padding show whole. */
const reveal = (strip: HTMLElement) => {
  const chosen = strip.querySelector<HTMLElement>("[aria-current]");

  if (chosen === null) return;

  const pad = 16;
  const start = chosen.offsetLeft - pad;
  const end = chosen.offsetLeft + chosen.offsetWidth + pad - strip.clientWidth;

  strip.scrollLeft = Math.min(Math.max(strip.scrollLeft, end), start);
};

/** Underline tabs that spread when they fit and scroll sideways when they don't. */
export function Tabs(props: { current: string; children: JSX.Element }) {
  let strip: HTMLElement | undefined;

  createEffect(
    () => props.current,
    () => {
      if (strip) reveal(strip);
    },
  );

  return (
    <nav
      ref={(element) => {
        strip = element;
      }}
      class={css({
        position: "relative",
        display: "flex",
        gap: "18px",
        mx: "-16px",
        px: "16px",
        mt: "4px",
        overflowX: "auto",
        scrollbarWidth: "none",
        boxShadow: "inset 0 -1px 0 {colors.line}",
      })}
    >
      {props.children}
    </nav>
  );
}

const countTones = {
  owe: css.raw({ "& em": { color: "owe" } }),
  wait: css.raw({ "& em": { color: "wait" } }),
};

/** One tab with its count inline; the count waits for its read without holding the tab. */
export function Tab(props: {
  href: string;
  current: boolean;
  label: string;
  count?: number;
  tone?: keyof typeof countTones;
}) {
  return (
    <a
      href={props.href}
      aria-current={props.current ? "page" : undefined}
      class={css(
        {
          position: "relative",
          flex: "1 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          height: "44px",
          textStyle: "subhead",
          fontWeight: "600",
          whiteSpace: "nowrap",
          color: "inkMuted",
          transition: "color 150ms ease",
          "& em": { fontStyle: "normal", fontVariantNumeric: "tabular-nums" },
          "&[aria-current]": {
            color: "ink",
            _after: {
              content: '""',
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "3px",
              borderRadius: "3px 3px 0 0",
              bg: "ink",
            },
          },
        },
        props.tone && countTones[props.tone],
      )}
    >
      {props.label}
      <Loading fallback={null}>
        <Show when={props.count}>{(count) => <em>{count()}</em>}</Show>
      </Loading>
    </a>
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
