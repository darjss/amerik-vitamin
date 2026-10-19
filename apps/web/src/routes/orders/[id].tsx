import { OrderId } from "@amerik/contracts";
import type { OrderDetail } from "@amerik/contracts";
import { useParams } from "@solidjs/router";
import * as Schema from "effect/Schema";
import {
  action,
  createMemo,
  createOptimistic,
  createSignal,
  Errored,
  For,
  Loading,
  refresh,
  Show,
  useContext,
} from "solid-js";
import { css } from "styled-system/css";
import BackIcon from "~icons/ph/caret-left";
import CopyIcon from "~icons/ph/copy";
import KeyIcon from "~icons/ph/key";
import PhoneIcon from "~icons/ph/phone";

import { ApiClient } from "../../api/client";
import { runEffect, RuntimeContext } from "../../api/solid-effect";
import { clock, money, phone } from "../../format";
import { advance, nextStep } from "../../steps";
import type { Step } from "../../steps";
import { button, card, cardTitle, darkButton, muted, Photo, Problem } from "../../ui";

type Order = typeof OrderDetail.Type;

const headline = (order: Order) => {
  if (order.status === "cancelled") return "Цуцалсан";

  if (order.status === "delivered") return "Хүргэсэн";

  if (order.status === "shipped") return "Замд";

  if (order.status === "paid" || order.terms === "cod") return "Илгээхэд бэлэн";

  return "Төлбөр хүлээж байна";
};

const settled = (order: Order) => order.paid > 0 && order.balance <= 0;

const sent = (order: Order) => order.status === "shipped" || order.status === "delivered";

/** COD is paid at the door, so its payment step comes last. */
const steps = (order: Order) => {
  const placed = { label: "Захиалсан", done: true };
  const paid = { label: "Төлсөн", done: settled(order) };
  const shipped = { label: "Илгээсэн", done: sent(order) };
  const delivered = { label: "Хүргэсэн", done: order.status === "delivered" };

  return order.terms === "cod"
    ? [placed, shipped, delivered, paid]
    : [placed, paid, shipped, delivered];
};

const methodText = { qpay: "QPay", transfer: "Шилжүүлэг", cash: "Бэлэн" };

const kv = css.raw({
  display: "flex",
  justifyContent: "space-between",
  py: "3px",
  fontSize: "14px",
});

export default function OrderPage() {
  const params = useParams<{ id: OrderId }>();
  const orderId = () => Schema.decodeUnknownSync(OrderId)(params.id);

  const order = createMemo(() => {
    const id = orderId();

    return runEffect(ApiClient.use((api) => api.getOrder({ orderId: id })));
  });

  const runtime = useContext(RuntimeContext);
  const [busy, setBusy] = createOptimistic(false);
  const [failed, setFailed] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  // The write runs to completion even if she leaves the page.
  const take = action(function* take(step: Step) {
    const id = orderId();
    setBusy(true);
    setFailed(false);

    try {
      yield runtime.runPromise(advance(id, step));
    } catch {
      setFailed(true);
    }

    yield refresh(order);
  });

  const copy = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
  };

  return (
    <main class={css({ pb: "110px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(card, { height: "300px", mt: "100px" })} />}>
          <div
            class={css({
              display: "flex",
              alignItems: "center",
              px: "12px",
              pt: "56px",
              pb: "8px",
              "& svg": { fontSize: "24px" },
            })}
          >
            <a href="/orders" aria-label="Буцах">
              <BackIcon />
            </a>
            <b class={css({ flex: 1, textAlign: "center", fontSize: "17px", mr: "24px" })}>
              #{order().number}
            </b>
          </div>

          <section class={css({ px: "16px", pt: "4px", pb: "18px" })}>
            <h1
              class={css({
                fontSize: "24px",
                lineHeight: "30px",
                fontWeight: "700",
                letterSpacing: "-0.3px",
              })}
            >
              {headline(order())}
            </h1>
            <Steps steps={steps(order())} />
          </section>

          <div class={css(card)}>
            <div class={css({ p: "16px" })}>
              <div class={css({ fontSize: "17px", fontWeight: "650" })}>
                <Show when={order().customerPhone} fallback="Утасгүй">
                  {(digits) => phone(digits())}
                </Show>
              </div>
              <Show when={order().address}>
                {(address) => <div class={css({ mt: "4px" })}>{address()}</div>}
              </Show>
              <Show when={order().notes}>
                {(notes) => (
                  <div
                    class={css({
                      mt: "10px",
                      bg: "page",
                      borderRadius: "10px",
                      px: "10px",
                      py: "8px",
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                      fontSize: "14px",
                    })}
                  >
                    <KeyIcon />
                    {notes()}
                  </div>
                )}
              </Show>
              <div
                class={css({
                  display: "flex",
                  gap: "8px",
                  mt: "12px",
                  "& > *": { flex: 1, py: "10px" },
                })}
              >
                <Show when={order().customerPhone}>
                  {(digits) => (
                    <a href={`tel:${digits()}`} class={css(button)}>
                      <PhoneIcon />
                      Залгах
                    </a>
                  )}
                </Show>
                <Show when={order().address}>
                  {(address) => (
                    <button type="button" class={css(button)} onClick={() => copy(address())}>
                      <CopyIcon />
                      {copied() ? "Хуулсан" : "Хаяг хуулах"}
                    </button>
                  )}
                </Show>
              </div>
            </div>
          </div>

          <div class={css(card)}>
            <h2 class={css(cardTitle)}>
              {order().lines.reduce((total, line) => total + line.quantity, 0)} ширхэг
            </h2>
            <For each={order().lines} keyed={(line) => line.productId}>
              {(line) => (
                <div
                  class={css({
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    px: "16px",
                    py: "8px",
                  })}
                >
                  <Photo
                    product={line()}
                    styles={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "12px",
                      boxShadow: "hairline",
                      flex: "none",
                    }}
                  />
                  <div class={css({ flex: 1, minWidth: 0, fontSize: "14px" })}>
                    {line().name}
                    <small class={css(muted, { display: "block", fontSize: "13px" })}>
                      {line().brand} · {line().count} ш
                    </small>
                  </div>
                  <div class={css({ textAlign: "right" })}>
                    <b class={css({ fontSize: "16px" })}>×{line().quantity}</b>
                    <small class={css(muted, { display: "block", fontSize: "13px" })}>
                      {money(line().unitPrice * line().quantity)}
                    </small>
                  </div>
                </div>
              )}
            </For>
            <div class={css({ height: "8px" })} />
          </div>

          <div class={css(card)}>
            <h2 class={css(cardTitle)}>Төлбөр</h2>
            <div class={css({ px: "16px", pb: "16px", fontVariantNumeric: "tabular-nums" })}>
              <div class={css(kv)}>
                <span class={css(muted)}>Бараа</span>
                <span>{money(order().total - order().deliveryFee)}</span>
              </div>
              <div class={css(kv)}>
                <span class={css(muted)}>Хүргэлт</span>
                <span>{money(order().deliveryFee)}</span>
              </div>
              <div
                class={css(kv, {
                  fontSize: "16px",
                  fontWeight: "700",
                  borderTop: "1px solid {colors.line}",
                  mt: "6px",
                  pt: "9px",
                })}
              >
                <span>Нийт</span>
                <span>{money(order().total)}</span>
              </div>
              <For each={order().payments} keyed={(payment) => payment.id}>
                {(payment) => (
                  <div class={css(kv, { color: "paid" })}>
                    <span>
                      {methodText[payment().method]} · {clock(payment().createdAt)}
                    </span>
                    <span>{money(payment().amount)}</span>
                  </div>
                )}
              </For>
              <Show when={order().balance > 0}>
                <div class={css(kv, { color: "owes", fontWeight: "700" })}>
                  <span>{order().terms === "cod" ? "Хүргэлтээр авах" : "Үлдэгдэл"}</span>
                  <span>{money(order().balance)}</span>
                </div>
              </Show>
            </div>
          </div>

          <Show when={nextStep(order())}>
            {(step) => (
              <div
                class={css({
                  position: "fixed",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bg: "surface",
                  borderTop: "1px solid {colors.line}",
                  px: "16px",
                  pt: "10px",
                  pb: "34px",
                })}
              >
                <Show when={failed()}>
                  <p class={css({ color: "owes", fontSize: "14px", pb: "8px" })}>
                    Болсонгүй. Дахин оролдоно уу.
                  </p>
                </Show>
                <button
                  type="button"
                  disabled={busy()}
                  onClick={() => take(step().step)}
                  class={css(button, darkButton, {
                    width: "100%",
                    height: "50px",
                    borderRadius: "14px",
                    fontSize: "16px",
                  })}
                >
                  {step().label}
                </button>
              </div>
            )}
          </Show>
        </Loading>
      </Errored>
    </main>
  );
}

function Steps(props: { steps: ReadonlyArray<{ label: string; done: boolean }> }) {
  const reached = () => props.steps.findIndex((step) => !step.done);
  const filled = () => (reached() === -1 ? props.steps.length - 1 : Math.max(reached() - 1, 0));

  return (
    <div
      class={css({
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        position: "relative",
        mt: "16px",
      })}
    >
      <span
        class={css({
          position: "absolute",
          left: "12.5%",
          right: "12.5%",
          top: "7px",
          height: "4px",
          borderRadius: "2px",
          bg: "line",
        })}
      />
      <span
        class={css({
          position: "absolute",
          left: "12.5%",
          top: "7px",
          height: "4px",
          borderRadius: "2px",
          bg: "clay",
        })}
        style={{ width: `${filled() * 25}%` }}
      />
      <For each={props.steps}>
        {(step) => (
          <span
            class={css(
              {
                position: "relative",
                textAlign: "center",
                fontSize: "12px",
                color: "inkMuted",
                pt: "24px",
                _before: {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  ml: "-9px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  bg: "page",
                  border: "3px solid {colors.line}",
                },
              },
              step.done && {
                color: "ink",
                fontWeight: "600",
                _before: { bg: "clay", border: "3px solid {colors.clay}" },
              },
            )}
          >
            {step.label}
          </span>
        )}
      </For>
    </div>
  );
}
