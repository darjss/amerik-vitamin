import type { ProductRow } from "@amerik/contracts";
import { For, Show } from "solid-js";
import { css } from "styled-system/css";
import MinusIcon from "~icons/ph/minus-bold";
import PlusIcon from "~icons/ph/plus-bold";

import { money } from "./format";
import { Tile } from "./photos";
import { section, sectionHead, sub } from "./ui";

export function Cart(props: {
  lines: ReadonlyArray<{ product: ProductRow; quantity: number }>;
  subtotal: number;
  fee: number;
  walkIn: boolean;
  onAdd: (product: ProductRow, change: number) => void;
}) {
  return (
    <section class={css(section)}>
      <div class={css(sectionHead)}>
        <h2 class={css({ textStyle: "title3" })}>Сагс</h2>
      </div>
      <Show
        when={props.lines.length > 0}
        fallback={<p class={css(sub)}>Дээрээс бараа сонгоно уу</p>}
      >
        <div class={css({ display: "grid", gap: "14px" })}>
          <For each={props.lines} keyed={(line) => line.product.id}>
            {(line) => (
              <div class={css({ display: "flex", alignItems: "center", gap: "12px" })}>
                <Tile product={line().product} size={52} />
                <div class={css({ flex: 1, minWidth: 0 })}>
                  <div class={css({ textStyle: "headline", fontSize: "16px" })}>
                    {line().product.name}
                  </div>
                  <div class={css(sub, { fontVariantNumeric: "tabular-nums" })}>
                    {money(line().product.price * line().quantity)}
                  </div>
                </div>
                <div
                  class={css({
                    display: "flex",
                    alignItems: "center",
                    flex: "none",
                    height: "44px",
                    borderRadius: "22px",
                    bg: "surface",
                    boxShadow: "raiseSm",
                    "& button": {
                      width: "44px",
                      height: "44px",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "18px",
                      cursor: "pointer",
                    },
                  })}
                >
                  <button
                    type="button"
                    aria-label="Хасах"
                    onClick={() => props.onAdd(line().product, -1)}
                  >
                    <MinusIcon />
                  </button>
                  <b
                    class={css({
                      minWidth: "18px",
                      textAlign: "center",
                      fontWeight: "700",
                      fontVariantNumeric: "tabular-nums",
                    })}
                  >
                    {line().quantity}
                  </b>
                  <button
                    type="button"
                    aria-label="Нэмэх"
                    onClick={() => props.onAdd(line().product, 1)}
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
        <div class={css({ mt: "18px", color: "inkMuted", fontVariantNumeric: "tabular-nums" })}>
          <div class={css({ display: "flex", justifyContent: "space-between", py: "5px" })}>
            <span>Бараа</span>
            <span class={css({ color: "ink", fontWeight: "600" })}>{money(props.subtotal)}</span>
          </div>
          <div class={css({ display: "flex", justifyContent: "space-between", py: "5px" })}>
            <span>{props.walkIn ? "Хүргэлтгүй" : "Хүргэлт"}</span>
            <span class={css({ color: "ink", fontWeight: "600" })}>{money(props.fee)}</span>
          </div>
        </div>
      </Show>
    </section>
  );
}
