import type { OrderId, OrderSummary, ProductId } from "@amerik/contracts";
import {
  action,
  createMemo,
  createOptimistic,
  createSignal,
  createStore,
  Errored,
  For,
  Loading,
  Show,
  useContext,
} from "solid-js";
import { css } from "styled-system/css";
import CheckIcon from "~icons/ph/check-circle-fill";
import CircleIcon from "~icons/ph/circle";
import CloseIcon from "~icons/ph/x";
import KeyIcon from "~icons/ph/key";

import { ApiClient } from "../api/client";
import { runEffect, RuntimeContext } from "../api/solid-effect";
import { phone } from "../format";
import { advance } from "../steps";
import { button, card, darkButton, muted, Photo, Problem } from "../ui";

type Order = typeof OrderSummary.Type;

const dock = css.raw({
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  bg: "surface",
  borderTop: "1px solid {colors.line}",
  px: "16px",
  pt: "10px",
  pb: "34px",
  display: "flex",
  gap: "8px",
});

const big = css.raw({ height: "50px", borderRadius: "14px", fontSize: "16px" });

/**
 * The morning's packing, one parcel at a time (PRODUCT.md, Features 2). She
 * ticks each bottle as it goes in the bag; after the last parcel one tap
 * hands every packed one to TU.
 */
export default function Pack() {
  const orders = createMemo(() =>
    runEffect(ApiClient.use((api) => api.listOrders({ queue: "to_ship" }))),
  );

  const [index, setIndex] = createSignal(0);
  const [ticked, setTicked] = createStore<Record<string, boolean>>({});
  const [packed, setPacked] = createSignal<ReadonlyArray<OrderId>>([]);

  const current = () => orders()[index()];

  const tick = (order: Order, productId: ProductId) =>
    setTicked((draft) => {
      draft[`${order.id}:${productId}`] = !draft[`${order.id}:${productId}`];
    });

  const isTicked = (order: Order, productId: ProductId) =>
    ticked[`${order.id}:${productId}`] === true;

  const allTicked = (order: Order) => order.lines.every((line) => isTicked(order, line.productId));

  const next = (order: Order, done: boolean) => {
    if (done) setPacked((ids) => [...ids, order.id]);
    setIndex((at) => at + 1);
  };

  return (
    <main class={css({ pb: "110px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(card, { height: "300px", mt: "100px" })} />}>
          <div
            class={css({
              display: "flex",
              alignItems: "center",
              gap: "12px",
              px: "16px",
              pt: "56px",
              pb: "12px",
              "& svg": { fontSize: "24px" },
            })}
          >
            <a href="/" aria-label="Хаах">
              <CloseIcon />
            </a>
            <b class={css({ fontSize: "17px" })}>Савлах</b>
            <span class={css(muted, { ml: "auto", fontVariantNumeric: "tabular-nums" })}>
              {Math.min(index() + 1, orders().length)} / {orders().length}
            </span>
          </div>
          <div class={css({ display: "flex", gap: "4px", px: "16px", pb: "16px" })}>
            <For each={orders()} keyed={(order) => order.id}>
              {(order, at) => (
                <span
                  class={css(
                    { flex: 1, height: "4px", borderRadius: "2px", bg: "line" },
                    at() < index() && { bg: "clay" },
                  )}
                  title={`#${order().number}`}
                />
              )}
            </For>
          </div>

          <Show
            when={current()}
            fallback={<Hand packed={packed()} skipped={orders().length - packed().length} />}
          >
            {(order) => (
              <>
                <section class={css({ px: "16px", pb: "14px" })}>
                  <h1
                    class={css({
                      fontSize: "24px",
                      lineHeight: "30px",
                      fontWeight: "700",
                      fontVariantNumeric: "tabular-nums",
                    })}
                  >
                    <Show when={order().customerPhone} fallback="Утасгүй">
                      {(digits) => phone(digits())}
                    </Show>{" "}
                    <span class={css(muted, { fontWeight: "400" })}>#{order().number}</span>
                  </h1>
                  <p class={css({ mt: "4px" })}>{order().address}</p>
                  <Show when={order().notes}>
                    {(notes) => (
                      <p
                        class={css({
                          mt: "10px",
                          bg: "surface",
                          borderRadius: "10px",
                          px: "10px",
                          py: "8px",
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                          fontSize: "14px",
                          boxShadow: "hairline",
                        })}
                      >
                        <KeyIcon />
                        {notes()}
                      </p>
                    )}
                  </Show>
                </section>

                <div class={css(card)}>
                  <For each={order().lines} keyed={(line) => line.productId}>
                    {(line) => (
                      <div
                        class={css(
                          {
                            display: "flex",
                            gap: "12px",
                            alignItems: "center",
                            pl: "12px",
                            "& + &": { borderTop: "1px solid {colors.line}" },
                          },
                          isTicked(order(), line().productId) && { bg: "paidBg" },
                        )}
                      >
                        {/* Siblings, not nested: the photo zooms, the rest of the row ticks. */}
                        <Photo
                          product={line()}
                          styles={{
                            width: "84px",
                            height: "84px",
                            borderRadius: "14px",
                            boxShadow: "hairline",
                            flex: "none",
                          }}
                        />
                        <button
                          type="button"
                          aria-pressed={isTicked(order(), line().productId) ? "true" : "false"}
                          onClick={() => tick(order(), line().productId)}
                          class={css({
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            gap: "12px",
                            alignItems: "center",
                            pr: "12px",
                            py: "18px",
                            textAlign: "left",
                            cursor: "pointer",
                          })}
                        >
                          <span class={css({ flex: 1, minWidth: 0 })}>
                            <b class={css({ display: "block", fontSize: "16px" })}>{line().name}</b>
                            <small class={css(muted, { display: "block", fontSize: "14px" })}>
                              {line().brand} · {line().count} ш
                            </small>
                          </span>
                          <b class={css({ fontSize: "24px", fontVariantNumeric: "tabular-nums" })}>
                            ×{line().quantity}
                          </b>
                          <span class={css({ fontSize: "28px", color: "paid", display: "flex" })}>
                            <Show
                              when={isTicked(order(), line().productId)}
                              fallback={<CircleIcon class={css({ color: "line" })} />}
                            >
                              <CheckIcon />
                            </Show>
                          </span>
                        </button>
                      </div>
                    )}
                  </For>
                </div>

                <div class={css(dock)}>
                  <button
                    type="button"
                    onClick={() => next(order(), false)}
                    class={css(button, big, { px: "18px" })}
                  >
                    Алгасах
                  </button>
                  <button
                    type="button"
                    disabled={!allTicked(order())}
                    onClick={() => next(order(), true)}
                    class={css(button, darkButton, big, { flex: 1 })}
                  >
                    Савласан
                  </button>
                </div>
              </>
            )}
          </Show>
        </Loading>
      </Errored>
    </main>
  );
}

/** The end of the pass: every packed parcel goes to TU in one tap. */
function Hand(props: { packed: ReadonlyArray<OrderId>; skipped: number }) {
  const runtime = useContext(RuntimeContext);
  const [busy, setBusy] = createOptimistic(false);
  const [result, setResult] = createSignal<{ sent: number; failed: number }>();

  // Runs to the last parcel even if she leaves the page.
  const handAll = action(function* handAll(ids: ReadonlyArray<OrderId>) {
    setBusy(true);
    let sent = 0;

    for (const id of ids) {
      try {
        yield runtime.runPromise(advance(id, "ship"));
        sent += 1;
      } catch {
        // Counted below; the order stays in Илгээх for another try.
      }
    }

    setResult({ sent, failed: ids.length - sent });
  });

  return (
    <section class={css({ px: "16px", pt: "24px", textAlign: "center" })}>
      <Show
        when={result()}
        fallback={
          <>
            <h1 class={css({ fontSize: "24px", lineHeight: "30px", fontWeight: "700" })}>
              {props.packed.length} илгээмж савласан
            </h1>
            <Show when={props.skipped > 0}>
              <p class={css(muted, { mt: "8px" })}>
                {props.skipped} алгассан. Илгээх жагсаалтад үлдэнэ.
              </p>
            </Show>
            <Show when={props.packed.length > 0}>
              <div class={css(dock)}>
                <button
                  type="button"
                  disabled={busy()}
                  onClick={() => handAll(props.packed)}
                  class={css(button, darkButton, big, { flex: 1 })}
                >
                  {props.packed.length} илгээмжийг TU-д өгөх
                </button>
              </div>
            </Show>
          </>
        }
      >
        {(done) => (
          <>
            <h1 class={css({ fontSize: "24px", lineHeight: "30px", fontWeight: "700" })}>
              {done().sent} илгээмж TU-д өглөө
            </h1>
            <Show when={done().failed > 0}>
              <p class={css({ color: "owes", mt: "8px" })}>
                {done().failed} нь болсонгүй. Захиалга дотроос дахин оролдоно уу.
              </p>
            </Show>
            <a href="/" class={css(button, darkButton, big, { mt: "24px", px: "28px" })}>
              Нүүр рүү
            </a>
          </>
        )}
      </Show>
    </section>
  );
}
