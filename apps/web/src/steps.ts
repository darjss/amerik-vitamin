import type { OrderId, OrderStatus, PaymentTerms } from "@amerik/contracts";
import { createContext, createStore } from "solid-js";

import { ApiClient } from "./api/client";

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
 * a held step running.
 */
export const createHeldSteps = () => {
  const [held, setHeld] = createStore<Record<OrderId, number>>({});
  const timers = new Map<OrderId, ReturnType<typeof setInterval>>();

  const release = (orderId: OrderId) => {
    clearInterval(timers.get(orderId));
    timers.delete(orderId);
    setHeld((draft) => {
      delete draft[orderId];
    });
  };

  const hold = (orderId: OrderId, run: () => Promise<void>) => {
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

        release(orderId);
        void run();
      }, 1000),
    );
  };

  return { secondsLeft: (orderId: OrderId) => held[orderId], hold, release };
};

export const HeldSteps = createContext<ReturnType<typeof createHeldSteps>>();
