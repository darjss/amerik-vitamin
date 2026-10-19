import { OrderNumber } from "@amerik/contracts";
import type { ListOrders } from "@amerik/contracts";
import { useSearchParams } from "@solidjs/router";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { createMemo, Errored, For, Loading, refresh, Show, useContext } from "solid-js";
import { css } from "styled-system/css";
import NoteIcon from "~icons/ph/note-pencil";
import SearchIcon from "~icons/ph/magnifying-glass";
import PlusIcon from "~icons/ph/plus";

import { ApiClient } from "../../api/client";
import { runEffect } from "../../api/solid-effect";
import { phone } from "../../format";
import { HeldSteps, nextStep } from "../../steps";
import {
  block,
  button,
  darkButton,
  muted,
  PayPill,
  PhotoStrip,
  Pill,
  Problem,
  ShipPill,
  StepButton,
  TabBar,
  top,
} from "../../ui";

const views = [
  { key: "to_ship", label: "Илгээх", count: "toShip", input: { queue: "to_ship" } },
  {
    key: "awaiting",
    label: "Төлбөр хүлээж",
    count: "awaitingPayment",
    input: { queue: "awaiting_payment" },
  },
  { key: "shipped", label: "Замд", count: "shipped", input: { status: "shipped" } },
  { key: "all", label: "Бүгд", count: undefined, input: {} },
] satisfies ReadonlyArray<{
  key: string;
  label: string;
  count: "toShip" | "awaitingPayment" | "shipped" | undefined;
  input: ListOrders;
}>;

/** Five digits is an order number; 3 to 8 other digits are part of a phone. */
const searchOf = (query: string): ListOrders | undefined => {
  const digits = query.replaceAll(/\s/gu, "");

  if (/^\d{5}$/u.test(digits)) {
    return Option.getOrUndefined(
      Option.map(Schema.decodeUnknownOption(OrderNumber)(Number(digits)), (number) => ({
        number,
      })),
    );
  }

  return /^\d{3,8}$/u.test(digits) ? { phone: digits } : undefined;
};

const chip = css.raw({
  display: "inline-flex",
  gap: "6px",
  borderRadius: "18px",
  px: "14px",
  height: "36px",
  alignItems: "center",
  fontWeight: "600",
  fontSize: "15px",
  whiteSpace: "nowrap",
  bg: "chip",
  color: "ink",
  "& span": { color: "inkMuted", fontVariantNumeric: "tabular-nums" },
});

const chipOn = css.raw({ bg: "clay", color: "white", "& span": { color: "white" } });

const ellipsis = css.raw({ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });

const DAY_MS = 86_400_000;

/** Days a ready order has waited to ship, from the second day on. */
const waitingDays = (order: Parameters<typeof nextStep>[0] & { createdAt: Date }, now: Date) => {
  if (nextStep(order)?.step !== "ship") return undefined;

  const days = Math.floor((now.getTime() - order.createdAt.getTime()) / DAY_MS);

  return days >= 2 ? days : undefined;
};

export default function Orders() {
  const [params, setParams] = useSearchParams<{ view?: string; q?: string }>();
  const { secondsLeft } = useContext(HeldSteps);
  const view = () => views.find((candidate) => candidate.key === params.view) ?? views[0];
  const input = createMemo(() => searchOf(params.q ?? "") ?? view().input);

  const orders = createMemo(() => {
    const filter = input();

    return runEffect(ApiClient.use((api) => api.listOrders(filter)));
  });

  const counts = createMemo(() => runEffect(ApiClient.use((api) => api.orderCounts())));
  const now = createMemo(() => runEffect(DateTime.nowAsDate));
  const reload = () => Promise.all([refresh(orders), refresh(counts)]);

  const pieces = () =>
    orders().reduce(
      (total, order) => total + order.lines.reduce((sum, line) => sum + line.quantity, 0),
      0,
    );

  return (
    <main class={css(top, { pb: "100px" })}>
      <div class={css({ display: "flex", gap: "8px", px: "16px", pb: "10px" })}>
        <label
          class={css({
            flex: 1,
            height: "44px",
            borderRadius: "12px",
            bg: "chip",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            px: "12px",
            color: "inkMuted",
            "& svg": { fontSize: "18px" },
            "& input": {
              flex: 1,
              minWidth: 0,
              bg: "transparent",
              outline: "none",
              color: "ink",
              fontSize: "16px",
            },
          })}
        >
          <SearchIcon />
          <input
            type="search"
            inputmode="numeric"
            placeholder="Утас эсвэл дугаар"
            value={params.q ?? ""}
            onInput={(event) =>
              setParams({ q: event.currentTarget.value || undefined }, { replace: true })
            }
          />
        </label>
        <a
          href="/orders/new"
          aria-label="Шинэ захиалга"
          class={css(button, darkButton, { width: "44px", px: 0, "& svg": { fontSize: "22px" } })}
        >
          <PlusIcon />
        </a>
      </div>

      <nav class={css({ display: "flex", gap: "8px", px: "16px", pb: "12px", overflowX: "auto" })}>
        <For each={views}>
          {(candidate) => (
            <a
              href={candidate.key === "to_ship" ? "/orders" : `/orders?view=${candidate.key}`}
              class={css(chip, view().key === candidate.key && chipOn)}
            >
              {candidate.label}
              <Show when={candidate.count}>
                {(key) => (
                  <Loading fallback={null}>
                    <span>{counts()[key()]}</span>
                  </Loading>
                )}
              </Show>
            </a>
          )}
        </For>
      </nav>

      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(block, { height: "240px" })} />}>
          <Show when={view().key === "to_ship" && params.q === undefined && orders().length > 0}>
            <div
              class={css(block, {
                display: "flex",
                alignItems: "center",
                gap: "12px",
                px: "16px",
                py: "12px",
              })}
            >
              <div class={css({ flex: 1 })}>
                <b class={css({ fontSize: "17px", fontWeight: "600" })}>
                  {orders().length} илгээмж · {pieces()} ширхэг
                </b>
                <small class={css(muted, { display: "block", fontSize: "14px" })}>
                  Нэг нэгээр нь савлаад TU-д өгнө
                </small>
              </div>
              <a href="/pack" class={css(button, darkButton)}>
                Савлах
              </a>
            </div>
          </Show>

          <Show
            when={orders().length > 0}
            fallback={
              <p class={css(muted, { px: "16px", py: "32px", textAlign: "center" })}>
                Захиалга алга
              </p>
            }
          >
            <div class={css(block)}>
              <For each={orders()} keyed={(order) => order.id}>
                {(order) => (
                  <div
                    class={css(
                      {
                        position: "relative",
                        px: "16px",
                        py: "12px",
                        "& + &": { borderTop: "1px solid {colors.line}" },
                      },
                      secondsLeft(order().id) !== undefined && {
                        boxShadow: "inset 3px 0 0 {colors.clay}",
                      },
                    )}
                  >
                    {/* The whole row opens the order; photos and the step button sit above it. */}
                    <a
                      href={`/orders/${order().id}`}
                      aria-label={`#${order().number}`}
                      class={css({ position: "absolute", inset: 0 })}
                    />
                    <div class={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                      <b
                        class={css({
                          fontSize: "17px",
                          fontWeight: "600",
                          fontVariantNumeric: "tabular-nums",
                        })}
                      >
                        <Show when={order().customerPhone} fallback="Утасгүй">
                          {(digits) => phone(digits())}
                        </Show>
                      </b>
                      <Show when={waitingDays(order(), now())}>
                        {(days) => <Pill tone="ship">{days()} хоног</Pill>}
                      </Show>
                      <span class={css({ ml: "auto" })}>
                        <PayPill order={order()} />
                      </span>
                    </div>
                    <Show
                      when={secondsLeft(order().id)}
                      fallback={
                        <div class={css(ellipsis, muted, { fontSize: "15px", mt: "2px" })}>
                          {order().address}
                        </div>
                      }
                    >
                      {(left) => (
                        <div class={css({ fontSize: "15px", fontWeight: "600", mt: "2px" })}>
                          {left()} секундын дараа {nextStep(order())?.label}
                        </div>
                      )}
                    </Show>
                    <Show when={order().notes}>
                      {(notes) => (
                        <div
                          class={css({
                            display: "flex",
                            gap: "6px",
                            alignItems: "flex-start",
                            fontSize: "15px",
                            mt: "4px",
                            "& svg": { flex: "none", mt: "2px", color: "inkMuted" },
                          })}
                        >
                          <NoteIcon />
                          {notes()}
                        </div>
                      )}
                    </Show>
                    <div
                      class={css({
                        display: "flex",
                        alignItems: "flex-end",
                        gap: "12px",
                        mt: "10px",
                      })}
                    >
                      <div class={css({ flex: 1, minWidth: 0 })}>
                        <PhotoStrip lines={order().lines} size={56} />
                      </div>
                      <Show when={nextStep(order()) === undefined}>
                        <ShipPill status={order().status} />
                      </Show>
                      <StepButton order={order()} onDone={() => void reload()} />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Loading>
      </Errored>
      <TabBar />
    </main>
  );
}
