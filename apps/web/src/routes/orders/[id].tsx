import { OrderId } from "@amerik/contracts";
import type {
  EditOrder,
  ManualPayment,
  OrderDetail,
  OrderSource,
  PaymentMethod,
} from "@amerik/contracts";
import { useParams } from "@solidjs/router";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import {
  action,
  createMemo,
  createOptimistic,
  createSignal,
  Errored,
  For,
  Loading,
  onCleanup,
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
import { runEffect, RuntimeContext } from "../../api/solid-effect";
import { clock, failureText, money, offline, phone, when } from "../../format";
import {
  EditSheet,
  HeldSteps,
  History,
  nextStep,
  PaySheet,
  StepButton,
  Tracker,
} from "../../orders";
import {
  appear,
  button,
  Dock,
  Failed,
  glass,
  glassBar,
  headline,
  large,
  largeTitle,
  Note,
  panel,
  Problem,
  round,
  roundAct,
  section,
  sectionHead,
  Sheet,
  sub,
  Tile,
  title2,
} from "../../ui";
import { DetailSkeleton } from "../../skeletons";

const headlineOf = (order: OrderDetail) => {
  if (order.status === "cancelled") return "Цуцалсан";

  if (order.status === "delivered") return "Хүргэгдсэн";

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

const methodText: Record<PaymentMethod, string> = {
  qpay: "QPay",
  transfer: "Шилжүүлэг",
  cash: "Бэлэн",
};

const payText = (order: OrderDetail) => {
  const last = order.payments.at(-1);

  if (order.balance <= 0 && last !== undefined) return `${methodText[last.method]} төлсөн`;

  return order.terms === "cod" ? "Хүргэлтээр төлнө" : "Төлбөр хүлээж";
};

const editable = (order: OrderDetail) => order.status === "new" || order.status === "paid";

const receiptRow = css.raw({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  py: "5px",
  fontSize: "17px",
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
  const runtime = useContext(RuntimeContext);
  const { failure } = useContext(HeldSteps);
  const [busy, setBusy] = createOptimistic(false);
  const [failed, setFailed] = createSignal<string>();
  const [copied, setCopied] = createSignal(false);
  const [sheet, setSheet] = createSignal<"menu" | "pay" | "edit" | "cancel">();

  const open = (next: ReturnType<typeof sheet>) => {
    setFailed(undefined);
    setSheet(next);
  };

  // Runs to completion even if she leaves the page. A failure keeps the sheet open and says why.
  const write = action(async function* write<A, E extends { readonly _tag: string }>(
    effect: Effect.Effect<A, E, ApiClient>,
  ) {
    setBusy(true);
    const exit = await runtime.runPromiseExit(effect);
    yield;

    if (Exit.isFailure(exit)) setFailed(failureText(exit.cause));
    else open(undefined);

    // A reload shows what changed, unless the network is down and it would fail too.
    if (Exit.isSuccess(exit) || !offline(exit.cause)) yield refresh(order);
  });

  const reload = async () => {
    await refresh(order);
  };

  const pay = (amount: number, method: ManualPayment["method"]) => {
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
    const lines = current.lines.map(({ productId, quantity }) => ({ productId, quantity }));

    if (!Arr.isArrayNonEmpty(lines)) return;

    const input = {
      orderId: current.id,
      address,
      notes,
      deliveryFee: current.deliveryFee,
      lines,
    } satisfies EditOrder;

    return write(ApiClient.use((api) => api.editOrder(input)));
  };

  let copiedReset: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copiedReset));

  const copy = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    clearTimeout(copiedReset);
    copiedReset = setTimeout(() => setCopied(false), 2000);
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
                class={css(headline, {
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
              <h1 class={css(largeTitle)}>{headlineOf(order())}</h1>
              <p class={css(sub, { mt: "6px" })}>
                {payText(order())} · {when(order().createdAt, now())} · {sourceText[order().source]}
              </p>
            </div>

            <Show when={order().status !== "cancelled"}>
              <Tracker order={order()} />
            </Show>

            <section class={css(section)}>
              <div class={css(sectionHead)}>
                <h2 class={css(title2)}>Бараа</h2>
                <span class={css(sub, { fontVariantNumeric: "tabular-nums" })}>
                  {order().lines.reduce((total, line) => total + line.quantity, 0)} ширхэг
                </span>
              </div>
              <div class={css({ display: "grid", gap: "16px" })}>
                <For each={order().lines} keyed={(line) => line.productId}>
                  {(line) => (
                    <div class={css({ display: "flex", alignItems: "center", gap: "14px" })}>
                      <Tile product={line()} size={64} quantity={line().quantity} soft />
                      <div class={css({ flex: 1, minWidth: 0 })}>
                        <div class={css(headline)}>{line().name}</div>
                        <div class={css(sub)}>
                          {line().brand} · {line().count} ш
                        </div>
                      </div>
                      <span
                        class={css({
                          fontSize: "17px",
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

            <section class={css(section)}>
              <div class={css(sectionHead)}>
                <h2 class={css(title2)}>Захиалагч</h2>
              </div>
              <Show when={order().customerPhone}>
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
                      <History phone={digits()} orders={order().customerOrders} />
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
                  disabled={!editable(order())}
                  onClick={() => open("edit")}
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
                  {order().address ?? "Хаяггүй"}
                </button>
                <Show when={order().address}>
                  {(address) => (
                    <button
                      type="button"
                      aria-label="Хаяг хуулах"
                      onClick={() => copy(address())}
                      class={css(round, copied() && { bg: "paidBg", color: "paid" })}
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
                    onClick={() => open("edit")}
                    class={css({ display: "block", width: "100%", mt: "14px", cursor: "pointer" })}
                  >
                    <Note>{notes()}</Note>
                  </button>
                )}
              </Show>
            </section>

            <section class={css(section)}>
              <div class={css(sectionHead)}>
                <h2 class={css(title2)}>Төлбөр</h2>
              </div>
              <div class={css(panel, { overflow: "hidden" })}>
                <div class={css({ px: "20px", py: "16px" })}>
                  <div class={css(receiptRow)}>
                    <span>Бараа</span>
                    <span class={css({ fontWeight: "600" })}>
                      {money(order().total - order().deliveryFee)}
                    </span>
                  </div>
                  <div class={css(receiptRow)}>
                    <span>Хүргэлт</span>
                    <span class={css({ fontWeight: "600" })}>{money(order().deliveryFee)}</span>
                  </div>
                  <div class={css(receiptRow, { fontSize: "20px", fontWeight: "700" })}>
                    <span>Нийт</span>
                    <span>{money(order().total)}</span>
                  </div>
                </div>
                <For each={order().payments} keyed={(payment) => payment.id}>
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
                        fontSize: "17px",
                        fontWeight: "650",
                        fontVariantNumeric: "tabular-nums",
                        "& + &": { boxShadow: "inset 0 .5px 0 {colors.paid/20}" },
                      })}
                    >
                      <span class={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                        <CheckCircleIcon />
                        <span>
                          Төлсөн
                          <small
                            class={css({ display: "block", fontSize: "15px", fontWeight: "500" })}
                          >
                            {methodText[payment().method]} · {clock(payment().createdAt)}
                          </small>
                        </span>
                      </span>
                      {money(payment().amount)}
                    </div>
                  )}
                </For>
                <Show when={order().balance > 0 && order().status !== "cancelled"}>
                  <div
                    class={css({
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      px: "20px",
                      py: "14px",
                      bg: "owesBg",
                      color: "owes",
                      fontSize: "17px",
                      fontWeight: "650",
                      fontVariantNumeric: "tabular-nums",
                    })}
                  >
                    <span>{order().terms === "cod" ? "Хүргэлтээр авах" : "Төлбөр хүлээж"}</span>
                    {money(order().balance)}
                  </div>
                </Show>
              </div>
              <Show when={order().balance > 0 && order().status !== "cancelled"}>
                <button
                  type="button"
                  onClick={() => open("pay")}
                  class={css(button, { width: "100%", mt: "14px" })}
                >
                  Мөнгө авсан
                </button>
              </Show>
            </section>

            {/* A failed step keeps the dock even when the order has no next step left. */}
            <Show when={nextStep(order()) !== undefined || failure(order().id) !== undefined}>
              <Dock>
                <Failed text={failure(order().id)} />
                <StepButton order={order()} reload={reload} wide />
              </Dock>
            </Show>

            <Sheet open={sheet() === "menu"} title="Захиалга" onClose={() => open(undefined)}>
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
              onClose={() => open(undefined)}
              onSave={pay}
            />

            <EditSheet
              open={sheet() === "edit"}
              order={order()}
              busy={busy()}
              failed={failed()}
              onClose={() => open(undefined)}
              onSave={edit}
            />

            <Sheet
              open={sheet() === "cancel"}
              title="Захиалга цуцлах уу?"
              onClose={() => open(undefined)}
            >
              <p class={css(sub, { pb: "18px" })}>
                Цуцалсан захиалгыг буцааж сэргээх боломжгүй. Төлсөн мөнгийг өөрөө буцааж өгнө.
              </p>
              <Failed text={failed()} />
              <div class={css({ display: "flex", gap: "10px" })}>
                <button
                  type="button"
                  onClick={() => open(undefined)}
                  class={css(button, large, { flex: 1 })}
                >
                  Үгүй
                </button>
                <button
                  type="button"
                  disabled={busy()}
                  onClick={cancel}
                  class={css(button, large, { flex: 1, bg: "owes", color: "white" })}
                >
                  Цуцлах
                </button>
              </div>
            </Sheet>
          </div>
        </Loading>
      </Errored>
    </main>
  );
}
