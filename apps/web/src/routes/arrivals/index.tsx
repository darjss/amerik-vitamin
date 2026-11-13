import type { Batch } from "@amerik/contracts";
import { createMemo, Errored, For, Loading, Show } from "solid-js";
import { css } from "styled-system/css";
import CaretRightIcon from "~icons/ph/caret-right-bold";

import { ApiClient } from "../../api/client";
import { runEffect } from "../../api/solid-effect";
import { TabBar } from "../../bars";
import { dayRange } from "../../format";
import { Tile } from "../../photos";
import { ListSkeleton } from "../../skeletons";
import { appear, groupHead, hairline, panel, Problem, sub, top } from "../../ui";

// Ачаа: Amazon orders grouped into batches by order day. The forwarder sends
// no dates, so a batch shows only when she ordered; what's left to count says
// whether it has come.

const groups = [
  { title: "Тоолох", open: true },
  { title: "Тоолсон", open: false },
];

export default function Arrivals() {
  const batches = createMemo(() => runEffect(ApiClient.use((api) => api.listBatches())));

  return (
    <main class={css(top, { maxWidth: "640px", mx: "auto", px: "16px", pb: "104px" })}>
      <header class={css({ pb: "4px" })}>
        <h1 class={css({ textStyle: "title" })}>Ачаа</h1>
        <p class={css(sub)}>Amazon-оос захиалсан өдрөөр</p>
      </header>

      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<ListSkeleton />}>
          <div class={css(appear)}>
            <Show
              when={batches().length > 0}
              fallback={<p class={css(sub, { py: "48px", textAlign: "center" })}>Ачаа алга</p>}
            >
              <For each={groups}>
                {(group) => {
                  const shown = () => batches().filter((batch) => batch.open > 0 === group.open);

                  return (
                    <Show when={shown().length > 0}>
                      <section>
                        <h2 class={css(groupHead)}>
                          {group.title}
                          <small>{shown().length}</small>
                        </h2>
                        <div class={css(panel)}>
                          <For each={shown()} keyed={(batch) => batch.from}>
                            {(batch) => <Row batch={batch()} />}
                          </For>
                        </div>
                      </section>
                    </Show>
                  );
                }}
              </For>
            </Show>
          </div>
        </Loading>
      </Errored>
      <TabBar />
    </main>
  );
}

/** The order days, units counted of ordered, then the batch's bottles side by side. */
function Row(props: { batch: Batch }) {
  return (
    <a
      href={`/arrivals/${props.batch.from}`}
      class={css(hairline, {
        display: "block",
        px: "16px",
        py: "12px",
        transition: "background-color 120ms ease",
        _active: { bg: "fill" },
      })}
    >
      <div class={css({ display: "flex", alignItems: "baseline", gap: "8px" })}>
        <b
          class={css({
            textStyle: "headline",
            fontWeight: "700",
            fontVariantNumeric: "tabular-nums",
          })}
        >
          {dayRange(props.batch.from, props.batch.to)}
        </b>
        <span
          class={css(
            {
              ml: "auto",
              textStyle: "subhead",
              fontWeight: "650",
              fontVariantNumeric: "tabular-nums",
            },
            props.batch.received === props.batch.ordered && { color: "ok" },
          )}
        >
          {props.batch.received} / {props.batch.ordered} ш
        </span>
        <CaretRightIcon class={css({ alignSelf: "center", color: "inkMuted", flex: "none" })} />
      </div>
      <p class={css(sub, { textStyle: "footnote", mt: "2px" })}>
        {props.batch.orders} захиалга · {props.batch.products} бараа
      </p>
      <Show when={props.batch.photos.length > 0}>
        <div
          class={css({
            display: "flex",
            gap: "8px",
            mt: "10px",
            mx: "-16px",
            px: "16px",
            overflowX: "auto",
            scrollbarWidth: "none",
          })}
        >
          <For each={props.batch.photos} keyed={(product) => product.id}>
            {(product) => <Tile product={product()} size={52} still />}
          </For>
        </div>
      </Show>
    </a>
  );
}
