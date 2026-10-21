import { OrderNumber } from "@amerik/contracts";
import type { ListOrders, OrderCounts, OrderSummary } from "@amerik/contracts";
import { useSearchParams } from "@solidjs/router";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { createMemo, Errored, For, Loading, refresh, Show, useContext } from "solid-js";
import { css } from "styled-system/css";
import ClockIcon from "~icons/ph/clock-bold";
import SearchIcon from "~icons/ph/magnifying-glass";
import MapPinIcon from "~icons/ph/map-pin";
import PlusIcon from "~icons/ph/plus-bold";

import { ApiClient } from "../../api/client";
import { runEffect } from "../../api/solid-effect";
import { TabBar } from "../../chrome";
import { daysBetween, phone } from "../../format";
import { HeldSteps, nextStep } from "../../steps";
import {
  act,
  button,
  headline,
  largeTitle,
  Money,
  Note,
  panel,
  Pill,
  press,
  Problem,
  round,
  roundAct,
  searchBox,
  small,
  StepButton,
  sub,
  Tile,
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

const chip = css.raw(press, {
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  flex: "none",
  height: "40px",
  px: "15px",
  borderRadius: "20px",
  bg: "surface",
  boxShadow: "raiseSm",
  fontSize: "15px",
  fontWeight: "600",
  whiteSpace: "nowrap",
  transition: "background .2s ease, color .2s ease",
  "& b": { fontWeight: "700", color: "inkMuted", fontVariantNumeric: "tabular-nums" },
});

const chipOn = css.raw({
  bg: "sel",
  color: "white",
  boxShadow: "0 1px 2px {colors.sel/25}",
  "& b": { color: "white/78" },
});

// Shown where there is no next step to take.
const statusText = {
  new: "Төлбөр хүлээж",
  paid: "Илгээгээгүй",
  shipped: "Замд",
  delivered: "Хүргэсэн",
  cancelled: "Цуцалсан",
};

/** Days a ready order has waited to ship, from the second day on. */
const waitingDays = (order: Pick<OrderSummary, "status" | "terms" | "createdAt">, now: Date) => {
  if (nextStep(order)?.step !== "ship") return undefined;

  const days = daysBetween(order.createdAt, now);

  return days >= 2 ? days : undefined;
};

export default function Orders() {
  const [params, setParams] = useSearchParams<{ view?: string; q?: string }>();
  const { failure, secondsLeft } = useContext(HeldSteps);
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

  const lines = () => orders().flatMap((order) => order.lines);
  const pieces = () => lines().reduce((sum, line) => sum + line.quantity, 0);

  // Three different bottles from today's parcels, overlapped on the packing row.
  const thumbs = () =>
    lines()
      .filter(
        (line, at, all) => all.findIndex((other) => other.productId === line.productId) === at,
      )
      .slice(0, 3);

  return (
    <main class={css(top, { pb: "120px" })}>
      <div class={css({ display: "flex", justifyContent: "flex-end", px: "16px", pt: "4px" })}>
        <a href="/orders/new" aria-label="Шинэ захиалга" class={css(round, roundAct)}>
          <PlusIcon />
        </a>
      </div>
      <h1 class={css(largeTitle, { px: "20px", mt: "8px" })}>Захиалга</h1>

      <label class={css(searchBox, { mx: "16px", mt: "16px" })}>
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

      <nav
        class={css({
          display: "flex",
          gap: "8px",
          px: "16px",
          pt: "14px",
          pb: "4px",
          overflowX: "auto",
          scrollbarWidth: "none",
        })}
      >
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
                    <b>{counts()[key()]}</b>
                  </Loading>
                )}
              </Show>
            </a>
          )}
        </For>
      </nav>

      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(panel, { m: "20px 16px", height: "300px" })} />}>
          <Show when={view().key === "to_ship" && params.q === undefined && orders().length > 0}>
            <div
              class={css(panel, {
                display: "flex",
                alignItems: "center",
                gap: "12px",
                mx: "16px",
                mt: "16px",
                p: "12px 12px 12px 14px",
              })}
            >
              <span class={css({ display: "flex", flex: "none", "& > * + *": { ml: "-12px" } })}>
                <For each={thumbs()} keyed={(line) => line.productId}>
                  {(line) => <Tile product={line()} size={40} still />}
                </For>
              </span>
              <div class={css({ flex: 1, minWidth: 0, fontVariantNumeric: "tabular-nums" })}>
                <div class={css(headline)}>{orders().length} илгээмж</div>
                <div class={css(sub)}>{pieces()} ширхэг</div>
              </div>
              <a href="/pack" class={css(button, act, small)}>
                Савлах
              </a>
            </div>
          </Show>

          <Show
            when={orders().length > 0}
            fallback={
              <p class={css(sub, { px: "20px", py: "48px", textAlign: "center" })}>Захиалга алга</p>
            }
          >
            <div
              class={css({
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr)",
                gap: "10px",
                px: "16px",
                pt: "14px",
              })}
            >
              <For each={orders()} keyed={(order) => order.id}>
                {(order) => (
                  <div
                    class={css(
                      {
                        position: "relative",
                        mx: "-12px",
                        px: "12px",
                        pt: "14px",
                        pb: "16px",
                        borderRadius: "22px",
                        transition: "transform .56s {easings.spring}, background .2s ease",
                        _active: {
                          bg: "ink/5",
                          transform: "scale(.985)",
                          transition: "transform .12s ease-out, background 0s",
                        },
                      },
                      secondsLeft(order().id) !== undefined && { bg: "selSoft" },
                    )}
                  >
                    {/* The whole order opens its page; photos and the step button sit above it. */}
                    <a
                      href={`/orders/${order().id}`}
                      aria-label={`#${order().number}`}
                      class={css({ position: "absolute", inset: 0, borderRadius: "22px" })}
                    />
                    <div class={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                      <b
                        class={css({
                          mr: "auto",
                          fontSize: "21px",
                          lineHeight: "26px",
                          fontWeight: "700",
                          fontVariantNumeric: "tabular-nums",
                        })}
                      >
                        <Show when={order().customerPhone} fallback="Утасгүй">
                          {(digits) => <>{phone(digits())}</>}
                        </Show>
                      </b>
                      <Show when={waitingDays(order(), now())}>
                        {(days) => (
                          <Pill tone="wait">
                            <ClockIcon />
                            {days()} хоног
                          </Pill>
                        )}
                      </Show>
                      <Money order={order()} />
                    </div>
                    <Show
                      when={secondsLeft(order().id)}
                      fallback={
                        <div
                          class={css(sub, {
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            mt: "5px",
                            "& svg": { fontSize: "16px", flex: "none" },
                          })}
                        >
                          <MapPinIcon />
                          <span
                            class={css({
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            })}
                          >
                            {order().address ?? "Хаяггүй"}
                          </span>
                        </div>
                      }
                    >
                      {(left) => (
                        <div class={css(sub, { mt: "5px", color: "sel", fontWeight: "600" })}>
                          {left()} секундын дараа {nextStep(order())?.label}
                        </div>
                      )}
                    </Show>
                    <Show when={failure(order().id)}>
                      {(text) => (
                        <div class={css(sub, { mt: "5px", color: "owes", fontWeight: "600" })}>
                          {text()}
                        </div>
                      )}
                    </Show>
                    <Show when={order().notes}>
                      {(notes) => (
                        <div class={css({ mt: "10px" })}>
                          <Note>{notes()}</Note>
                        </div>
                      )}
                    </Show>
                    <div
                      class={css({
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: "10px",
                        mt: "16px",
                      })}
                    >
                      <div class={css({ display: "flex", flexWrap: "wrap", gap: "10px" })}>
                        <For each={order().lines} keyed={(line) => line.productId}>
                          {(line) => <Tile product={line()} size={56} quantity={line().quantity} />}
                        </For>
                      </div>
                      <Show
                        when={nextStep(order())}
                        fallback={<Pill tone="neutral">{statusText[order().status]}</Pill>}
                      >
                        <StepButton order={order()} reload={reload} />
                      </Show>
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
