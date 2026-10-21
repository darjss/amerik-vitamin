import type { OrderId, OrderStatus, PaymentTerms } from "@amerik/contracts";
import * as Exit from "effect/Exit";
import { action, createContext, createOptimisticStore, createStore, useContext } from "solid-js";

import { ApiClient } from "./api/client";
import { RuntimeContext } from "./api/solid-effect";
import { failureText, offline } from "./format";

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
