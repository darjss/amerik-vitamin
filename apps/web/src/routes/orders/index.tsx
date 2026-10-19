import { OrderNumber } from "@amerik/contracts";
import type { ListOrders } from "@amerik/contracts";
import { useSearchParams } from "@solidjs/router";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { createMemo, Errored, For, Loading, Show } from "solid-js";
import { css, cx } from "styled-system/css";
import ChatIcon from "~icons/ph/chat-circle";
import SearchIcon from "~icons/ph/magnifying-glass";

import { ApiClient } from "../../api/client";
import { runEffect } from "../../api/solid-effect";
import { phone, when } from "../../format";
import {
  card,
  Header,
  labels,
  muted,
  PayLabel,
  Photos,
  Problem,
  ShipLabel,
  TabBar,
} from "../../ui";

const views = [
  { key: "to_ship", label: "Илгээх", input: { queue: "to_ship" } },
  { key: "awaiting", label: "Төлбөр хүлээж", input: { queue: "awaiting_payment" } },
  { key: "shipped", label: "Замд", input: { status: "shipped" } },
  { key: "all", label: "Бүгд", input: {} },
] satisfies ReadonlyArray<{ key: string; label: string; input: ListOrders }>;

/** Eight digits is a phone, five is an order number; anything else keeps the chosen view. */
const searchOf = (query: string): ListOrders | undefined => {
  const digits = query.replaceAll(/\s/gu, "");

  if (/^\d{8}$/u.test(digits)) return { phone: digits };

  if (!/^\d{5}$/u.test(digits)) return undefined;

  return Option.getOrUndefined(
    Option.map(Schema.decodeUnknownOption(OrderNumber)(Number(digits)), (number) => ({ number })),
  );
};

const chip = css({
  borderRadius: "18px",
  px: "12px",
  py: "6px",
  fontWeight: "600",
  fontSize: "14px",
  whiteSpace: "nowrap",
  bg: "chip",
  color: "inkMuted",
});

const chipOn = css({ bg: "clay", color: "white" });

const ellipsis = css({ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });

export default function Orders() {
  const [params, setParams] = useSearchParams<{ view?: string; q?: string }>();
  const view = () => views.find((candidate) => candidate.key === params.view) ?? views[0];
  const input = createMemo(() => searchOf(params.q ?? "") ?? view().input);

  const orders = createMemo(() => {
    const filter = input();

    return runEffect(ApiClient.use((api) => api.listOrders(filter)));
  });

  const now = createMemo(() => runEffect(DateTime.nowAsDate));

  return (
    <main class={css({ pb: "100px" })}>
      <Header title="Захиалга" />
      <label
        class={css({
          mx: "16px",
          mb: "10px",
          height: "40px",
          borderRadius: "12px",
          bg: "chip",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          px: "12px",
          color: "inkMuted",
          "& input": { flex: 1, minWidth: 0, bg: "transparent", outline: "none", color: "ink" },
        })}
      >
        <SearchIcon />
        <input
          type="search"
          inputmode="numeric"
          placeholder="Утас эсвэл захиалгын дугаар"
          value={params.q ?? ""}
          onInput={(event) =>
            setParams({ q: event.currentTarget.value || undefined }, { replace: true })
          }
        />
      </label>
      <nav class={css({ display: "flex", gap: "6px", px: "16px", pb: "12px", overflowX: "auto" })}>
        <For each={views}>
          {(candidate) => (
            <a
              href={candidate.key === "to_ship" ? "/orders" : `/orders?view=${candidate.key}`}
              class={cx(chip, view().key === candidate.key && chipOn)}
            >
              {candidate.label}
            </a>
          )}
        </For>
      </nav>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={cx(card, css({ height: "240px" }))} />}>
          <Show
            when={orders().length > 0}
            fallback={
              <p class={cx(muted, css({ px: "16px", py: "24px", textAlign: "center" }))}>
                Захиалга алга
              </p>
            }
          >
            <div class={card}>
              <For each={orders()} keyed={(order) => order.id}>
                {(order) => (
                  <a
                    href={`/orders/${order().id}`}
                    class={css({
                      display: "flex",
                      gap: "12px",
                      p: "12px",
                      "& + &": { borderTop: "1px solid", borderColor: "line" },
                    })}
                  >
                    <Photos lines={order().lines} />
                    <div class={css({ flex: 1, minWidth: 0 })}>
                      <div class={css({ display: "flex", gap: "6px", alignItems: "baseline" })}>
                        <b class={css({ fontSize: "16px", fontWeight: "650" })}>
                          {order().customerName ?? `#${order().number}`}
                        </b>
                        <Show when={order().customerPhone}>
                          {(digits) => (
                            <span class={cx(muted, css({ fontVariantNumeric: "tabular-nums" }))}>
                              {phone(digits())}
                            </span>
                          )}
                        </Show>
                        <span
                          class={cx(
                            muted,
                            css({
                              ml: "auto",
                              fontSize: "13px",
                              whiteSpace: "nowrap",
                              display: "flex",
                              gap: "4px",
                              alignItems: "center",
                            }),
                          )}
                        >
                          <Show
                            when={
                              order().source === "messenger_human" ||
                              order().source === "messenger_bot"
                            }
                          >
                            <ChatIcon />
                          </Show>
                          {when(order().createdAt, now())}
                        </span>
                      </div>
                      <div class={cx(ellipsis, css({ fontSize: "14px" }))}>
                        {order()
                          .lines.map(
                            (line) =>
                              `${line.name} ${line.brand}${line.quantity > 1 ? ` ×${line.quantity}` : ""}`,
                          )
                          .join(", ")}
                      </div>
                      <div class={cx(ellipsis, muted, css({ fontSize: "14px" }))}>
                        {order().address}
                      </div>
                      <div class={labels}>
                        <PayLabel order={order()} />
                        <ShipLabel status={order().status} />
                      </div>
                    </div>
                  </a>
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
