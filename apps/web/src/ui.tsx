import { Unauthorized } from "@amerik/contracts";
import type { OrderSummary } from "@amerik/contracts";
import { useLocation } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import { createEffect, For, Show, useContext } from "solid-js";
import { css } from "styled-system/css";
import CheckIcon from "~icons/ph/check-circle-fill";
import HouseFillIcon from "~icons/ph/house-fill";
import HouseIcon from "~icons/ph/house";
import PackageFillIcon from "~icons/ph/package-fill";
import PackageIcon from "~icons/ph/package";
import PillFillIcon from "~icons/ph/pill-fill";
import PillIcon from "~icons/ph/pill";
import TruckIcon from "~icons/ph/truck";
import CloseIcon from "~icons/ph/x";

import { RuntimeContext } from "./api/solid-effect";
import { money } from "./format";
import { advance, HeldSteps, nextStep } from "./steps";
import type { Step } from "./steps";
import { Zoom } from "./zoom";
import type { Product } from "./zoom";

type Order = typeof OrderSummary.Type;

type Line = Order["lines"][number];

/** A full-width section: lists run edge to edge, with page color between sections. */
export const block = css.raw({
  bg: "surface",
  borderTop: "1px solid {colors.line}",
  borderBottom: "1px solid {colors.line}",
  mb: "8px",
});

export const blockTitle = css.raw({
  fontSize: "17px",
  lineHeight: "22px",
  fontWeight: "600",
  px: "16px",
  pt: "14px",
  pb: "8px",
});

/** Clears the iPhone status bar when the page runs full screen, and a little air otherwise. */
export const top = css.raw({ pt: "calc(env(safe-area-inset-top) + 12px)" });

export const muted = css.raw({ color: "inkMuted" });

export const button = css.raw({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  height: "44px",
  borderRadius: "12px",
  px: "16px",
  fontWeight: "600",
  fontSize: "15px",
  whiteSpace: "nowrap",
  bg: "surface",
  border: "1px solid {colors.line}",
  color: "ink",
  cursor: "pointer",
  _disabled: { opacity: 0.45 },
  "& svg": { fontSize: "18px" },
});

/** The one main action on a screen. */
export const darkButton = css.raw({
  bg: "ink",
  borderColor: "ink",
  color: "surface",
  // Not ready yet reads as a quiet hint, not a grayed-out ink.
  _disabled: { opacity: 1, bg: "chip", borderColor: "chip", color: "inkMuted" },
});

/** A round icon button: call, copy. */
export const circle = css.raw({
  width: "44px",
  height: "44px",
  borderRadius: "50%",
  border: "1px solid {colors.line}",
  color: "ink",
  display: "grid",
  placeItems: "center",
  flex: "none",
  cursor: "pointer",
  "& svg": { fontSize: "20px" },
});

/** One choice out of a few, as an iOS segmented control. */
export function Segmented<T extends string>(props: {
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div class={css({ display: "flex", p: "3px", gap: "3px", borderRadius: "12px", bg: "chip" })}>
      <For each={props.options}>
        {([value, label]) => (
          <button
            type="button"
            aria-pressed={props.value === value ? "true" : "false"}
            onClick={() => props.onChange(value)}
            class={css(
              {
                flex: 1,
                height: "38px",
                borderRadius: "9px",
                fontSize: "15px",
                fontWeight: "600",
                color: "inkMuted",
                cursor: "pointer",
              },
              props.value === value && {
                bg: "surface",
                color: "ink",
                boxShadow: "0 1px 3px rgba(42, 29, 22, 0.14)",
              },
            )}
          >
            {label}
          </button>
        )}
      </For>
    </div>
  );
}

export const bigButton = css.raw({ height: "52px", borderRadius: "14px", fontSize: "16px" });

export const field = css.raw({
  width: "100%",
  bg: "surface",
  border: "1px solid {colors.line}",
  borderRadius: "12px",
  px: "12px",
  py: "11px",
  fontSize: "16px",
  color: "ink",
  outline: "none",
  _focus: { borderColor: "ink" },
});

const photoFrame = css.raw({
  position: "relative",
  zIndex: 1,
  flex: "none",
  display: "block",
  bg: "white",
  borderRadius: "12px",
  boxShadow: "hairline",
  p: "4px",
});

/**
 * A product photo at a fixed size. A tap shows it full size and never follows
 * a link around it. The size is an inline style: Panda only builds classes for
 * values written in a css() call.
 */
export function Photo(props: { product: Product; size: number }) {
  const zoom = useContext(Zoom);
  const box = () => ({ width: `${props.size}px`, height: `${props.size}px` });

  return (
    <Show when={props.product.image} fallback={<span class={css(photoFrame)} style={box()} />}>
      {(src) => (
        <button
          type="button"
          aria-label={`${props.product.name} томоор харах`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            zoom(props.product);
          }}
          class={css(photoFrame, { cursor: "zoom-in" })}
          style={box()}
        >
          <img
            src={src()}
            alt={`${props.product.brand} ${props.product.name}`}
            loading="lazy"
            class={css({ width: "100%", height: "100%", objectFit: "contain" })}
          />
        </button>
      )}
    </Show>
  );
}

export const countBadge = css.raw({
  position: "absolute",
  zIndex: 2,
  right: "-6px",
  bottom: "-6px",
  bg: "marigold",
  color: "ink",
  border: "2px solid {colors.surface}",
  borderRadius: "10px",
  fontSize: "13px",
  fontWeight: "700",
  px: "6px",
  lineHeight: "18px",
  fontVariantNumeric: "tabular-nums",
  pointerEvents: "none",
});

/** One photo per product, each with how many of it go in the bag. */
export function PhotoStrip(props: { lines: ReadonlyArray<Line>; size: number }) {
  return (
    <div class={css({ display: "flex", gap: "10px", flexWrap: "wrap" })}>
      <For each={props.lines} keyed={(line) => line.productId}>
        {(line) => (
          <span class={css({ position: "relative", display: "block" })}>
            <Photo product={line()} size={props.size} />
            <Show when={line().quantity > 1}>
              <span class={css(countBadge)}>×{line().quantity}</span>
            </Show>
          </span>
        )}
      </For>
    </div>
  );
}

const pill = css.raw({
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "14px",
  fontWeight: "600",
  borderRadius: "8px",
  px: "8px",
  lineHeight: "26px",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
});

const tones = {
  paid: css.raw({ bg: "paidBg", color: "paid" }),
  owes: css.raw({ bg: "owesBg", color: "owes" }),
  ship: css.raw({ bg: "shipBg", color: "ship" }),
  neutral: css.raw({ bg: "chip", color: "inkMuted" }),
};

export function Pill(props: { tone: keyof typeof tones; children: JSX.Element }) {
  return <span class={css(pill, tones[props.tone])}>{props.children}</span>;
}

/** Paid, or what is still owed and how. */
export function PayPill(props: { order: Pick<Order, "terms" | "paid" | "balance"> }) {
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
        <Pill tone="owes">Авах {money(props.order.balance)}</Pill>
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

export function ShipPill(props: { status: Order["status"] }) {
  return (
    <Pill tone={props.status === "new" || props.status === "paid" ? "ship" : "neutral"}>
      {shipText[props.status]}
    </Pill>
  );
}

/**
 * A row's next step. A tap holds it for 5 seconds as [Болих N] with a bar
 * draining under it, then writes; `onDone` reloads the list either way.
 */
export function StepButton(props: {
  order: Pick<Order, "id" | "status" | "terms">;
  onDone: () => void;
}) {
  const runtime = useContext(RuntimeContext);
  const { hold, release, secondsLeft } = useContext(HeldSteps);

  const start = (orderId: Order["id"], step: Step) =>
    hold(orderId, () =>
      runtime.runPromise(advance(orderId, step)).then(
        () => props.onDone(),
        () => props.onDone(),
      ),
    );

  return (
    <Show when={nextStep(props.order)}>
      {(next) => (
        <Show
          when={secondsLeft(props.order.id)}
          fallback={
            <button
              type="button"
              class={css(button, { position: "relative", zIndex: 1 })}
              onClick={() => start(props.order.id, next().step)}
            >
              <TruckIcon />
              {next().label}
            </button>
          }
        >
          {(left) => (
            <button
              type="button"
              class={css(button, {
                position: "relative",
                zIndex: 1,
                overflow: "hidden",
                bg: "surface",
                boxShadow: "inset 0 0 0 1.5px {colors.ink}",
                fontVariantNumeric: "tabular-nums",
              })}
              onClick={() => release(props.order.id)}
            >
              Болих {left()}
              <span
                class={css({
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  height: "4px",
                  bg: "marigold",
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

/** A bottom sheet on the native dialog: Escape, the backdrop and × close it. */
export function Sheet(props: {
  open: boolean;
  title: string;
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
        bg: "surface",
        border: "none",
        borderRadius: "20px 20px 0 0",
        p: "0 16px calc(env(safe-area-inset-bottom) + 20px)",
        "&::backdrop": { bg: "rgba(42, 29, 22, 0.35)" },
      })}
    >
      <div class={css({ display: "flex", alignItems: "center", py: "14px" })}>
        <b class={css({ flex: 1, fontSize: "18px", fontWeight: "600" })}>{props.title}</b>
        <button
          type="button"
          aria-label="Хаах"
          onClick={() => dialog?.close()}
          class={css({ fontSize: "22px", p: "6px", cursor: "pointer" })}
        >
          <CloseIcon />
        </button>
      </div>
      {props.children}
    </dialog>
  );
}

const tab = css.raw({
  flex: 1,
  textAlign: "center",
  fontSize: "11px",
  lineHeight: "14px",
  color: "inkMuted",
  "& svg": { display: "block", fontSize: "25px", mx: "auto", mb: "2px" },
});

// The active tab's icon sits on a marigold pill.
const activeTab = css.raw({
  color: "ink",
  fontWeight: "600",
  "& svg": {
    width: "56px",
    height: "30px",
    px: "15px",
    py: "3px",
    borderRadius: "15px",
    bg: "marigold",
  },
});

export function TabBar() {
  const location = useLocation();

  const at = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <nav
      class={css({
        position: "fixed",
        // Above photo buttons, which sit at zIndex 1 over their row link.
        zIndex: 10,
        left: 0,
        right: 0,
        bottom: 0,
        height: "84px",
        bg: "surface",
        borderTop: "1px solid {colors.line}",
        display: "flex",
        pt: "8px",
      })}
    >
      <a href="/" class={css(tab, at("/") && activeTab)}>
        <Show when={at("/")} fallback={<HouseIcon />}>
          <HouseFillIcon />
        </Show>
        Нүүр
      </a>
      <a href="/orders" class={css(tab, at("/orders") && activeTab)}>
        <Show when={at("/orders")} fallback={<PackageIcon />}>
          <PackageFillIcon />
        </Show>
        Захиалга
      </a>
      <a href="/products" class={css(tab, at("/products") && activeTab)}>
        <Show when={at("/products")} fallback={<PillIcon />}>
          <PillFillIcon />
        </Show>
        Бараа
      </a>
    </nav>
  );
}

/** A failed read, or an expired session. */
export function Problem(props: { error: unknown }) {
  const unauthorized = () => props.error instanceof Unauthorized;

  return (
    <div class={css(block, { p: "16px" })}>
      <Show when={unauthorized()} fallback={<p>Ачаалж чадсангүй. Дахин оролдоно уу.</p>}>
        <a href="/login" class={css(button, darkButton)}>
          Дахин нэвтрэх
        </a>
      </Show>
    </div>
  );
}
