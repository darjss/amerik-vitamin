import type { ManualPayment, OrderDetail } from "@amerik/contracts";
import { createSignal, For, Show } from "solid-js";
import { css } from "styled-system/css";
import BankIcon from "~icons/ph/bank";
import CheckIcon from "~icons/ph/check-bold";
import MoneyIcon from "~icons/ph/money";

import { Sheet } from "./chrome";
import { money, thousands } from "./format";
import { act, button, Failed, field, Pill, Segmented, sub, wide } from "./ui";

// Pieces of the order page: the step tracker, the phone's order count and the two form sheets.

/** COD is paid at the door, so its payment step comes last. */
const steps = (order: OrderDetail) => {
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
export function Tracker(props: { order: OrderDetail }) {
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
                  bg: "track",
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
                  boxShadow: "inset 0 0 0 2px {colors.dot}",
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

/** How many orders this phone has placed (from getOrder); a tap lists them. */
export function History(props: { phone: string; orders: number }) {
  return (
    <Show when={props.orders > 1}>
      <a
        href={`/orders?view=all&q=${props.phone}`}
        class={css({ display: "inline-block", mt: "6px" })}
      >
        <Pill tone="soft">Нийт {props.orders} захиалга</Pill>
      </a>
    </Show>
  );
}

export function PaySheet(props: {
  open: boolean;
  balance: number;
  busy: boolean;
  onClose: () => void;
  failed: string | undefined;
  onSave: (amount: number, method: ManualPayment["method"]) => void;
}) {
  const [method, setMethod] = createSignal<ManualPayment["method"]>("cash");
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
          value={thousands(amount())}
          onInput={(event) => setTyped(event.currentTarget.value)}
          class={css(field, {
            fontSize: "24px",
            fontWeight: "700",
            fontVariantNumeric: "tabular-nums",
          })}
        />
      </label>
      <Failed text={props.failed} />
      <button
        type="button"
        disabled={props.busy || amount() <= 0}
        onClick={() => props.onSave(amount(), method())}
        class={css(button, act, wide)}
      >
        {money(amount())} бүртгэх
      </button>
    </Sheet>
  );
}

/** Address and note change until the parcel leaves. */
export function EditSheet(props: {
  open: boolean;
  order: OrderDetail;
  busy: boolean;
  failed: string | undefined;
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
      <Failed text={props.failed} />
      <button
        type="button"
        disabled={props.busy}
        onClick={() =>
          props.onSave(address() ?? props.order.address ?? "", notes() ?? props.order.notes ?? "")
        }
        class={css(button, act, wide)}
      >
        Хадгалах
      </button>
    </Sheet>
  );
}
