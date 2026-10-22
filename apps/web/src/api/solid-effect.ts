import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import type * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import {
  action,
  createContext,
  createOptimistic,
  createSignal,
  onCleanup,
  refresh,
  useContext,
} from "solid-js";
import type { Refreshable } from "solid-js";

import { failureText, offline } from "../format";
import type { ApiClient } from "./client";

export type AppServices = ApiClient;

export const RuntimeContext = createContext<ManagedRuntime.ManagedRuntime<AppServices, never>>();

export const createRuntime = <R>(layer: Layer.Layer<R>) => {
  const runtime = ManagedRuntime.make(layer);
  onCleanup(() => {
    Effect.runFork(runtime.disposeEffect);
  });

  return runtime;
};

/** Run an Effect as a Solid-consumable async source. Interruptible: if the
 * consuming computation re-runs or disposes before the fiber settles, the
 * fiber is interrupted and finalizers run. The return type stays declared:
 * inferred, the `done` branch's `undefined` would widen every read to `A | undefined`. */
export const runEffect = <A, E>(effect: Effect.Effect<A, E, AppServices>): AsyncIterable<A> => {
  // context resolves at the *reading* computation
  const runtime = useContext(RuntimeContext);

  return {
    [Symbol.asyncIterator]() {
      const fiber = runtime.runFork(effect);
      let yielded = false;
      let closed = false;
      const DONE = { done: true, value: undefined } as const;

      return {
        async next() {
          if (yielded || closed) {
            return DONE;
          }

          const exit = await Effect.runPromise(Fiber.await(fiber));

          if (closed) {
            return DONE;
          }

          if (Exit.isSuccess(exit)) {
            yielded = true;

            return { done: false, value: exit.value };
          }

          closed = true;

          // A pure-interrupt cause means Solid closed the iterator, a normal
          // completion. A mixed cause (interrupt + finalizer defect) must
          // still surface, so this is hasInterruptsOnly, not hasInterrupts.
          if (Cause.hasInterruptsOnly(exit.cause)) {
            return DONE;
          }

          throw Cause.squash(exit.cause);
        },
        async return() {
          // Solid does not await return() before starting the replacement read.
          if (!yielded && !closed) {
            closed = true;
            await Effect.runPromise(Fiber.interrupt(fiber));
          }

          closed = true;

          return DONE;
        },
      };
    },
  };
};

/**
 * One write at a time for a page or a sheet. `busy` holds while it runs and
 * `failed` says why the last one didn't go through. Success runs `done`. Either
 * way `source` reloads to show what changed, unless the network is down and the
 * reload would fail too. It runs to the end even if she leaves the page.
 */
export const createWrite = (options: { source?: Refreshable<unknown>; fallback?: string } = {}) => {
  const runtime = useContext(RuntimeContext);
  const [busy, setBusy] = createOptimistic(false);
  const [failed, setFailed] = createSignal<string>();

  const write = action(async function* write<A, E extends { readonly _tag: string }>(
    effect: Effect.Effect<A, E, AppServices>,
    done: (value: A) => void,
  ) {
    setBusy(true);
    setFailed(undefined);
    const exit = await runtime.runPromiseExit(effect);
    yield;

    if (Exit.isSuccess(exit)) done(exit.value);
    else setFailed(failureText(exit.cause, options.fallback));

    if (options.source !== undefined && (Exit.isSuccess(exit) || !offline(exit.cause))) {
      yield refresh(options.source);
    }
  });

  return { write, busy, failed, setFailed };
};
