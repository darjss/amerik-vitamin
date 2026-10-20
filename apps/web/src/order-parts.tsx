import type { OrderDetail } from "@amerik/contracts";
import * as Effect from "effect/Effect";
import { createMemo, createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import BankIcon from "~icons/ph/bank";
import CheckIcon from "~icons/ph/check-bold";
import MoneyIcon from "~icons/ph/money";

import { ApiClient } from "./api/client";
import { runEffect } from "./api/solid-effect";
import { Sheet } from "./chrome";
import { money } from "./format";
import { act, button, field, large, Pill, Segmented, sub } from "./ui";

type Order = typeof OrderDetail.Type;

// Pieces of the order page: the step tracker, the phone's order count and the two form sheets.

/** COD is paid at the door, so its payment step comes last. */
const steps = (order: Order) => {
  const placed = { label: "Захиалсан", done: true };
  const paid = { label: "Төлсөн", done: order.paid > 0 && order.balance <= 0 };

  const shipped = {
    label: "Илгээсэн",
    done: order.status === "shipped" || order.status === "delivered",
  };

  const delivered = { label: "Хүргэгдсэн", done: order.status === "delivered" };

  return order.terms === "cod"
    ? [placed, shipped, delivered, paid]
    : [placed, paid, shipped, delivered];
};

/** Four steps across the top; done ones fill teal, the next one is ringed. */
export function Tracker(props: { order: Order }) {
  const nextIndex = () => steps(props.order).findIndex((step) => !step.done);

  return (
    <ol
      class={css({
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        mx: "20px",
        mt: "26px",
      })}
    >
      <For each={steps(props.order)}>
        {(step, at) => (
          <li
            class={css(
              {
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                fontWeight: "600",
                textAlign: "center",
                color: "inkMuted",
                _before: {
                  content: '""',
                  position: "absolute",
                  top: "12.5px",
                  right: "50%",
                  width: "100%",
                  height: "3px",
                  borderRadius: "2px",
                  bg: "#e1d9cb",
                },
                _first: { _before: { display: "none" } },
              },
              step.done && { color: "ink", _before: { bg: "sel" } },
              at() === nextIndex() && { color: "sel" },
            )}
          >
            <span
              class={css(
                {
                  position: "relative",
                  zIndex: 1,
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  bg: "page",
                  boxShadow: "inset 0 0 0 2px #d9d1c3",
                  fontSize: "15px",
                },
                step.done && { bg: "sel", boxShadow: "none", color: "white" },
                at() === nextIndex() && {
                  boxShadow: "inset 0 0 0 2px {colors.sel}",
                  _after: {
                    content: '""',
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    bg: "sel",
                  },
                },
              )}
            >
              <Show when={step.done}>
                <CheckIcon />
              </Show>
            </span>
            {step.label}
          </li>
        )}
      </For>
    </ol>
  );
}

/** How many orders this phone has placed; a tap lists them. */
export function History(props: { phone: string }) {
  const orders = createMemo(() => {
    const digits = props.phone;

    return runEffect(
      ApiClient.use((api) => api.findCustomer({ phone: digits })).pipe(
        Effect.map((customer) => customer.orders),
        Effect.orElseSucceed(() => 0),
      ),
    );
  });

  return (
    <Show when={orders() > 1}>
      <a
        href={`/orders?view=all&q=${props.phone}`}
        class={css({ display: "inline-block", mt: "6px" })}
      >
        <Pill tone="soft">Нийт {orders()} захиалга</Pill>
      </a>
    </Show>
  );
}

export function PaySheet(props: {
  open: boolean;
  balance: number;
  busy: boolean;
  onClose: () => void;
  onSave: (amount: number, method: "cash" | "transfer") => void;
}) {
  const [method, setMethod] = createSignal<"cash" | "transfer">("cash");
  const [typed, setTyped] = createSignal<string>();
  const amount = () => Number((typed() ?? String(props.balance)).replaceAll(/\D/gu, ""));

  return (
    <Sheet open={props.open} title="Мөнгө авсан" onClose={() => props.onClose()}>
      <Segmented
        options={[
          ["cash", "Бэлэн", MoneyIcon],
          ["transfer", "Шилжүүлэг", BankIcon],
        ]}
        value={method()}
        onChange={setMethod}
      />
      <label class={css({ display: "block", pt: "16px", pb: "18px" })}>
        <span class={css(sub, { display: "block", pb: "6px" })}>Дүн, ₮</span>
        <input
          inputmode="numeric"
          value={(typed() ?? String(props.balance)).replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}
          onInput={(event) => setTyped(event.currentTarget.value)}
          class={css(field, {
            fontSize: "24px",
            fontWeight: "700",
            fontVariantNumeric: "tabular-nums",
          })}
        />
      </label>
      <button
        type="button"
        disabled={props.busy || amount() <= 0}
        onClick={() => props.onSave(amount(), method())}
        class={css(button, act, large, { width: "100%" })}
      >
        {money(amount())} бүртгэх
      </button>
    </Sheet>
  );
}

/** Address and note change until the parcel leaves. */
export function EditSheet(props: {
  open: boolean;
  order: Order;
  busy: boolean;
  onClose: () => void;
  onSave: (address: string, notes: string) => void;
}) {
  const [address, setAddress] = createSignal<string>();
  const [notes, setNotes] = createSignal<string>();

  return (
    <Sheet open={props.open} title="Хаяг, тэмдэглэл" onClose={() => props.onClose()}>
      <label class={css({ display: "block", pb: "14px" })}>
        <span class={css(sub, { display: "block", pb: "6px" })}>Хаяг</span>
        <textarea
          rows={3}
          value={address() ?? props.order.address ?? ""}
          onInput={(event) => setAddress(event.currentTarget.value)}
          class={css(field, { resize: "none" })}
        />
      </label>
      <label class={css({ display: "block", pb: "18px" })}>
        <span class={css(sub, { display: "block", pb: "6px" })}>Тэмдэглэл</span>
        <input
          value={notes() ?? props.order.notes ?? ""}
          onInput={(event) => setNotes(event.currentTarget.value)}
          class={css(field)}
        />
      </label>
      <button
        type="button"
        disabled={props.busy}
        onClick={() =>
          props.onSave(address() ?? props.order.address ?? "", notes() ?? props.order.notes ?? "")
        }
        class={css(button, act, large, { width: "100%" })}
      >
        Хадгалах
      </button>
    </Sheet>
  );
}
