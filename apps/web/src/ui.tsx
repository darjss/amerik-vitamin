import { Unauthorized } from "@amerik/contracts";
import type { OrderSummary } from "@amerik/contracts";
import { useLocation } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";

import { css, cx } from "styled-system/css";
import CheckIcon from "~icons/ph/check-circle-fill";
import HouseFillIcon from "~icons/ph/house-fill";
import HouseIcon from "~icons/ph/house";
import PackageFillIcon from "~icons/ph/package-fill";
import PackageIcon from "~icons/ph/package";
import PillFillIcon from "~icons/ph/pill-fill";
import PillIcon from "~icons/ph/pill";

import { money } from "./format";

type Order = typeof OrderSummary.Type;

type Line = Order["lines"][number];

export const card = css({
  bg: "surface",
  mx: "12px",
  mb: "12px",
  borderRadius: "16px",
  boxShadow: "card",
  overflow: "hidden",
});

export const cardTitle = css({
  fontSize: "17px",
  fontWeight: "700",
  px: "16px",
  pt: "14px",
  pb: "6px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
});

export const muted = css({ color: "inkMuted" });

export const button = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  borderRadius: "10px",
  px: "13px",
  py: "7px",
  fontWeight: "600",
  fontSize: "14px",
  whiteSpace: "nowrap",
  bg: "chip",
  color: "ink",
  cursor: "pointer",
  _disabled: { opacity: 0.5 },
});

export const darkButton = css({ bg: "espresso", color: "white" });

/** The big page title and its round add button. */
export function Header(props: { title: string; above?: string; children?: JSX.Element }) {
  return (
    <header
      class={css({
        display: "flex",
        alignItems: "center",
        gap: "10px",
        px: "16px",
        pt: "56px",
        pb: "10px",
      })}
    >
      <div class={css({ flex: 1, minWidth: 0 })}>
        <Show when={props.above}>
          {(above) => <small class={cx(muted, css({ fontSize: "13px" }))}>{above()}</small>}
        </Show>
        <h1
          class={css({
            fontSize: "26px",
            lineHeight: "32px",
            fontWeight: "700",
            letterSpacing: "-0.4px",
          })}
        >
          {props.title}
        </h1>
      </div>
      {props.children}
    </header>
  );
}

const pieces = (lines: ReadonlyArray<Line>) =>
  lines.reduce((total, line) => total + line.quantity, 0);

const grids = [
  css({ gridTemplateColumns: "1fr" }),
  css({ gridTemplateColumns: "1fr 1fr" }),
  css({ gridTemplateColumns: "1fr 1fr", "& > img:first-child": { gridRow: "span 2" } }),
];

/** Up to three product photos, with the piece count she has to pack. */
export function Photos(props: { lines: ReadonlyArray<Line> }) {
  const shown = () => props.lines.slice(0, 3);

  return (
    <div class={css({ position: "relative", flex: "none", alignSelf: "flex-start" })}>
      <div
        class={cx(
          css({
            width: "68px",
            height: "68px",
            display: "grid",
            gap: "2px",
            borderRadius: "12px",
            overflow: "hidden",
            bg: "line",
            boxShadow: "hairline",
          }),
          grids[shown().length - 1],
        )}
      >
        <For each={shown()}>
          {(line) => <Photo src={line.image} alt={`${line.brand} ${line.name}`} />}
        </For>
      </div>
      <Show when={pieces(props.lines) > 1}>
        <span class={countBadge}>×{pieces(props.lines)}</span>
      </Show>
    </div>
  );
}

export const countBadge = css({
  position: "absolute",
  left: "-5px",
  bottom: "-5px",
  bg: "clay",
  color: "white",
  border: "2px solid",
  borderColor: "surface",
  borderRadius: "10px",
  fontSize: "11px",
  fontWeight: "700",
  px: "5px",
  lineHeight: "16px",
});

const photo = css({
  width: "100%",
  height: "100%",
  minHeight: 0,
  objectFit: "contain",
  bg: "white",
  p: "3px",
});

export function Photo(props: { src: string | null; alt: string; class?: string }) {
  return (
    <Show when={props.src} fallback={<span class={cx(photo, props.class)} />}>
      {(src) => <img class={cx(photo, props.class)} src={src()} alt={props.alt} loading="lazy" />}
    </Show>
  );
}

const label = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "3px",
  fontSize: "12px",
  fontWeight: "600",
  borderRadius: "6px",
  px: "7px",
  lineHeight: "20px",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
});

const tones = {
  paid: css({ bg: "paidBg", color: "paid" }),
  owes: css({ bg: "owesBg", color: "owes" }),
  ship: css({ bg: "shipBg", color: "ship" }),
  neutral: css({ bg: "chip", color: "inkMuted" }),
};

function Label(props: { tone: keyof typeof tones; children: JSX.Element }) {
  return <span class={cx(label, tones[props.tone])}>{props.children}</span>;
}

/** Paid, or what is still owed and how. */
export function PayLabel(props: {
  order: Pick<Order, "terms" | "status" | "total" | "paid" | "balance">;
}) {
  return (
    <Show
      when={props.order.balance > 0}
      fallback={
        <Show when={props.order.paid > 0}>
          <Label tone="paid">
            <CheckIcon />
            Төлсөн
          </Label>
        </Show>
      }
    >
      <Show when={props.order.terms === "cod"} fallback={<Label tone="owes">Төлбөр хүлээж</Label>}>
        <Label tone="owes">Авах {money(props.order.balance)}</Label>
      </Show>
    </Show>
  );
}

const shipText = {
  new: "Илгээгээгүй",
  paid: "Илгээгээгүй",
  shipped: "Замд",
  delivered: "Хүргэсэн",
  cancelled: "Цуцалсан",
};

export function ShipLabel(props: { status: Order["status"] }) {
  return (
    <Label tone={props.status === "new" || props.status === "paid" ? "ship" : "neutral"}>
      {shipText[props.status]}
    </Label>
  );
}

export const labels = css({ display: "flex", gap: "5px", mt: "6px", flexWrap: "wrap" });

const tab = css({
  flex: 1,
  textAlign: "center",
  fontSize: "11px",
  lineHeight: "14px",
  color: "inkMuted",
  "& svg": { display: "block", fontSize: "25px", mx: "auto", mb: "2px" },
});

const activeTab = css({ color: "clay", fontWeight: "650" });

export function TabBar() {
  const location = useLocation();

  const at = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <nav
      class={css({
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: "84px",
        bg: "surface",
        borderTop: "1px solid",
        borderColor: "line",
        display: "flex",
        pt: "8px",
      })}
    >
      <a href="/" class={cx(tab, at("/") && activeTab)}>
        <Show when={at("/")} fallback={<HouseIcon />}>
          <HouseFillIcon />
        </Show>
        Нүүр
      </a>
      <a href="/orders" class={cx(tab, at("/orders") && activeTab)}>
        <Show when={at("/orders")} fallback={<PackageIcon />}>
          <PackageFillIcon />
        </Show>
        Захиалга
      </a>
      <a href="/products" class={cx(tab, at("/products") && activeTab)}>
        <Show when={at("/products")} fallback={<PillIcon />}>
          <PillFillIcon />
        </Show>
        Бараа
      </a>
    </nav>
  );
}

/** Pending reads, failed reads and an expired session, inside one card. */
export function Problem(props: { error: unknown }) {
  const unauthorized = () => props.error instanceof Unauthorized;

  return (
    <div class={cx(card, css({ p: "16px" }))}>
      <Show when={unauthorized()} fallback={<p>Ачаалж чадсангүй. Дахин оролдоно уу.</p>}>
        <a href="/login" class={cx(button, darkButton)}>
          Дахин нэвтрэх
        </a>
      </Show>
    </div>
  );
}
