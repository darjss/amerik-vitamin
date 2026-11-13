import type {
  ManualPayment,
  OrderDetail,
  OrderId,
  OrderStatus,
  OrderSummary,
  PaymentTerms,
} from "@amerik/contracts";
import * as Exit from "effect/Exit";
import {
  action,
  createContext,
  createOptimisticStore,
  createSignal,
  createStore,
  For,
  Show,
  useContext,
} from "solid-js";
import { css, cx } from "styled-system/css";
import BankIcon from "~icons/ph/bank";
import CheckIcon from "~icons/ph/check-bold";
import CheckCircleIcon from "~icons/ph/check-circle-fill";
import MoneyIcon from "~icons/ph/money";
import TruckIcon from "~icons/ph/truck-bold";

import { ApiClient } from "./api/client";
import { RuntimeContext } from "./api/solid-effect";
import { digits, failureText, money, offline, thousands } from "./format";
import { button } from "./styles";
import { field, Pill, SaveButton, Segmented, Sheet, sub } from "./ui";
import { methodText } from "./words";

/** The one thing to do next: hand it to TU, or confirm it arrived. COMMERCE-RULES. */
export const nextStep = (order: { status: OrderStatus; terms: PaymentTerms }) => {
  if (order.status === "paid" || (order.status === "new" && order.terms === "cod")) {
    return { step: "ship" as const, label: "TU-д өгөх" };
  }

  if (order.status === "shipped") return { step: "deliver" as const, label: "Хүргэгдсэн" };

  return undefined;
};

export type Step = NonNullable<ReturnType<typeof nextStep>>["step"];

export const advance = (orderId: OrderId, step: Step) =>
  ApiClient.use((api) =>
    step === "ship" ? api.markShipped({ orderId }) : api.markDelivered({ orderId }),
  );

const HOLD_SECONDS = 5;

/**
 * Status only moves forward, so a tapped step waits here first and [Болих]
 * drops it before any write. Created once in App, so leaving a page keeps
 * a held step running and its failure in view when she comes back.
 */
export const createHeldSteps = () => {
  const runtime = useContext(RuntimeContext);
  const [held, setHeld] = createStore<Record<OrderId, number>>({});
  const [running, setRunning] = createOptimisticStore<Record<OrderId, boolean>>({});
  const [failures, setFailures] = createStore<Record<OrderId, string>>({});
  const timers = new Map<OrderId, ReturnType<typeof setInterval>>();

  const release = (orderId: OrderId) => {
    clearInterval(timers.get(orderId));
    timers.delete(orderId);
    setHeld((draft) => {
      delete draft[orderId];
    });
  };

  // `running` reverts on its own once the write and the page's reload settle.
  const take = action(async function* take(
    orderId: OrderId,
    step: Step,
    reload: () => Promise<void>,
  ) {
    setRunning((draft) => {
      draft[orderId] = true;
    });

    const exit = await runtime.runPromiseExit(advance(orderId, step));
    yield;

    setFailures((draft) => {
      if (Exit.isFailure(exit)) draft[orderId] = failureText(exit.cause);
      else delete draft[orderId];
    });

    // A reload shows what changed, unless the network is down and it would fail too.
    if (Exit.isSuccess(exit) || !offline(exit.cause)) yield reload();
  });

  const hold = (orderId: OrderId, step: Step, reload: () => Promise<void>) => {
    setFailures((draft) => {
      delete draft[orderId];
    });
    setHeld((draft) => {
      draft[orderId] = HOLD_SECONDS;
    });

    timers.set(
      orderId,
      setInterval(() => {
        const left = (held[orderId] ?? 1) - 1;

        if (left > 0) {
          setHeld((draft) => {
            draft[orderId] = left;
          });

          return;
        }

        // Same tick as `take` marks it running, so the button never comes back in between.
        release(orderId);
        void take(orderId, step, reload);
      }, 1000),
    );
  };

  return {
    secondsLeft: (orderId: OrderId) => held[orderId],
    running: (orderId: OrderId) => running[orderId] === true,
    failure: (orderId: OrderId) => failures[orderId],
    hold,
    release,
  };
};

export const HeldSteps = createContext<ReturnType<typeof createHeldSteps>>();

/**
 * An order's next step in butter. A tap holds it for HOLD_SECONDS as
 * [Болих N] with a bar draining under it, then writes and calls `reload`.
 * It stays disabled while the write runs; a failure shows through
 * `HeldSteps.failure`. `sm` is the compact one on a list row.
 */
export function StepButton(props: {
  order: Pick<OrderSummary, "id" | "status" | "terms">;
  reload: () => Promise<void>;
  size?: "sm";
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
              class={cx(
                button({ tone: "butter", size: props.size, wide: props.wide }),
                css({ position: "relative", zIndex: 1 }),
              )}
              onClick={() => hold(props.order.id, next().step, props.reload)}
            >
              <Show when={next().step === "ship"} fallback={<CheckIcon />}>
                <TruckIcon />
              </Show>
              {next().label}
            </button>
          }
        >
          {(left) => (
            <button
              type="button"
              class={cx(
                button({ size: props.size, wide: props.wide }),
                css({
                  position: "relative",
                  zIndex: 1,
                  overflow: "hidden",
                  fontVariantNumeric: "tabular-nums",
                }),
              )}
              onClick={() => release(props.order.id)}
            >
              Болих {left()}
              <span
                class={css({
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  height: "3px",
                  bg: "ink",
                  transition: "width 1s linear",
                  _motionReduce: { transition: "none" },
                })}
                style={{ width: `${((left() - 1) / HOLD_SECONDS) * 100}%` }}
              />
            </button>
          )}
        </Show>
      )}
    </Show>
  );
}

/**
 * Where the money stands, in a word: paid, collected at the door, or owed
 * before shipping. A cancelled order has none.
 */
export const payment = (order: Pick<OrderSummary, "status" | "terms" | "balance">) => {
  if (order.status === "cancelled") return undefined;

  if (order.balance <= 0) return { text: "Төлсөн", tone: "ok" as const };

  return order.terms === "cod"
    ? { text: "Хүргэлтээр", tone: "wait" as const }
    : { text: "Төлөөгүй", tone: "owe" as const };
};

export function Money(props: { order: Pick<OrderSummary, "terms" | "paid" | "balance"> }) {
  return (
    <Show
      when={props.order.balance > 0}
      fallback={
        <Show when={props.order.paid > 0}>
          <Pill tone="ok">
            <CheckCircleIcon />
            Төлсөн
          </Pill>
        </Show>
      }
    >
      <Show when={props.order.terms === "cod"} fallback={<Pill tone="owe">Төлбөр хүлээж</Pill>}>
        <Pill tone="owe">{money(props.order.balance)}</Pill>
      </Show>
    </Show>
  );
}

/** COD is paid at the door, so its payment stage comes last. */
const stages = (order: OrderDetail) => {
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

/** The order's stages left to right: done in ink, the next one in butter. */
export function Stepper(props: { order: OrderDetail }) {
  const nextIndex = () => stages(props.order).findIndex((stage) => !stage.done);

  return (
    <ol
      class={css({
        display: "grid",
        gridAutoFlow: "column",
        gridAutoColumns: "1fr",
        px: "4px",
        pt: "14px",
        pb: "12px",
      })}
    >
      <For each={stages(props.order)}>
        {(stage, at) => (
          <li
            class={css(
              {
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                textStyle: "footnote",
                textAlign: "center",
                color: "inkMuted",
                _before: {
                  content: '""',
                  position: "absolute",
                  top: "10px",
                  right: "50%",
                  width: "100%",
                  height: "2px",
                  bg: "line",
                },
                _first: { _before: { display: "none" } },
              },
              (stage.done || at() === nextIndex()) && {
                color: "ink",
                fontWeight: "600",
                _before: { bg: "ink" },
              },
            )}
          >
            <span
              class={css(
                {
                  position: "relative",
                  zIndex: 1,
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  bg: "card",
                  boxShadow: "inset 0 0 0 2px {colors.line}",
                  fontSize: "12px",
                },
                stage.done && { bg: "ink", color: "page", boxShadow: "none" },
                at() === nextIndex() && {
                  bg: "butter",
                  boxShadow: "inset 0 0 0 2px {colors.butterEdge}",
                },
              )}
            >
              <Show when={stage.done}>
                <CheckIcon />
              </Show>
            </span>
            {stage.label}
          </li>
        )}
      </For>
    </ol>
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
  const amount = () => Number(digits(typed() ?? String(props.balance)));

  return (
    <Sheet open={props.open} title="Мөнгө авсан" onClose={() => props.onClose()}>
      <Segmented
        options={[
          ["cash", methodText.cash, MoneyIcon],
          ["transfer", methodText.transfer, BankIcon],
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
      <SaveButton
        failed={props.failed}
        disabled={props.busy || amount() <= 0}
        onClick={() => props.onSave(amount(), method())}
      >
        {money(amount())} бүртгэх
      </SaveButton>
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
      <SaveButton
        failed={props.failed}
        disabled={props.busy}
        onClick={() =>
          props.onSave(address() ?? props.order.address ?? "", notes() ?? props.order.notes ?? "")
        }
      >
        Хадгалах
      </SaveButton>
    </Sheet>
  );
}
