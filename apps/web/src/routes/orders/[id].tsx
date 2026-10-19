import { OrderId } from "@amerik/contracts";
import type { OrderDetail, OrderSource } from "@amerik/contracts";
import { useParams } from "@solidjs/router";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
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
import MoreIcon from "~icons/ph/dots-three-bold";
import NoteIcon from "~icons/ph/note-pencil";
import PhoneIcon from "~icons/ph/phone";
import TruckIcon from "~icons/ph/truck";

import { ApiClient } from "../../api/client";
import { runEffect, RuntimeContext } from "../../api/solid-effect";
import { clock, money, phone, when } from "../../format";
import { advance, nextStep } from "../../steps";
import type { Step } from "../../steps";
import {
  bigButton,
  block,
  blockTitle,
  button,
  darkButton,
  field,
  muted,
  PayPill,
  Photo,
  Problem,
  Sheet,
  top,
} from "../../ui";

type Order = typeof OrderDetail.Type;

const headline = (order: Order) => {
  if (order.status === "cancelled") return "Цуцалсан";

  if (order.status === "delivered") return "Хүргэсэн";

  if (order.status === "shipped") return "Замд";

  if (order.status === "paid" || order.terms === "cod") return "Илгээхэд бэлэн";

  return "Төлбөр хүлээж байна";
};

const sourceText: Record<OrderSource, string> = {
  messenger_bot: "Messenger бот",
  messenger_human: "Чат",
  web: "Вэб",
  brand_site: "Брэнд сайт",
  phone: "Утас",
  walk_in: "Дэлгүүр",
  notebook: "Дэвтэр",
};

const methodText = { qpay: "QPay", transfer: "Шилжүүлэг", cash: "Бэлэн" };

const payText = (order: Order) => {
  const last = order.payments.at(-1);

  if (order.balance <= 0 && last !== undefined) return `${methodText[last.method]} төлсөн`;

  return order.terms === "cod" ? "Хүргэлтээр төлнө" : "Төлбөр хүлээж";
};

/** COD is paid at the door, so its payment step comes last. */
const steps = (order: Order) => {
  const placed = { label: "Захиалсан", done: true };
  const paid = { label: "Төлсөн", done: order.paid > 0 && order.balance <= 0 };

  const shipped = {
    label: "Илгээсэн",
    done: order.status === "shipped" || order.status === "delivered",
  };

  const delivered = { label: "Хүргэсэн", done: order.status === "delivered" };

  return order.terms === "cod"
    ? [placed, shipped, delivered, paid]
    : [placed, paid, shipped, delivered];
};

const editable = (order: Order) => order.status === "new" || order.status === "paid";

const row = css.raw({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  px: "16px",
  py: "12px",
  "& + &": { borderTop: "1px solid {colors.line}" },
});

const circle = css.raw({
  width: "44px",
  height: "44px",
  borderRadius: "50%",
  bg: "chip",
  display: "grid",
  placeItems: "center",
  flex: "none",
  cursor: "pointer",
  "& svg": { fontSize: "20px" },
});

const kv = css.raw({
  display: "flex",
  justifyContent: "space-between",
  py: "4px",
  fontSize: "15px",
});

export default function OrderPage() {
  const params = useParams<{ id: OrderId }>();
  const orderId = () => Schema.decodeUnknownSync(OrderId)(params.id);

  const order = createMemo(() => {
    const id = orderId();

    return runEffect(ApiClient.use((api) => api.getOrder({ orderId: id })));
  });

  const now = createMemo(() => runEffect(DateTime.nowAsDate));
  const runtime = useContext(RuntimeContext);
  const [busy, setBusy] = createOptimistic(false);
  const [failed, setFailed] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [sheet, setSheet] = createSignal<"menu" | "pay" | "edit" | "cancel">();

  // Runs to completion even if she leaves the page.
  const write = action(function* write<A, E>(effect: Effect.Effect<A, E, ApiClient>) {
    setBusy(true);
    setFailed(false);

    try {
      yield runtime.runPromise(effect);
      setSheet(undefined);
    } catch {
      setFailed(true);
    }

    yield refresh(order);
  });

  const take = (step: Step) => write(advance(orderId(), step));

  const pay = (amount: number, method: "cash" | "transfer") => {
    const id = orderId();

    return write(ApiClient.use((api) => api.recordPayment({ orderId: id, amount, method })));
  };

  const cancel = () => {
    const id = orderId();

    return write(ApiClient.use((api) => api.cancelOrder({ orderId: id })));
  };

  // The lines go back unchanged: editOrder takes the full line list.
  const edit = (address: string, notes: string) => {
    const current = order();
    const [first, ...rest] = current.lines;

    if (first === undefined) return;

    const line = ({ productId, quantity }: typeof first) => ({ productId, quantity });

    return write(
      ApiClient.use((api) =>
        api.editOrder({
          orderId: current.id,
          address,
          notes,
          deliveryFee: current.deliveryFee,
          lines: [line(first), ...rest.map(line)],
        }),
      ),
    );
  };

  const copy = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
  };

  return (
    <main class={css(top, { pb: "120px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(block, { height: "300px", mt: "60px" })} />}>
          <div
            class={css({
              display: "flex",
              alignItems: "center",
              px: "8px",
              pb: "4px",
              "& svg": { fontSize: "24px" },
            })}
          >
            <a href="/orders" aria-label="Буцах" class={css({ p: "8px" })}>
              <BackIcon />
            </a>
            <b class={css({ flex: 1, textAlign: "center", fontSize: "17px", fontWeight: "600" })}>
              #{order().number}
            </b>
            <button
              type="button"
              aria-label="Бусад үйлдэл"
              onClick={() => setSheet("menu")}
              class={css({ p: "8px", cursor: "pointer" })}
            >
              <MoreIcon />
            </button>
          </div>

          <section class={css({ px: "16px", pt: "6px", pb: "16px" })}>
            <h1
              class={css({
                fontSize: "26px",
                lineHeight: "32px",
                fontWeight: "700",
                letterSpacing: "-0.3px",
              })}
            >
              {headline(order())}
            </h1>
            <p class={css(muted, { fontSize: "15px", mt: "2px" })}>
              {payText(order())} · {when(order().createdAt, now())} · {sourceText[order().source]}
            </p>
            <div
              class={css({
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "6px",
                mt: "14px",
              })}
            >
              <For each={steps(order())}>
                {(step) => (
                  <div>
                    <span
                      class={css(
                        { display: "block", height: "4px", borderRadius: "2px", bg: "line" },
                        step.done && { bg: "clay" },
                      )}
                    />
                    <span
                      class={css(
                        { display: "block", fontSize: "12px", mt: "6px", color: "inkMuted" },
                        step.done && { color: "ink", fontWeight: "600" },
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </section>

          <div class={css(block)}>
            <h2 class={css(blockTitle)}>
              {order().lines.reduce((total, line) => total + line.quantity, 0)} ширхэг
            </h2>
            <For each={order().lines} keyed={(line) => line.productId}>
              {(line) => (
                <div class={css(row)}>
                  <Photo product={line()} size={72} />
                  <div class={css({ flex: 1, minWidth: 0 })}>
                    <div class={css({ fontSize: "16px", fontWeight: "600" })}>{line().name}</div>
                    <div class={css(muted, { fontSize: "14px" })}>
                      {line().brand} · {line().count} ш
                    </div>
                  </div>
                  <div class={css({ textAlign: "right", fontVariantNumeric: "tabular-nums" })}>
                    <b class={css({ fontSize: "22px", fontWeight: "700", color: "clay" })}>
                      ×{line().quantity}
                    </b>
                    <div class={css(muted, { fontSize: "14px" })}>
                      {money(line().unitPrice * line().quantity)}
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>

          <div class={css(block)}>
            <Show when={order().customerPhone}>
              {(digits) => (
                <div class={css(row)}>
                  <div class={css({ flex: 1 })}>
                    <div
                      class={css({
                        fontSize: "17px",
                        fontWeight: "600",
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      {phone(digits())}
                    </div>
                    <Loading fallback={null}>
                      <History phone={digits()} />
                    </Loading>
                  </div>
                  <a href={`tel:${digits()}`} aria-label="Залгах" class={css(circle)}>
                    <PhoneIcon />
                  </a>
                </div>
              )}
            </Show>
            <div class={css(row)}>
              <button
                type="button"
                disabled={!editable(order())}
                onClick={() => setSheet("edit")}
                class={css({ flex: 1, textAlign: "left", fontSize: "16px", cursor: "pointer" })}
              >
                {order().address ?? "Хаяггүй"}
              </button>
              <Show when={order().address}>
                {(address) => (
                  <button
                    type="button"
                    aria-label="Хаяг хуулах"
                    onClick={() => copy(address())}
                    class={css(circle, copied() && { bg: "paidBg", color: "paid" })}
                  >
                    <CopyIcon />
                  </button>
                )}
              </Show>
            </div>
            <Show when={order().notes}>
              {(notes) => (
                <button
                  type="button"
                  disabled={!editable(order())}
                  onClick={() => setSheet("edit")}
                  class={css(row, {
                    width: "100%",
                    textAlign: "left",
                    fontSize: "16px",
                    cursor: "pointer",
                    "& svg": { fontSize: "20px", color: "inkMuted", flex: "none" },
                  })}
                >
                  <NoteIcon />
                  {notes()}
                </button>
              )}
            </Show>
          </div>

          <div class={css(block, { px: "16px", py: "12px", fontVariantNumeric: "tabular-nums" })}>
            <div class={css(kv)}>
              <span class={css(muted)}>Бараа</span>
              <span>{money(order().total - order().deliveryFee)}</span>
            </div>
            <div class={css(kv)}>
              <span class={css(muted)}>Хүргэлт</span>
              <span>{money(order().deliveryFee)}</span>
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
            <div
              class={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderTop: "1px solid {colors.line}",
                mt: "8px",
                pt: "10px",
              })}
            >
              <b class={css({ fontSize: "20px", fontWeight: "700" })}>{money(order().total)}</b>
              <PayPill order={order()} />
            </div>
            <Show when={order().balance > 0 && order().status !== "cancelled"}>
              <button
                type="button"
                onClick={() => setSheet("pay")}
                class={css(button, { width: "100%", mt: "12px" })}
              >
                Мөнгө авсан
              </button>
            </Show>
          </div>

          <Show when={nextStep(order())}>
            {(next) => (
              <div
                class={css({
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
                  onClick={() => take(next().step)}
                  class={css(button, darkButton, bigButton, { width: "100%" })}
                >
                  <TruckIcon />
                  {next().label}
                </button>
              </div>
            )}
          </Show>

          <Sheet open={sheet() === "menu"} title="Захиалга" onClose={() => setSheet(undefined)}>
            <div class={css({ display: "grid", gap: "8px" })}>
              <button
                type="button"
                disabled={!editable(order())}
                onClick={() => setSheet("edit")}
                class={css(button, bigButton)}
              >
                Хаяг, тэмдэглэл засах
              </button>
              <Show when={editable(order())}>
                <button
                  type="button"
                  onClick={() => setSheet("cancel")}
                  class={css(button, bigButton, { color: "owes" })}
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
            onClose={() => setSheet(undefined)}
            onSave={pay}
          />

          <EditSheet
            open={sheet() === "edit"}
            order={order()}
            busy={busy()}
            onClose={() => setSheet(undefined)}
            onSave={edit}
          />

          <Sheet
            open={sheet() === "cancel"}
            title="Захиалга цуцлах уу?"
            onClose={() => setSheet(undefined)}
          >
            <p class={css(muted, { fontSize: "15px", pb: "16px" })}>
              Цуцалсан захиалгыг буцааж сэргээх боломжгүй. Төлсөн мөнгийг өөрөө буцааж өгнө.
            </p>
            <div class={css({ display: "flex", gap: "8px" })}>
              <button
                type="button"
                onClick={() => setSheet(undefined)}
                class={css(button, bigButton, { flex: 1 })}
              >
                Үгүй
              </button>
              <button
                type="button"
                disabled={busy()}
                onClick={cancel}
                class={css(button, bigButton, { flex: 1, bg: "owes", color: "white" })}
              >
                Цуцлах
              </button>
            </div>
          </Sheet>
        </Loading>
      </Errored>
    </main>
  );
}

/** How many orders this phone has placed; a tap lists them. */
function History(props: { phone: string }) {
  const orders = createMemo(() => {
    const digits = props.phone;

    return runEffect(
      ApiClient.use((api) => api.findCustomer({ phone: digits })).pipe(
        Effect.map((customer) => customer.orders),
        Effect.orElseSucceed(() => 0),
      ),
    );
  });

  return (
    <Show when={orders() > 1}>
      <a
        href={`/orders?view=all&q=${props.phone}`}
        class={css({ position: "relative", fontSize: "14px", color: "clay", fontWeight: "600" })}
      >
        Нийт {orders()} захиалга
      </a>
    </Show>
  );
}

/** Money she took by hand: COD cash from the courier, or a transfer she saw land. */
function PaySheet(props: {
  open: boolean;
  balance: number;
  busy: boolean;
  onClose: () => void;
  onSave: (amount: number, method: "cash" | "transfer") => void;
}) {
  const [method, setMethod] = createSignal<"cash" | "transfer">("cash");
  const [typed, setTyped] = createSignal<string>();
  const amount = () => Number((typed() ?? String(props.balance)).replaceAll(/\D/gu, ""));

  return (
    <Sheet open={props.open} title="Мөнгө авсан" onClose={() => props.onClose()}>
      <div class={css({ display: "flex", gap: "8px", pb: "12px" })}>
        <For
          each={
            [
              ["cash", "Бэлэн"],
              ["transfer", "Шилжүүлэг"],
            ] as const
          }
        >
          {([key, label]) => (
            <button
              type="button"
              onClick={() => setMethod(key)}
              class={css(button, { flex: 1 }, method() === key && { bg: "clay", color: "white" })}
            >
              {label}
            </button>
          )}
        </For>
      </div>
      <label class={css({ display: "block", pb: "16px" })}>
        <span class={css(muted, { display: "block", fontSize: "14px", pb: "6px" })}>Дүн, ₮</span>
        <input
          inputmode="numeric"
          value={(typed() ?? String(props.balance)).replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}
          onInput={(event) => setTyped(event.currentTarget.value)}
          class={css(field, { fontSize: "22px", fontWeight: "600" })}
        />
      </label>
      <button
        type="button"
        disabled={props.busy || amount() <= 0}
        onClick={() => props.onSave(amount(), method())}
        class={css(button, darkButton, bigButton, { width: "100%" })}
      >
        {money(amount())} бүртгэх
      </button>
    </Sheet>
  );
}

/** Address and note change until the parcel leaves. */
function EditSheet(props: {
  open: boolean;
  order: Order;
  busy: boolean;
  onClose: () => void;
  onSave: (address: string, notes: string) => void;
}) {
  const [address, setAddress] = createSignal<string>();
  const [notes, setNotes] = createSignal<string>();

  return (
    <Sheet open={props.open} title="Хаяг, тэмдэглэл" onClose={() => props.onClose()}>
      <label class={css({ display: "block", pb: "12px" })}>
        <span class={css(muted, { display: "block", fontSize: "14px", pb: "6px" })}>Хаяг</span>
        <textarea
          rows={3}
          value={address() ?? props.order.address ?? ""}
          onInput={(event) => setAddress(event.currentTarget.value)}
          class={css(field, { resize: "none" })}
        />
      </label>
      <label class={css({ display: "block", pb: "16px" })}>
        <span class={css(muted, { display: "block", fontSize: "14px", pb: "6px" })}>Тэмдэглэл</span>
        <input
          value={notes() ?? props.order.notes ?? ""}
          onInput={(event) => setNotes(event.currentTarget.value)}
          class={css(field)}
        />
      </label>
      <button
        type="button"
        disabled={props.busy}
        onClick={() =>
          props.onSave(address() ?? props.order.address ?? "", notes() ?? props.order.notes ?? "")
        }
        class={css(button, darkButton, bigButton, { width: "100%" })}
      >
        Хадгалах
      </button>
    </Sheet>
  );
}
