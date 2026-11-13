import { OrderNumber } from "@amerik/contracts";
import type { ListOrders, OrderCounts, OrderSummary } from "@amerik/contracts";
import { useSearchParams } from "@solidjs/router";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { createMemo, Errored, For, isPending, Loading, refresh, Show, useContext } from "solid-js";
import { css } from "styled-system/css";
import SearchIcon from "~icons/ph/magnifying-glass";
import PlusIcon from "~icons/ph/plus-bold";
import WarningIcon from "~icons/ph/warning-circle-fill";

import { ApiClient } from "../../api/client";
import { runEffect } from "../../api/solid-effect";
import { clock, dayTitle, daysBetween, money, phone } from "../../format";
import { HeldSteps, nextStep, payment, StepButton } from "../../orders";
import { Tile } from "../../photos";
import { button, press, round } from "../../styles";
import {
  appear,
  groupHead,
  hairline,
  oneLine,
  panel,
  Problem,
  searchBox,
  tones,
  top,
} from "../../ui";
import { ListSkeleton } from "../../skeletons";
import { StickyBar, Tab, TabBar, Tabs } from "../../bars";
import { statusText } from "../../words";

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
  count: keyof OrderCounts | undefined;
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

/** Days a ready order has waited to ship, from the second day on. */
const waitingDays = (order: Pick<OrderSummary, "status" | "terms" | "createdAt">, now: Date) => {
  if (nextStep(order)?.step !== "ship") return undefined;

  const days = daysBetween(order.createdAt, now);

  return days >= 2 ? days : undefined;
};

export default function Orders() {
  const [params, setParams] = useSearchParams<{ view?: string; q?: string }>();
  const view = () => views.find((candidate) => candidate.key === params.view) ?? views[0];
  const input = createMemo(() => searchOf(params.q ?? "") ?? view().input);

  const orders = createMemo(() => {
    const filter = input();

    return runEffect(ApiClient.use((api) => api.listOrders(filter)));
  });

  const counts = createMemo(() => runEffect(ApiClient.use((api) => api.orderCounts())));
  const now = createMemo(() => runEffect(DateTime.nowAsDate));

  const reload = async () => {
    await Promise.all([refresh(orders), refresh(counts)]);
  };

  // Titles aren't integer-like, so the record keeps the list's newest-first order.
  const days = () => {
    const today = now();

    return Object.entries(Arr.groupBy(orders(), (order) => dayTitle(order.createdAt, today)));
  };

  const lines = () => orders().flatMap((order) => order.lines);
  const pieces = () => lines().reduce((sum, line) => sum + line.quantity, 0);

  // Three different bottles from today's parcels on the packing row.
  const thumbs = () =>
    lines()
      .filter(
        (line, at, all) => all.findIndex((other) => other.productId === line.productId) === at,
      )
      .slice(0, 3);

  return (
    <main class={css(top, { maxWidth: "640px", mx: "auto", px: "16px", pb: "104px" })}>
      <header class={css({ display: "flex", alignItems: "center", gap: "10px", pb: "10px" })}>
        <h1 class={css({ flex: 1, textStyle: "title" })}>Захиалга</h1>
        <a href="/orders/new" aria-label="Шинэ захиалга" class={round({ tone: "butter" })}>
          <PlusIcon />
        </a>
      </header>

      <StickyBar>
        <label class={css(searchBox)}>
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

        <Tabs current={view().key}>
          <For each={views}>
            {(candidate) => (
              <Tab
                href={candidate.key === "to_ship" ? "/orders" : `/orders?view=${candidate.key}`}
                current={view().key === candidate.key}
                label={candidate.label}
                count={candidate.count && counts()[candidate.count]}
              />
            )}
          </For>
        </Tabs>
      </StickyBar>

      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<ListSkeleton />}>
          {/* A new filter keeps the old list on screen, dimmed, until the new one lands. */}
          <div
            class={css(appear, {
              transition: "opacity .2s ease",
              "&[data-pending]": { opacity: 0.55 },
            })}
            data-pending={isPending(() => orders()) || undefined}
          >
            <Show when={view().key === "to_ship" && params.q === undefined && orders().length > 0}>
              <a
                href="/pack"
                class={css(panel, press, {
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  mt: "12px",
                  p: "10px 12px",
                })}
              >
                <span class={css({ display: "flex", gap: "2px", flex: "none" })}>
                  <For each={thumbs()} keyed={(line) => line.productId}>
                    {(line) => <Tile product={line()} size={36} still />}
                  </For>
                </span>
                <span class={css({ flex: 1, minWidth: 0, fontVariantNumeric: "tabular-nums" })}>
                  <b class={css({ display: "block", textStyle: "headline" })}>
                    {orders().length} илгээмж
                  </b>
                  <span class={css({ display: "block", textStyle: "subhead", color: "inkMuted" })}>
                    {pieces()} ширхэг
                  </span>
                </span>
                <span class={button({ tone: "butter", size: "sm" })}>Савлах</span>
              </a>
            </Show>

            <Show
              when={orders().length > 0}
              fallback={
                <p
                  class={css({
                    py: "48px",
                    textAlign: "center",
                    textStyle: "subhead",
                    color: "inkMuted",
                  })}
                >
                  Захиалга алга
                </p>
              }
            >
              <For each={days()} keyed={([title]) => title}>
                {(day) => (
                  <section>
                    <h2 class={css(groupHead)}>
                      {day()[0]}
                      <small>{day()[1].length}</small>
                    </h2>
                    <div class={css(panel)}>
                      <For each={day()[1]} keyed={(order) => order.id}>
                        {(order) => <Row order={order()} now={now()} reload={reload} />}
                      </For>
                    </div>
                  </section>
                )}
              </For>
            </Show>
          </div>
        </Loading>
      </Errored>
      <TabBar />
    </main>
  );
}

/**
 * One order in three lines: phone, time and total; how it's paid and the
 * address; then a photo per product with ×N, and the next step.
 */
function Row(props: { order: OrderSummary; now: Date; reload: () => Promise<void> }) {
  const { failure, secondsLeft } = useContext(HeldSteps);
  const held = () => secondsLeft(props.order.id);

  return (
    <div
      class={css(hairline, {
        px: "16px",
        pt: "10px",
        pb: "12px",
        bg: "card",
        transition: "background-color 120ms ease",
        "&:has(> a:active)": { bg: "fill" },
      })}
    >
      {/* The whole row opens the order; photos and the step button sit above it. */}
      <a
        href={`/orders/${props.order.id}`}
        aria-label={`#${props.order.number}`}
        class={css({ position: "absolute", inset: 0 })}
      />
      <div
        class={css({
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          fontVariantNumeric: "tabular-nums",
        })}
      >
        <b class={css({ textStyle: "headline", fontWeight: "700", letterSpacing: "0.01em" })}>
          <Show when={props.order.customerPhone} fallback="Утасгүй">
            {(digits) => <>{phone(digits())}</>}
          </Show>
        </b>
        <span class={css({ textStyle: "subhead", color: "inkMuted" })}>
          {clock.format(props.order.createdAt)}
        </span>
        <Show when={waitingDays(props.order, props.now)}>
          {(days) => (
            <span class={css({ textStyle: "subhead", fontWeight: "600", color: "wait" })}>
              {days()} хоног
            </span>
          )}
        </Show>
        <b class={css({ ml: "auto", textStyle: "headline", fontWeight: "700" })}>
          {money(props.order.total)}
        </b>
      </div>

      <Show
        when={held()}
        fallback={
          <div
            class={css({
              display: "flex",
              gap: "6px",
              mt: "2px",
              textStyle: "subhead",
              color: "inkMuted",
            })}
          >
            <Show when={payment(props.order)}>
              {(paid) => (
                <>
                  <span
                    class={css(tones[paid().tone], {
                      flex: "none",
                      bg: "transparent",
                      fontWeight: "600",
                    })}
                  >
                    {paid().text}
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
            </Show>
            <span class={css(oneLine)}>{props.order.address ?? "Хаяггүй"}</span>
          </div>
        }
      >
        {(left) => (
          <div class={css({ mt: "2px", textStyle: "subhead", fontWeight: "600" })}>
            {left()} секундын дараа {nextStep(props.order)?.label}
          </div>
        )}
      </Show>

      <Show when={props.order.notes}>
        {(notes) => (
          <div
            class={css({
              display: "flex",
              alignItems: "center",
              gap: "6px",
              mt: "2px",
              textStyle: "subhead",
              fontWeight: "600",
              color: "waitInk",
              "& svg": { flex: "none", color: "wait" },
            })}
          >
            <WarningIcon />
            <span class={css(oneLine)}>{notes()}</span>
          </div>
        )}
      </Show>

      <Show when={failure(props.order.id)}>
        {(text) => (
          <div class={css({ mt: "2px", textStyle: "subhead", fontWeight: "600", color: "owe" })}>
            {text()}
          </div>
        )}
      </Show>

      <div class={css({ display: "flex", alignItems: "flex-end", gap: "10px", mt: "10px" })}>
        <div class={css({ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: "10px" })}>
          <For each={props.order.lines} keyed={(line) => line.productId}>
            {(line) => <Tile product={line()} size={48} quantity={line().quantity} ring="card" />}
          </For>
        </div>
        <Show
          when={nextStep(props.order)}
          fallback={
            <Show when={props.order.status === "delivered" || props.order.status === "cancelled"}>
              <span class={css({ textStyle: "subhead", color: "inkMuted", whiteSpace: "nowrap" })}>
                {statusText[props.order.status]}
              </span>
            </Show>
          }
        >
          <StepButton order={props.order} reload={props.reload} size="sm" />
        </Show>
      </div>
    </div>
  );
}
