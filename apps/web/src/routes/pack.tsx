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
import CheckIcon from "~icons/ph/check-bold";
import MapPinIcon from "~icons/ph/map-pin";
import TruckIcon from "~icons/ph/truck-bold";
import CloseIcon from "~icons/ph/x-bold";

import { ApiClient } from "../api/client";
import { runEffect, RuntimeContext } from "../api/solid-effect";
import { Dock } from "../chrome";
import { money, phone } from "../format";
import { advance } from "../steps";
import {
  act,
  button,
  glass,
  headline,
  large,
  Money,
  Note,
  panel,
  Problem,
  round,
  sub,
  Tile,
  title2,
} from "../ui";

type Order = typeof OrderSummary.Type;

const key = (order: Order, productId: ProductId) => `${order.id}:${productId}`;

const phoneText = (order: Order) =>
  order.customerPhone === null ? "Утасгүй" : phone(order.customerPhone);

/**
 * The morning's packing, one parcel at a time as a checklist (PRODUCT.md,
 * Features 2). She ticks each bottle as it goes in the bag; after the last
 * parcel one tap hands every packed one to TU.
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

  const tickedCount = (order: Order) =>
    order.lines.filter((line) => isTicked(order, line.productId)).length;

  const allTicked = (order: Order) => tickedCount(order) === order.lines.length;

  const tick = (order: Order, productId: ProductId) =>
    setTicked((draft) => {
      draft[key(order, productId)] = !draft[key(order, productId)];
    });

  const next = (order: Order, done: boolean) => {
    if (done) setPacked((list) => [...list, order]);
    setIndex((at) => at + 1);
    window.scrollTo(0, 0);
  };

  // The current parcel's bar fills as she ticks.
  const fill = (at: number) => {
    if (at < index()) return 100;

    const order = current();

    if (at > index() || order === undefined) return 0;

    return (tickedCount(order) / order.lines.length) * 100;
  };

  return (
    <main class={css({ pb: "130px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(panel, { m: "80px 16px 0", height: "400px" })} />}>
          <header
            class={css({
              position: "sticky",
              top: 0,
              zIndex: 5,
              px: "14px",
              pt: "calc(env(safe-area-inset-top) + 8px)",
              pb: "10px",
              bg: "rgba(248,244,236,.9)",
              backdropFilter: "blur(22px) saturate(180%)",
            })}
          >
            <div class={css({ display: "flex", alignItems: "center", gap: "10px" })}>
              <a href="/" aria-label="Хаах" class={css(round, glass)}>
                <CloseIcon />
              </a>
              <b class={css(headline, { flex: 1, textAlign: "center" })}>Савлах</b>
              <span
                class={css(sub, {
                  width: "44px",
                  textAlign: "right",
                  fontWeight: "600",
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                {Math.min(index() + 1, orders().length)}/{orders().length}
              </span>
            </div>
            <div class={css({ display: "flex", gap: "5px", px: "6px", pt: "12px" })}>
              <For each={orders()} keyed={(order) => order.id}>
                {(order, at) => (
                  <span
                    title={`#${order().number}`}
                    class={css({
                      position: "relative",
                      flex: 1,
                      height: "4px",
                      borderRadius: "2px",
                      bg: "#e2dacc",
                      overflow: "hidden",
                    })}
                  >
                    <span
                      class={css({
                        position: "absolute",
                        inset: 0,
                        bg: "sel",
                        transition: "width .4s cubic-bezier(.23,1,.32,1)",
                      })}
                      style={{ width: `${fill(at())}%` }}
                    />
                  </span>
                )}
              </For>
            </div>
          </header>

          <Show when={current()} fallback={<Hand packed={packed()} total={orders().length} />}>
            {(order) => (
              <>
                <div class={css({ px: "20px", pt: "14px" })}>
                  <div class={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                    <b
                      class={css({
                        mr: "auto",
                        fontSize: "28px",
                        lineHeight: "34px",
                        fontWeight: "700",
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      {phoneText(order())}
                    </b>
                    <Money order={order()} />
                  </div>
                  <div
                    class={css(sub, {
                      display: "flex",
                      gap: "6px",
                      alignItems: "flex-start",
                      mt: "6px",
                      fontSize: "16px",
                      "& svg": { flex: "none", mt: "2px" },
                    })}
                  >
                    <MapPinIcon />
                    <span>{order().address ?? "Хаяггүй"}</span>
                  </div>
                  <Show when={order().notes}>
                    {(notes) => (
                      <div class={css({ mt: "12px" })}>
                        <Note large>{notes()}</Note>
                      </div>
                    )}
                  </Show>
                </div>

                <div class={css(panel, { mx: "16px", mt: "20px", overflow: "hidden" })}>
                  <For each={order().lines} keyed={(line) => line.productId}>
                    {(line) => (
                      <button
                        type="button"
                        aria-pressed={isTicked(order(), line().productId) ? "true" : "false"}
                        onClick={() => tick(order(), line().productId)}
                        class={css({
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          width: "100%",
                          textAlign: "left",
                          p: "14px 16px 14px 14px",
                          cursor: "pointer",
                          transition: "background .2s ease",
                          _active: { bg: "rgba(30,27,23,.04)" },
                          "& + &": { boxShadow: "inset 0 .5px 0 {colors.line}" },
                        })}
                      >
                        <span
                          class={css({ transition: "opacity .25s ease" })}
                          style={{ opacity: isTicked(order(), line().productId) ? 0.5 : 1 }}
                        >
                          <Tile product={line()} size={112} still />
                        </span>
                        <span
                          class={css(
                            {
                              flex: 1,
                              minWidth: 0,
                              alignSelf: "stretch",
                              display: "flex",
                              flexDirection: "column",
                              py: "4px",
                            },
                            isTicked(order(), line().productId) && { color: "inkMuted" },
                          )}
                        >
                          <span
                            class={css({
                              fontSize: "18px",
                              lineHeight: "23px",
                              fontWeight: "650",
                              letterSpacing: "-0.015em",
                            })}
                          >
                            {line().name}
                          </span>
                          <span class={css(sub, { mt: "3px" })}>
                            {line().brand} · {line().count} ш
                          </span>
                          <span
                            class={css({
                              mt: "auto",
                              fontSize: "30px",
                              lineHeight: "34px",
                              fontWeight: "750",
                              letterSpacing: "-0.02em",
                              fontVariantNumeric: "tabular-nums",
                            })}
                          >
                            <small
                              class={css({
                                fontSize: "20px",
                                fontWeight: "600",
                                color: "inkMuted",
                                mr: "1px",
                              })}
                            >
                              ×
                            </small>
                            {line().quantity}
                          </span>
                        </span>
                        <span
                          class={css(
                            {
                              width: "34px",
                              height: "34px",
                              flex: "none",
                              borderRadius: "10px",
                              display: "grid",
                              placeItems: "center",
                              fontSize: "20px",
                              color: "transparent",
                              boxShadow: "inset 0 0 0 2px #c9c0b1",
                              transition:
                                "background .15s ease, box-shadow .15s ease, color .15s ease",
                            },
                            isTicked(order(), line().productId) && {
                              bg: "sel",
                              boxShadow: "none",
                              color: "white",
                            },
                          )}
                        >
                          <CheckIcon />
                        </span>
                      </button>
                    )}
                  </For>
                </div>

                <Dock>
                  <div class={css({ display: "flex", gap: "10px" })}>
                    <button
                      type="button"
                      onClick={() => next(order(), false)}
                      class={css(button, large, { flex: 1 })}
                    >
                      Алгасах
                    </button>
                    <button
                      type="button"
                      disabled={!allTicked(order())}
                      onClick={() => next(order(), true)}
                      class={css(button, act, large, { flex: 1.6 })}
                    >
                      Савласан
                    </button>
                  </div>
                </Dock>
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

  const disc = css.raw({
    width: "64px",
    height: "64px",
    mx: "auto",
    mb: "18px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: "32px",
    bg: "paidBg",
    color: "paid",
  });

  return (
    <Show
      when={result()}
      fallback={
        <>
          <div class={css({ px: "24px", pt: "40px", textAlign: "center" })}>
            <span class={css(disc)}>
              <CheckIcon />
            </span>
            <h1 class={css(title2)}>{props.packed.length} илгээмж савласан</h1>
            <Show when={props.total > props.packed.length}>
              <p class={css(sub, { mt: "6px" })}>
                {props.total - props.packed.length} алгассан. Илгээх жагсаалтад үлдэнэ.
              </p>
            </Show>
          </div>
          <Show when={props.packed.length > 0}>
            <div class={css(panel, { mx: "16px", mt: "24px", overflow: "hidden" })}>
              <For each={props.packed} keyed={(order) => order.id}>
                {(order) => (
                  <div
                    class={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      px: "16px",
                      py: "14px",
                      "& + &": { boxShadow: "inset 0 .5px 0 {colors.line}" },
                    })}
                  >
                    <div class={css({ flex: 1, minWidth: 0 })}>
                      <div class={css(headline, { fontVariantNumeric: "tabular-nums" })}>
                        {phoneText(order())}
                      </div>
                      <div
                        class={css(sub, {
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        })}
                      >
                        {order().address}
                      </div>
                    </div>
                    <Money order={order()} />
                  </div>
                )}
              </For>
            </div>
            <Dock>
              <Show when={collect() > 0}>
                <p class={css(sub, { textAlign: "center", color: "ink" })}>
                  TU хүргэлтээр <b class={css({ color: "owes" })}>{money(collect())}</b> авна
                </p>
              </Show>
              <button
                type="button"
                disabled={busy()}
                onClick={() => handAll(props.packed)}
                class={css(button, act, large, { width: "100%" })}
              >
                <TruckIcon />
                {props.packed.length} илгээмжийг TU-д өгөх
              </button>
            </Dock>
          </Show>
        </>
      }
    >
      {(done) => (
        <div class={css({ px: "24px", pt: "40px", textAlign: "center" })}>
          <span class={css(disc)}>
            <TruckIcon />
          </span>
          <h1 class={css(title2)}>{done().sent} илгээмж TU-д өглөө</h1>
          <Show when={done().failed > 0}>
            <p class={css({ color: "owes", mt: "8px" })}>
              {done().failed} нь болсонгүй. Захиалга дотроос дахин оролдоно уу.
            </p>
          </Show>
          <a href="/" class={css(button, act, large, { mt: "28px", px: "32px" })}>
            Нүүр рүү
          </a>
        </div>
      )}
    </Show>
  );
}
