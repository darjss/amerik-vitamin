import { useLocation } from "@solidjs/router";
import type { JSX } from "@solidjs/web";
import { createEffect, Show } from "solid-js";
import { css } from "styled-system/css";
import HouseFillIcon from "~icons/ph/house-fill";
import HouseIcon from "~icons/ph/house";
import PillFillIcon from "~icons/ph/pill-fill";
import PillIcon from "~icons/ph/pill";
import ReceiptFillIcon from "~icons/ph/receipt-fill";
import ReceiptIcon from "~icons/ph/receipt";

import { press, title3 } from "./ui";

// The fixed frame around a screen: sheets, the bottom dock and the tab bar.

/** A bottom sheet on the native dialog: Escape, the backdrop and the grabber close it. */
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
        bg: "page",
        color: "ink",
        border: "none",
        borderRadius: "22px 22px 0 0",
        p: "0 20px calc(env(safe-area-inset-bottom) + 20px)",
        "&::backdrop": { bg: "rgba(15,14,12,.45)" },
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
            bg: "rgba(30,27,23,.18)",
          },
        })}
      />
      <h2 class={css(title3, { pt: "6px", pb: "18px" })}>{props.title}</h2>
      {props.children}
    </dialog>
  );
}

/** Fixed to the bottom over a frosted material: the screen's main action. */
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
        bg: "rgba(250,246,239,.92)",
        backdropFilter: "blur(24px) saturate(180%)",
        maskImage: "linear-gradient(transparent, #000 14px)",
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

/** One floating glass capsule over the page. */
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
        bg: "rgba(255,253,249,.88)",
        backdropFilter: "blur(24px) saturate(180%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.85), 0 0 0 .5px rgba(30,27,23,.09), 0 14px 34px -12px rgba(30,27,23,.28)",
      })}
    >
      <a href="/" class={css(press, tab, at("/") && activeTab)}>
        <Show when={at("/")} fallback={<HouseIcon />}>
          <HouseFillIcon />
        </Show>
        Нүүр
      </a>
      <a href="/orders" class={css(press, tab, at("/orders") && activeTab)}>
        <Show when={at("/orders")} fallback={<ReceiptIcon />}>
          <ReceiptFillIcon />
        </Show>
        Захиалга
      </a>
      <a href="/products" class={css(press, tab, at("/products") && activeTab)}>
        <Show when={at("/products")} fallback={<PillIcon />}>
          <PillFillIcon />
        </Show>
        Бараа
      </a>
    </nav>
  );
}
