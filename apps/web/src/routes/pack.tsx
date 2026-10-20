import type { OrderSummary, ProductId } from "@amerik/contracts";
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
import NoteIcon from "~icons/ph/note-pencil";
import CloseIcon from "~icons/ph/x";

import { ApiClient } from "../api/client";
import { runEffect, RuntimeContext } from "../api/solid-effect";
import { money, phone } from "../format";
import { advance } from "../steps";
import { bigButton, block, button, darkButton, muted, PayPill, Photo, Problem, top } from "../ui";

type Order = typeof OrderSummary.Type;

const dock = css.raw({
  position: "fixed",
  zIndex: 10,
  left: 0,
  right: 0,
  bottom: 0,
  bg: "surface",
  borderTop: "1px solid {colors.line}",
  px: "16px",
  pt: "10px",
  pb: "calc(env(safe-area-inset-bottom) + 14px)",
  display: "flex",
  alignItems: "center",
  gap: "16px",
});

const key = (order: Order, productId: ProductId) => `${order.id}:${productId}`;

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
  const [packed, setPacked] = createSignal<ReadonlyArray<Order>>([]);

  const current = () => orders()[index()];
  const isTicked = (order: Order, productId: ProductId) => ticked[key(order, productId)] === true;
  const allTicked = (order: Order) => order.lines.every((line) => isTicked(order, line.productId));

  const tick = (order: Order, productId: ProductId) =>
    setTicked((draft) => {
      draft[key(order, productId)] = !draft[key(order, productId)];
    });

  const next = (order: Order, done: boolean) => {
    if (done) setPacked((list) => [...list, order]);
    setIndex((at) => at + 1);
  };

  return (
    <main class={css(top, { pb: "120px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(block, { height: "300px", mt: "60px" })} />}>
          <div
            class={css({
              display: "flex",
              alignItems: "center",
              gap: "8px",
              px: "8px",
              pb: "8px",
              "& svg": { fontSize: "24px" },
            })}
          >
            <a href="/" aria-label="Хаах" class={css({ p: "8px" })}>
              <CloseIcon />
            </a>
            <b class={css({ fontSize: "17px", fontWeight: "600" })}>Савлах</b>
            <div class={css({ flex: 1, display: "flex", gap: "4px", px: "8px" })}>
              <For each={orders()} keyed={(order) => order.id}>
                {(order, at) => (
                  <span
                    class={css(
                      { flex: 1, height: "4px", borderRadius: "2px", bg: "line" },
                      at() < index() && { bg: "marigold" },
                      at() === index() && { bg: "ink" },
                    )}
                    title={`#${order().number}`}
                  />
                )}
              </For>
            </div>
          </div>

          <Show when={current()} fallback={<Hand packed={packed()} total={orders().length} />}>
            {(order) => (
              <>
                <section class={css(block, { px: "16px", py: "14px" })}>
                  <div class={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                    <b
                      class={css({
                        flex: 1,
                        fontSize: "22px",
                        fontWeight: "700",
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      <Show when={order().customerPhone} fallback="Утасгүй">
                        {(digits) => phone(digits())}
                      </Show>
                    </b>
                    <PayPill order={order()} />
                  </div>
                  <p class={css({ fontSize: "16px", mt: "4px" })}>{order().address}</p>
                  <Show when={order().notes}>
                    {(notes) => (
                      <p
                        class={css({
                          display: "flex",
                          gap: "8px",
                          alignItems: "flex-start",
                          fontSize: "16px",
                          fontWeight: "600",
                          mt: "8px",
                          "& svg": { flex: "none", mt: "3px" },
                        })}
                      >
                        <NoteIcon />
                        {notes()}
                      </p>
                    )}
                  </Show>
                </section>

                <div class={css(block)}>
                  <For each={order().lines} keyed={(line) => line.productId}>
                    {(line) => (
                      <div
                        class={css(
                          {
                            display: "flex",
                            gap: "14px",
                            alignItems: "center",
                            pl: "16px",
                            py: "12px",
                            "& + &": { borderTop: "1px solid {colors.line}" },
                          },
                          isTicked(order(), line().productId) && { bg: "paidBg" },
                        )}
                      >
                        {/* Siblings, not nested: the photo zooms, the rest of the row ticks. */}
                        <Photo product={line()} size={120} />
                        <button
                          type="button"
                          aria-pressed={isTicked(order(), line().productId) ? "true" : "false"}
                          onClick={() => tick(order(), line().productId)}
                          class={css({
                            flex: 1,
                            minWidth: 0,
                            alignSelf: "stretch",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            gap: "6px",
                            pr: "16px",
                            textAlign: "left",
                            cursor: "pointer",
                          })}
                        >
                          <span class={css({ fontSize: "17px", fontWeight: "600" })}>
                            {line().name}
                          </span>
                          <span class={css(muted, { fontSize: "15px" })}>
                            {line().brand} · {line().count} ш
                          </span>
                          <span
                            class={css({
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            })}
                          >
                            <b
                              class={css({
                                fontSize: "28px",
                                fontWeight: "700",
                                lineHeight: "38px",
                                bg: "marigold",
                                px: "10px",
                                borderRadius: "10px",
                                fontVariantNumeric: "tabular-nums",
                              })}
                            >
                              ×{line().quantity}
                            </b>
                            <span class={css({ fontSize: "32px", color: "paid", display: "flex" })}>
                              <Show
                                when={isTicked(order(), line().productId)}
                                fallback={<CircleIcon class={css({ color: "line" })} />}
                              >
                                <CheckIcon />
                              </Show>
                            </span>
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
                    class={css(muted, {
                      fontSize: "16px",
                      fontWeight: "600",
                      px: "4px",
                      cursor: "pointer",
                    })}
                  >
                    Алгасах
                  </button>
                  <button
                    type="button"
                    disabled={!allTicked(order())}
                    onClick={() => next(order(), true)}
                    class={css(button, darkButton, bigButton, { flex: 1 })}
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

/** The end of the pass: check the pile against the list, then hand it all to TU. */
function Hand(props: { packed: ReadonlyArray<Order>; total: number }) {
  const runtime = useContext(RuntimeContext);
  const [busy, setBusy] = createOptimistic(false);
  const [result, setResult] = createSignal<{ sent: number; failed: number }>();

  const collect = () =>
    props.packed
      .filter((order) => order.terms === "cod")
      .reduce((total, order) => total + Math.max(order.balance, 0), 0);

  // Runs to the last parcel even if she leaves the page.
  const handAll = action(function* handAll(parcels: ReadonlyArray<Order>) {
    setBusy(true);
    let sent = 0;

    for (const parcel of parcels) {
      try {
        yield runtime.runPromise(advance(parcel.id, "ship"));
        sent += 1;
      } catch {
        // Counted below; the order stays in Илгээх for another try.
      }
    }

    setResult({ sent, failed: parcels.length - sent });
  });

  return (
    <Show
      when={result()}
      fallback={
        <>
          <section class={css({ px: "16px", pb: "12px" })}>
            <h1 class={css({ fontSize: "24px", lineHeight: "30px", fontWeight: "700" })}>
              {props.packed.length} илгээмж савласан
            </h1>
            <Show when={props.total > props.packed.length}>
              <p class={css(muted, { fontSize: "15px", mt: "4px" })}>
                {props.total - props.packed.length} алгассан. Илгээх жагсаалтад үлдэнэ.
              </p>
            </Show>
          </section>
          <Show when={props.packed.length > 0}>
            <div class={css(block)}>
              <For each={props.packed} keyed={(order) => order.id}>
                {(order) => (
                  <div
                    class={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      px: "16px",
                      py: "12px",
                      "& + &": { borderTop: "1px solid {colors.line}" },
                    })}
                  >
                    <div class={css({ flex: 1, minWidth: 0 })}>
                      <b
                        class={css({
                          fontSize: "16px",
                          fontWeight: "600",
                          fontVariantNumeric: "tabular-nums",
                        })}
                      >
                        <Show when={order().customerPhone} fallback="Утасгүй">
                          {(digits) => phone(digits())}
                        </Show>
                      </b>
                      <div
                        class={css(muted, {
                          fontSize: "14px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        })}
                      >
                        {order().address}
                      </div>
                    </div>
                    <PayPill order={order()} />
                  </div>
                )}
              </For>
            </div>
            <div class={css(dock, { flexDirection: "column", alignItems: "stretch", gap: "8px" })}>
              <Show when={collect() > 0}>
                <p class={css({ fontSize: "15px", textAlign: "center" })}>
                  TU хүргэлтээр <b>{money(collect())}</b> авна
                </p>
              </Show>
              <button
                type="button"
                disabled={busy()}
                onClick={() => handAll(props.packed)}
                class={css(button, darkButton, bigButton)}
              >
                {props.packed.length} илгээмжийг TU-д өгөх
              </button>
            </div>
          </Show>
        </>
      }
    >
      {(done) => (
        <section class={css({ px: "16px", pt: "24px", textAlign: "center" })}>
          <h1 class={css({ fontSize: "24px", lineHeight: "30px", fontWeight: "700" })}>
            {done().sent} илгээмж TU-д өглөө
          </h1>
          <Show when={done().failed > 0}>
            <p class={css({ color: "owes", mt: "8px" })}>
              {done().failed} нь болсонгүй. Захиалга дотроос дахин оролдоно уу.
            </p>
          </Show>
          <a href="/" class={css(button, darkButton, bigButton, { mt: "24px", px: "28px" })}>
            Нүүр рүү
          </a>
        </section>
      )}
    </Show>
  );
}
