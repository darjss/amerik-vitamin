import { OrderId } from "@amerik/contracts";
import type { EditOrder, OrderDetail } from "@amerik/contracts";
import { useParams } from "@solidjs/router";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import {
  createMemo,
  createSignal,
  Errored,
  For,
  Loading,
  refresh,
  Show,
  useContext,
} from "solid-js";
import { css } from "styled-system/css";
import CaretLeftIcon from "~icons/ph/caret-left-bold";
import CheckIcon from "~icons/ph/check-bold";
import CheckCircleIcon from "~icons/ph/check-circle-fill";
import CopyIcon from "~icons/ph/copy-bold";
import MoreIcon from "~icons/ph/dots-three-bold";
import PhoneIcon from "~icons/ph/phone-fill";
import WarningIcon from "~icons/ph/warning-circle-fill";

import { ApiClient } from "../../api/client";
import { createWrite, runEffect } from "../../api/solid-effect";
import { clock, dayTitle, money, phone } from "../../format";
import {
  EditSheet,
  HeldSteps,
  nextStep,
  payment,
  PaySheet,
  StepButton,
  Stepper,
} from "../../orders";
import { Tile } from "../../photos";
import { DetailSkeleton } from "../../skeletons";
import { button, press, round } from "../../styles";
import {
  appear,
  createCopied,
  Dock,
  Failed,
  glassBar,
  groupHead,
  hairline,
  panel,
  Pill,
  Problem,
  Sheet,
  sub,
} from "../../ui";
import { methodText, sourceText, statusText } from "../../words";

type SheetKind = "menu" | "pay" | "edit" | "cancel";

/** A new COD order is ready to ship like a paid one. */
const shownStatus = (order: OrderDetail) =>
  order.status === "new" && order.terms === "cod" ? "paid" : order.status;

const dots = {
  new: css.raw({ bg: "status.new" }),
  paid: css.raw({ bg: "status.paid" }),
  shipped: css.raw({ bg: "status.shipped" }),
  delivered: css.raw({ bg: "status.delivered" }),
  cancelled: css.raw({ bg: "status.cancelled" }),
};

const editable = (order: OrderDetail) => order.status === "new" || order.status === "paid";

const owing = (order: OrderDetail) => order.balance > 0 && order.status !== "cancelled";

/** A panel row: one line of content with its action on the right. */
const row = css.raw(hairline, {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minHeight: "52px",
  px: "16px",
  py: "10px",
  width: "100%",
  textAlign: "left",
  fontVariantNumeric: "tabular-nums",
});

export default function OrderPage() {
  const params = useParams();
  const orderId = () => Schema.decodeUnknownSync(OrderId)(params.id);

  const order = createMemo(() => {
    const id = orderId();

    return runEffect(ApiClient.use((api) => api.getOrder({ orderId: id })));
  });

  const now = createMemo(() => runEffect(DateTime.nowAsDate));
  const { failure } = useContext(HeldSteps);
  const [sheet, setSheet] = createSignal<SheetKind>();
  const { write, busy, failed, setFailed } = createWrite({ source: order });

  const open = (next: SheetKind | undefined) => {
    setFailed(undefined);
    setSheet(next);
  };

  const close = () => open(undefined);

  const reload = async () => {
    await refresh(order);
  };

  // The lines go back unchanged: editOrder takes the full line list.
  const edit = (address: string, notes: string) => {
    const current = order();
    const lines = current.lines.map(({ productId, quantity }) => ({ productId, quantity }));

    if (!Arr.isArrayNonEmpty(lines)) return;

    const input = {
      orderId: current.id,
      address,
      notes,
      deliveryFee: current.deliveryFee,
      lines,
    } satisfies EditOrder;

    void write(
      ApiClient.use((api) => api.editOrder(input)),
      close,
    );
  };

  return (
    <main class={css({ maxWidth: "640px", mx: "auto", pb: "120px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<DetailSkeleton />}>
          <div class={css(appear)}>
            <header
              class={css(glassBar, {
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                px: "6px",
                pb: "2px",
              })}
            >
              <a
                href="/orders"
                class={css(press, {
                  justifySelf: "start",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  height: "44px",
                  px: "8px",
                  textStyle: "headline",
                  fontWeight: "600",
                  "& svg": { fontSize: "20px" },
                })}
              >
                <CaretLeftIcon />
                Захиалга
              </a>
              <b class={css({ textStyle: "headline", fontWeight: "700" })}>#{order().number}</b>
              <button
                type="button"
                aria-label="Бусад үйлдэл"
                onClick={() => open("menu")}
                class={css(round.raw(), { justifySelf: "end", bg: "transparent" })}
              >
                <MoreIcon />
              </button>
            </header>

            <div class={css({ px: "16px" })}>
              <div
                class={css({
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "6px",
                  mt: "6px",
                })}
              >
                <Pill tone="neutral">
                  <span
                    class={css(
                      { width: "8px", height: "8px", borderRadius: "50%" },
                      dots[shownStatus(order())],
                    )}
                  />
                  {statusText[shownStatus(order())]}
                </Pill>
                <Show when={payment(order())}>
                  {(paid) => <Pill tone={paid().tone}>{paid().text}</Pill>}
                </Show>
                <span class={css(sub, { ml: "auto", whiteSpace: "nowrap" })}>
                  {sourceText[order().source]} · {dayTitle(order().createdAt, now())}{" "}
                  {clock.format(order().createdAt)}
                </span>
              </div>

              <Show when={order().status !== "cancelled"}>
                <div class={css(panel, { mt: "12px" })}>
                  <Stepper order={order()} />
                </div>
              </Show>

              <Customer order={order()} onEdit={() => open("edit")} />
              <Lines order={order()} />
              <Payment order={order()} now={now()} onPay={() => open("pay")} />
            </div>

            {/* A failed step keeps the dock even when the order has no next step left. */}
            <Show when={nextStep(order()) !== undefined || failure(order().id) !== undefined}>
              <Dock>
                <Failed text={failure(order().id)} />
                <StepButton order={order()} reload={reload} wide />
              </Dock>
            </Show>

            <Sheet open={sheet() === "menu"} title={`#${order().number}`} onClose={close}>
              <div class={css({ display: "grid", gap: "10px" })}>
                <button
                  type="button"
                  disabled={!editable(order())}
                  onClick={() => open("edit")}
                  class={button({ wide: true })}
                >
                  Хаяг, тэмдэглэл засах
                </button>
                <Show when={editable(order())}>
                  <button
                    type="button"
                    onClick={() => open("cancel")}
                    class={css(button.raw(), { width: "100%", bg: "oweBg", color: "owe" })}
                  >
                    Захиалга цуцлах
                  </button>
                </Show>
              </div>
            </Sheet>

            <PaySheet
              open={sheet() === "pay"}
              balance={order().balance}
              busy={busy()}
              failed={failed()}
              onClose={close}
              onSave={(amount, method) =>
                void write(
                  ApiClient.use((api) => api.recordPayment({ orderId: orderId(), amount, method })),
                  close,
                )
              }
            />

            <EditSheet
              open={sheet() === "edit"}
              order={order()}
              busy={busy()}
              failed={failed()}
              onClose={close}
              onSave={edit}
            />

            <CancelSheet
              open={sheet() === "cancel"}
              busy={busy()}
              failed={failed()}
              onClose={close}
              onCancel={() =>
                void write(
                  ApiClient.use((api) => api.cancelOrder({ orderId: orderId() })),
                  close,
                )
              }
            />
          </div>
        </Loading>
      </Errored>
    </main>
  );
}

/** Phone and call, then the address and note. A tap on either edits them while it can. */
function Customer(props: { order: OrderDetail; onEdit: () => void }) {
  const { copied, copy } = createCopied();

  return (
    <section>
      <h2 class={css(groupHead)}>Захиалагч</h2>
      <div class={css(panel)}>
        <Show when={props.order.customerPhone}>
          {(digits) => (
            <div class={css(row)}>
              <div class={css({ flex: 1, minWidth: 0 })}>
                <div
                  class={css({
                    fontSize: "20px",
                    lineHeight: "26px",
                    fontWeight: "700",
                    letterSpacing: "0.01em",
                  })}
                >
                  {phone(digits())}
                </div>
                <Show
                  when={props.order.customerOrders > 1}
                  fallback={<span class={css(sub)}>Анхны захиалга</span>}
                >
                  <a
                    href={`/orders?view=all&q=${digits()}`}
                    class={css(sub, {
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                      textDecorationColor: "line",
                    })}
                  >
                    Нийт {props.order.customerOrders} захиалга
                  </a>
                </Show>
              </div>
              <a href={`tel:${digits()}`} aria-label="Залгах" class={round({ tone: "butter" })}>
                <PhoneIcon />
              </a>
            </div>
          )}
        </Show>
        <div class={css(row)}>
          <button
            type="button"
            disabled={!editable(props.order)}
            onClick={() => props.onEdit()}
            class={css({
              flex: 1,
              minWidth: 0,
              textAlign: "left",
              textStyle: "body",
              cursor: "pointer",
              _disabled: { cursor: "default" },
            })}
          >
            {props.order.address ?? "Хаяггүй"}
          </button>
          <Show when={props.order.address}>
            {(address) => (
              <button
                type="button"
                aria-label="Хаяг хуулах"
                onClick={() => void copy(address())}
                class={css(
                  round.raw(),
                  { bg: "transparent", color: "inkMuted" },
                  copied() === "copied" && { color: "ok" },
                )}
              >
                <Show when={copied() === "copied"} fallback={<CopyIcon />}>
                  <CheckIcon />
                </Show>
              </button>
            )}
          </Show>
        </div>
        <Show when={props.order.notes}>
          {(notes) => (
            <button
              type="button"
              disabled={!editable(props.order)}
              onClick={() => props.onEdit()}
              class={css(row, {
                color: "waitInk",
                fontWeight: "600",
                cursor: "pointer",
                _disabled: { cursor: "default" },
                "& svg": { flex: "none", fontSize: "20px", color: "wait" },
              })}
            >
              <WarningIcon />
              {notes()}
            </button>
          )}
        </Show>
      </div>
    </section>
  );
}

function Lines(props: { order: OrderDetail }) {
  return (
    <section>
      <h2 class={css(groupHead)}>
        Бараа
        <small>{props.order.lines.reduce((total, line) => total + line.quantity, 0)} ш</small>
      </h2>
      <div class={css(panel)}>
        <For each={props.order.lines} keyed={(line) => line.productId}>
          {(line) => (
            <div class={css(row)}>
              <Tile product={line()} size={48} />
              <div class={css({ flex: 1, minWidth: 0 })}>
                <b class={css({ display: "block", fontWeight: "600" })}>{line().name}</b>
                <span class={css(sub, { display: "block" })}>
                  {line().brand} · {line().quantity} × {money(line().unitPrice)}
                </span>
              </div>
              <b class={css({ fontWeight: "700", whiteSpace: "nowrap" })}>
                {money(line().unitPrice * line().quantity)}
              </b>
            </div>
          )}
        </For>
        <div class={css(row)}>
          <div class={css({ flex: 1 })}>
            <b class={css({ display: "block", fontWeight: "600" })}>Нийт</b>
            <Show when={props.order.deliveryFee > 0}>
              <span class={css(sub, { display: "block" })}>
                Хүргэлт {money(props.order.deliveryFee)} орсон
              </span>
            </Show>
          </div>
          <b class={css({ fontSize: "20px", fontWeight: "700" })}>{money(props.order.total)}</b>
        </div>
      </div>
    </section>
  );
}

/** Each payment in green, then what's still owed in red with "Мөнгө авсан" under it. */
function Payment(props: { order: OrderDetail; now: Date; onPay: () => void }) {
  return (
    <Show when={props.order.payments.length > 0 || owing(props.order)}>
      <section>
        <h2 class={css(groupHead)}>Төлбөр</h2>
        <div class={css(panel)}>
          <For each={props.order.payments} keyed={(paid) => paid.id}>
            {(paid) => (
              <div class={css(row, { "& svg": { flex: "none", fontSize: "20px", color: "ok" } })}>
                <CheckCircleIcon />
                <div class={css({ flex: 1, minWidth: 0 })}>
                  <b class={css({ display: "block", fontWeight: "600", color: "ok" })}>
                    {methodText[paid().method]}
                  </b>
                  <span class={css(sub, { display: "block" })}>
                    {dayTitle(paid().createdAt, props.now)} {clock.format(paid().createdAt)}
                  </span>
                </div>
                <b class={css({ fontWeight: "700", color: "ok" })}>{money(paid().amount)}</b>
              </div>
            )}
          </For>
          <Show when={owing(props.order)}>
            <div class={css(row, { color: "owe", fontWeight: "600" })}>
              <span class={css({ flex: 1 })}>
                {props.order.terms === "cod" ? "Хүргэлтээр авах" : "Төлбөр хүлээж"}
              </span>
              <b class={css({ fontWeight: "700" })}>{money(props.order.balance)}</b>
            </div>
          </Show>
        </div>
        <Show when={owing(props.order)}>
          <button
            type="button"
            onClick={() => props.onPay()}
            class={css(button.raw(), { width: "100%", mt: "10px" })}
          >
            Мөнгө авсан
          </button>
        </Show>
      </section>
    </Show>
  );
}

function CancelSheet(props: {
  open: boolean;
  busy: boolean;
  failed: string | undefined;
  onClose: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet open={props.open} title="Захиалга цуцлах уу?" onClose={props.onClose}>
      <p class={css(sub, { pb: "18px" })}>
        Цуцалсан захиалгыг буцааж сэргээх боломжгүй. Төлсөн мөнгийг өөрөө буцааж өгнө.
      </p>
      <Failed text={props.failed} />
      <div class={css({ display: "flex", gap: "10px" })}>
        <button
          type="button"
          onClick={() => props.onClose()}
          class={css(button.raw(), { flex: 1 })}
        >
          Үгүй
        </button>
        <button
          type="button"
          disabled={props.busy}
          onClick={() => props.onCancel()}
          class={css(button.raw(), { flex: 1, bg: "owe", color: "white" })}
        >
          Цуцлах
        </button>
      </div>
    </Sheet>
  );
}
