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
import CheckCircleIcon from "~icons/ph/check-circle-fill";
import CopyIcon from "~icons/ph/copy-bold";
import MoreIcon from "~icons/ph/dots-three-bold";
import MapPinIcon from "~icons/ph/map-pin";
import PhoneIcon from "~icons/ph/phone-fill";
import CloseIcon from "~icons/ph/x-bold";

import { ApiClient } from "../../api/client";
import { createWrite, runEffect } from "../../api/solid-effect";
import { clock, money, phone, when } from "../../format";
import {
  EditSheet,
  HeldSteps,
  History,
  nextStep,
  PaySheet,
  StepButton,
  Tracker,
} from "../../orders";
import { Tile } from "../../photos";
import { DetailSkeleton } from "../../skeletons";
import {
  appear,
  button,
  createCopied,
  Dock,
  Failed,
  glass,
  glassBar,
  large,
  Note,
  panel,
  Problem,
  round,
  roundAct,
  section,
  sectionHead,
  Sheet,
  sub,
} from "../../ui";
import { headlineText, methodText, sourceText } from "../../words";

type SheetKind = "menu" | "pay" | "edit" | "cancel";

const headlineOf = (order: OrderDetail) =>
  headlineText[order.status === "new" && order.terms === "cod" ? "paid" : order.status];

const payText = (order: OrderDetail) => {
  const last = order.payments.at(-1);

  if (order.balance <= 0 && last !== undefined) return `${methodText[last.method]} төлсөн`;

  return order.terms === "cod" ? "Хүргэлтээр төлнө" : "Төлбөр хүлээж";
};

const editable = (order: OrderDetail) => order.status === "new" || order.status === "paid";

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
    <main class={css({ pb: "130px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<DetailSkeleton />}>
          <div class={css(appear)}>
            <header class={css(glassBar, { display: "flex", alignItems: "center", gap: "10px" })}>
              <a href="/orders" aria-label="Хаах" class={css(round, glass)}>
                <CloseIcon />
              </a>
              <b
                class={css({
                  textStyle: "headline",
                  flex: 1,
                  textAlign: "center",
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                #{order().number}
              </b>
              <button
                type="button"
                aria-label="Бусад үйлдэл"
                onClick={() => open("menu")}
                class={css(round, glass)}
              >
                <MoreIcon />
              </button>
            </header>

            <div class={css({ px: "20px", pt: "14px" })}>
              <h1 class={css({ textStyle: "largeTitle" })}>{headlineOf(order())}</h1>
              <p class={css(sub, { mt: "6px" })}>
                {payText(order())} · {when(order().createdAt, now())} · {sourceText[order().source]}
              </p>
            </div>

            <Show when={order().status !== "cancelled"}>
              <Tracker order={order()} />
            </Show>

            <Lines order={order()} />
            <Customer order={order()} onEdit={() => open("edit")} />
            <Payment order={order()} onPay={() => open("pay")} />

            {/* A failed step keeps the dock even when the order has no next step left. */}
            <Show when={nextStep(order()) !== undefined || failure(order().id) !== undefined}>
              <Dock>
                <Failed text={failure(order().id)} />
                <StepButton order={order()} reload={reload} wide />
              </Dock>
            </Show>

            <Sheet open={sheet() === "menu"} title="Захиалга" onClose={close}>
              <div class={css({ display: "grid", gap: "10px" })}>
                <button
                  type="button"
                  disabled={!editable(order())}
                  onClick={() => open("edit")}
                  class={css(button, large, { width: "100%" })}
                >
                  Хаяг, тэмдэглэл засах
                </button>
                <Show when={editable(order())}>
                  <button
                    type="button"
                    onClick={() => open("cancel")}
                    class={css(button, large, { width: "100%", color: "owes" })}
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

function Lines(props: { order: OrderDetail }) {
  return (
    <section class={css(section)}>
      <div class={css(sectionHead)}>
        <h2 class={css({ textStyle: "title2" })}>Бараа</h2>
        <span class={css(sub, { fontVariantNumeric: "tabular-nums" })}>
          {props.order.lines.reduce((total, line) => total + line.quantity, 0)} ширхэг
        </span>
      </div>
      <div class={css({ display: "grid", gap: "16px" })}>
        <For each={props.order.lines} keyed={(line) => line.productId}>
          {(line) => (
            <div class={css({ display: "flex", alignItems: "center", gap: "14px" })}>
              <Tile product={line()} size={64} quantity={line().quantity} soft />
              <div class={css({ flex: 1, minWidth: 0 })}>
                <div class={css({ textStyle: "headline" })}>{line().name}</div>
                <div class={css(sub)}>
                  {line().brand} · {line().count} ш
                </div>
              </div>
              <span
                class={css({
                  textStyle: "body",
                  fontWeight: "600",
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                {money(line().unitPrice * line().quantity)}
              </span>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}

function Customer(props: { order: OrderDetail; onEdit: () => void }) {
  const { copied, copy } = createCopied();

  return (
    <section class={css(section)}>
      <div class={css(sectionHead)}>
        <h2 class={css({ textStyle: "title2" })}>Захиалагч</h2>
      </div>
      <Show when={props.order.customerPhone}>
        {(digits) => (
          <div class={css({ display: "flex", alignItems: "center", gap: "12px" })}>
            <div class={css({ flex: 1 })}>
              <div
                class={css({
                  fontSize: "24px",
                  lineHeight: "30px",
                  fontWeight: "700",
                  letterSpacing: "-0.01em",
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                {phone(digits())}
              </div>
              <History phone={digits()} orders={props.order.customerOrders} />
            </div>
            <a href={`tel:${digits()}`} aria-label="Залгах" class={css(round, roundAct)}>
              <PhoneIcon />
            </a>
          </div>
        )}
      </Show>
      <div class={css({ display: "flex", alignItems: "center", gap: "12px", mt: "18px" })}>
        <span
          class={css({
            width: "44px",
            flex: "none",
            display: "grid",
            placeItems: "center",
            fontSize: "22px",
            color: "inkMuted",
          })}
        >
          <MapPinIcon />
        </span>
        <button
          type="button"
          disabled={!editable(props.order)}
          onClick={() => props.onEdit()}
          class={css({
            flex: 1,
            textAlign: "left",
            fontSize: "17px",
            lineHeight: "23px",
            fontWeight: "500",
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
              class={css(round, copied() && { bg: "paidBg", color: "paid" })}
            >
              <CopyIcon />
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
            class={css({ display: "block", width: "100%", mt: "14px", cursor: "pointer" })}
          >
            <Note>{notes()}</Note>
          </button>
        )}
      </Show>
    </section>
  );
}

const receiptRow = css.raw({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  py: "5px",
  textStyle: "body",
  fontVariantNumeric: "tabular-nums",
});

const owing = (order: OrderDetail) => order.balance > 0 && order.status !== "cancelled";

function Payment(props: { order: OrderDetail; onPay: () => void }) {
  return (
    <section class={css(section)}>
      <div class={css(sectionHead)}>
        <h2 class={css({ textStyle: "title2" })}>Төлбөр</h2>
      </div>
      <div class={css(panel, { overflow: "hidden" })}>
        <div class={css({ px: "20px", py: "16px" })}>
          <div class={css(receiptRow)}>
            <span>Бараа</span>
            <span class={css({ fontWeight: "600" })}>
              {money(props.order.total - props.order.deliveryFee)}
            </span>
          </div>
          <div class={css(receiptRow)}>
            <span>Хүргэлт</span>
            <span class={css({ fontWeight: "600" })}>{money(props.order.deliveryFee)}</span>
          </div>
          <div class={css(receiptRow, { fontSize: "20px", fontWeight: "700" })}>
            <span>Нийт</span>
            <span>{money(props.order.total)}</span>
          </div>
        </div>
        <For each={props.order.payments} keyed={(payment) => payment.id}>
          {(payment) => (
            <div
              class={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: "20px",
                py: "14px",
                bg: "paidBg",
                color: "paid",
                textStyle: "body",
                fontWeight: "650",
                fontVariantNumeric: "tabular-nums",
                "& + &": { boxShadow: "inset 0 .5px 0 {colors.paid/20}" },
              })}
            >
              <span class={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                <CheckCircleIcon />
                <span>
                  Төлсөн
                  <small class={css({ display: "block", textStyle: "subhead", fontWeight: "500" })}>
                    {methodText[payment().method]} · {clock.format(payment().createdAt)}
                  </small>
                </span>
              </span>
              {money(payment().amount)}
            </div>
          )}
        </For>
        <Show when={owing(props.order)}>
          <div
            class={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: "20px",
              py: "14px",
              bg: "owesBg",
              color: "owes",
              textStyle: "body",
              fontWeight: "650",
              fontVariantNumeric: "tabular-nums",
            })}
          >
            <span>{props.order.terms === "cod" ? "Хүргэлтээр авах" : "Төлбөр хүлээж"}</span>
            {money(props.order.balance)}
          </div>
        </Show>
      </div>
      <Show when={owing(props.order)}>
        <button
          type="button"
          onClick={() => props.onPay()}
          class={css(button, { width: "100%", mt: "14px" })}
        >
          Мөнгө авсан
        </button>
      </Show>
    </section>
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
          class={css(button, large, { flex: 1 })}
        >
          Үгүй
        </button>
        <button
          type="button"
          disabled={props.busy}
          onClick={() => props.onCancel()}
          class={css(button, large, { flex: 1, bg: "owes", color: "white" })}
        >
          Цуцлах
        </button>
      </div>
    </Sheet>
  );
}
