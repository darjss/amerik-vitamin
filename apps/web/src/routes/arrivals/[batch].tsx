import { Day } from "@amerik/contracts";
import type { BatchProduct, ProductId, ShopProduct } from "@amerik/contracts";
import { useLocation, useParams, useSearchParams } from "@solidjs/router";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  createMemo,
  createSignal,
  createStore,
  Errored,
  For,
  Loading,
  Show,
  untrack,
} from "solid-js";
import { css } from "styled-system/css";
import CheckIcon from "~icons/ph/check-bold";
import PackageIcon from "~icons/ph/package";
import PlusIcon from "~icons/ph/plus-bold";
import TagIcon from "~icons/ph/tag";
import XIcon from "~icons/ph/x-bold";

import { ApiClient } from "../../api/client";
import { createWrite, runEffect } from "../../api/solid-effect";
import { NavBar, Tab, Tabs } from "../../bars";
import { dayRange, dollars, money } from "../../format";
import { Tile } from "../../photos";
import { Stepper } from "../../products";
import { ListSkeleton } from "../../skeletons";
import { button } from "../../styles";
import {
  appear,
  Failed,
  hairline,
  oneLine,
  panel,
  Problem,
  SaveButton,
  Sheet,
  sheetRow,
  sub,
} from "../../ui";

// One batch on arrival day: each product with what was ordered and a counter
// for what's on the shelf. A count adds to stock as a receipt; Хаах marks the
// rest as never coming. Products the shop doesn't sell yet go to Шинэ бараа.

type Line = BatchProduct;

/** A line with a product in the shop, the only kind that has a price to set. */
type PricedLine = Line & { product: ShopProduct };

const keyOf = (line: Line) => line.product?.id ?? line.asin;

const footnote = css.raw({ textStyle: "footnote", color: "inkMuted" });

export default function BatchPage() {
  const params = useParams();
  const location = useLocation();
  const [query] = useSearchParams<{ view?: string }>();
  const day = () => Schema.decodeUnknownSync(Day)(params.batch);

  const batch = createMemo(() => {
    const from = day();

    return runEffect(ApiClient.use((api) => api.getBatch({ batch: from })));
  });

  const { write, busy, failed, setFailed } = createWrite({ source: batch });
  // The row whose write ran last, so its failure shows on it.
  const [writing, setWriting] = createSignal<string>();
  const [closing, setClosing] = createSignal<PricedLine>();
  const [pricing, setPricing] = createSignal(false);

  const done = () => query.view === "done";
  const lines = () => batch().products.filter((line) => line.expected > 0 !== done());
  const toCount = () => batch().products.filter((line) => line.expected > 0).length;
  const ordered = () => batch().products.reduce((sum, line) => sum + line.ordered, 0);
  const received = () => batch().products.reduce((sum, line) => sum + line.received, 0);

  const priced = () =>
    batch().products.flatMap((line) =>
      line.product === null ? [] : [{ ...line, product: line.product }],
    );

  const receive = (line: PricedLine, count: number) => {
    setWriting(keyOf(line));

    void write(
      ApiClient.use((api) =>
        api.receiveBatch({ productId: line.product.id, batch: day(), received: count }),
      ),
      () => undefined,
    );
  };

  return (
    <main class={css({ maxWidth: "640px", mx: "auto", pb: "60px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<ListSkeleton />}>
          <NavBar back="/arrivals" backLabel="Ачаа" title={dayRange(batch().from, batch().to)} />
          <div class={css(appear, { px: "16px" })}>
            <div class={css({ display: "flex", alignItems: "center", gap: "12px", pt: "4px" })}>
              <div class={css({ flex: 1 })}>
                <b
                  class={css({
                    display: "block",
                    fontSize: "28px",
                    lineHeight: "1.2",
                    fontWeight: "700",
                    fontVariantNumeric: "tabular-nums",
                  })}
                >
                  {received()} / {ordered()} ш
                </b>
                <span class={css(sub)}>ирсэн · {batch().products.length} бараа</span>
              </div>
              <button
                type="button"
                disabled={priced().length === 0}
                onClick={() => {
                  setFailed(undefined);
                  setPricing(true);
                }}
                class={button({ size: "sm" })}
              >
                <TagIcon />
                Үнэ
              </button>
            </div>

            <Tabs current={done() ? "done" : "todo"}>
              <Tab href={location.pathname} current={!done()} label="Тоолох" count={toCount()} />
              <Tab
                href={`${location.pathname}?view=done`}
                current={done()}
                label="Тоолсон"
                count={batch().products.length - toCount()}
              />
            </Tabs>

            <Show
              when={lines().length > 0}
              fallback={
                <p class={css(sub, { py: "48px", textAlign: "center" })}>
                  {done() ? "Одоохондоо юу ч тоолоогүй" : "Бүгдийг тоолсон"}
                </p>
              }
            >
              <div class={css(panel, { mt: "12px" })}>
                <For each={lines()} keyed={keyOf}>
                  {(line) => (
                    <Row
                      line={line()}
                      busy={busy()}
                      failed={writing() === keyOf(line()) ? failed() : undefined}
                      onReceive={(count) => {
                        const current = line();

                        if (current.product !== null) {
                          receive({ ...current, product: current.product }, count);
                        }
                      }}
                      onClose={() => {
                        const current = line();

                        if (current.product !== null) {
                          setFailed(undefined);
                          setClosing({ ...current, product: current.product });
                        }
                      }}
                    />
                  )}
                </For>
              </div>
            </Show>

            <Sheet
              open={closing() !== undefined}
              title={closing()?.product.nameMn ?? ""}
              prompt={`Үлдсэн ${closing()?.expected ?? 0} ш ирэхгүй гэж тэмдэглэнэ. Хожим ирвэл Бараа хэсгээс Ирсэн гэж нэмнэ.`}
              onClose={() => setClosing(undefined)}
            >
              <Failed text={failed()} />
              <div class={css(panel)}>
                <button
                  type="button"
                  disabled={busy()}
                  onClick={() => {
                    const line = closing();

                    if (line !== undefined) {
                      void write(
                        ApiClient.use((api) =>
                          api.closeBatch({ productId: line.product.id, batch: day() }),
                        ),
                        () => setClosing(undefined),
                      );
                    }
                  }}
                  class={css(sheetRow, { color: "owe" })}
                >
                  <XIcon />
                  Ирэхгүй гэж хаах
                </button>
              </div>
            </Sheet>

            <PricesSheet
              open={pricing()}
              lines={priced()}
              busy={busy()}
              failed={failed()}
              onClose={() => setPricing(false)}
              onSave={(changes) =>
                void write(
                  ApiClient.use((api) =>
                    Effect.forEach(changes, (change) => api.setPrice(change), {
                      concurrency: 4,
                      discard: true,
                    }),
                  ),
                  () => setPricing(false),
                )
              }
            />
          </div>
        </Loading>
      </Errored>
    </main>
  );
}

/**
 * One product: the photo with what's still coming as ×N, the name, and the
 * counter that starts at that number, so "Бүгд ирсэн" is one tap. A product the
 * shop doesn't sell shows Amazon's title and Бараа нэмэх instead.
 */
function Row(props: {
  line: Line;
  busy: boolean;
  failed: string | undefined;
  onReceive: (count: number) => void;
  onClose: () => void;
}) {
  // Resets to what's left whenever a write changes it.
  const [count, setCount] = createSignal(() => props.line.expected);
  const open = () => props.line.expected > 0;
  const missing = () => props.line.ordered - props.line.received - props.line.expected;

  return (
    <div class={css(hairline, { display: "grid", gap: "10px", px: "12px", py: "10px" })}>
      <div class={css({ display: "flex", gap: "12px" })}>
        <Show
          when={props.line.product}
          fallback={
            <span
              class={css({
                position: "relative",
                display: "grid",
                placeItems: "center",
                flex: "none",
                width: "76px",
                height: "76px",
                borderRadius: "6px",
                bg: "fill",
                color: "inkMuted",
                fontSize: "28px",
              })}
            >
              <PackageIcon />
            </span>
          }
        >
          {(product) => (
            <Tile
              product={product()}
              size={76}
              quantity={open() ? props.line.expected : undefined}
              ring="card"
            />
          )}
        </Show>
        <div class={css({ flex: 1, minWidth: 0 })}>
          <div class={css({ textStyle: "subhead", fontWeight: "600", lineClamp: 2 })}>
            {props.line.product?.nameMn ?? props.line.title}
          </div>
          <div class={css(oneLine, footnote, { mt: "2px" })}>
            {props.line.product === null
              ? `Дэлгүүрт байхгүй · ${props.line.expected} ш`
              : `${props.line.product.brand} · ${props.line.product.count} ш`}
          </div>
          <Show when={props.line.received > 0 || missing() > 0}>
            <div
              class={css(
                footnote,
                { mt: "2px", fontWeight: "600", fontVariantNumeric: "tabular-nums" },
                missing() > 0 || open() ? { color: "wait" } : { color: "ok" },
              )}
            >
              {props.line.received} / {props.line.ordered} ирсэн
              {missing() > 0 ? ` · ${missing()} ирэхгүй` : ""}
            </div>
          </Show>
        </div>
      </div>

      <Show when={open()}>
        <Show
          when={props.line.product !== null}
          fallback={
            <a
              href={`/products/new?url=${encodeURIComponent(`https://www.amazon.com/dp/${props.line.asin}`)}`}
              class={css(button.raw({ tone: "butter", size: "sm" }), { justifySelf: "end" })}
            >
              <PlusIcon />
              Бараа нэмэх
            </a>
          }
        >
          <div>
            <Failed text={props.failed} />
            <div class={css({ display: "flex", alignItems: "center", gap: "8px" })}>
              <div class={css({ width: "128px", flex: "none" })}>
                <Stepper
                  value={count()}
                  onChange={setCount}
                  min={1}
                  size="sm"
                  label={`${props.line.product?.nameMn ?? ""} ирсэн тоо`}
                />
              </div>
              <button
                type="button"
                disabled={props.busy}
                onClick={() => props.onClose()}
                class={css(button.raw({ size: "sm" }), { ml: "auto" })}
              >
                Хаах
              </button>
              <button
                type="button"
                disabled={props.busy || count() < 1}
                onClick={() => props.onReceive(count())}
                class={button({ tone: "butter", size: "sm" })}
              >
                <CheckIcon />
                {count() === props.line.expected ? "Бүгд ирсэн" : `${count()} ирсэн`}
              </button>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}

/**
 * Every product of the batch at its price, with Amazon's unit cost and the
 * price suggested from it. Opens fresh at the current prices; saving sets only
 * the ones she changed.
 */
function PricesSheet(props: {
  open: boolean;
  lines: ReadonlyArray<PricedLine>;
  busy: boolean;
  failed: string | undefined;
  onClose: () => void;
  onSave: (changes: ReadonlyArray<{ productId: ProductId; price: number }>) => void;
}) {
  return (
    <Sheet
      open={props.open}
      title="Үнэ"
      prompt="Санал нь Amazon-ы үнээс бодсон. 5,000₮-өөр алхана."
      onClose={props.onClose}
    >
      <Show when={props.open}>
        <PriceList {...props} />
      </Show>
    </Sheet>
  );
}

function PriceList(props: {
  lines: ReadonlyArray<PricedLine>;
  busy: boolean;
  failed: string | undefined;
  onSave: (changes: ReadonlyArray<{ productId: ProductId; price: number }>) => void;
}) {
  const [prices, setPrices] = createStore<Record<ProductId, number>>(
    untrack(() =>
      Object.fromEntries(props.lines.map((line) => [line.product.id, line.product.price])),
    ),
  );

  const priceOf = (line: PricedLine) => prices[line.product.id] ?? line.product.price;

  const changes = () =>
    props.lines
      .filter((line) => priceOf(line) > 0 && priceOf(line) !== line.product.price)
      .map((line) => ({ productId: line.product.id, price: priceOf(line) }));

  const suggestions = () =>
    props.lines.filter(
      (line) => line.suggestedPrice !== null && line.suggestedPrice !== priceOf(line),
    );

  return (
    <>
      <Show when={suggestions().length > 0}>
        <button
          type="button"
          onClick={() =>
            setPrices((draft) => {
              for (const line of suggestions()) {
                if (line.suggestedPrice !== null) draft[line.product.id] = line.suggestedPrice;
              }
            })
          }
          class={css(button.raw({ wide: true }), { mb: "12px" })}
        >
          <CheckIcon />
          Бүх саналыг авах · {suggestions().length}
        </button>
      </Show>

      <div class={css(panel)}>
        <For each={props.lines} keyed={(line) => line.product.id}>
          {(line) => (
            <div class={css(hairline, { display: "grid", gap: "8px", px: "12px", py: "10px" })}>
              <div class={css({ display: "flex", alignItems: "center", gap: "12px" })}>
                <Tile product={line().product} size={48} />
                <div class={css({ flex: 1, minWidth: 0 })}>
                  <div class={css(oneLine, { textStyle: "subhead", fontWeight: "600" })}>
                    {line().product.nameMn}
                  </div>
                  <div class={css(oneLine, footnote, { fontVariantNumeric: "tabular-nums" })}>
                    Одоо {money(line().product.price)}
                    <Show when={line().unitCostCents}>
                      {(cents) => <> · Amazon {dollars(cents())}</>}
                    </Show>
                  </div>
                </div>
              </div>
              <div class={css({ display: "flex", alignItems: "center", gap: "8px" })}>
                <div class={css({ flex: 1, minWidth: 0 })}>
                  <Stepper
                    value={priceOf(line())}
                    onChange={(price) =>
                      setPrices((draft) => {
                        draft[line().product.id] = price;
                      })
                    }
                    min={5000}
                    price
                    size="sm"
                    label={`${line().product.nameMn} үнэ`}
                  />
                </div>
                <Show when={line().suggestedPrice}>
                  {(suggested) => (
                    <button
                      type="button"
                      disabled={suggested() === priceOf(line())}
                      onClick={() =>
                        setPrices((draft) => {
                          draft[line().product.id] = suggested();
                        })
                      }
                      class={button({ size: "sm" })}
                    >
                      Санал {money(suggested())}
                    </button>
                  )}
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      <div
        class={css({
          position: "sticky",
          bottom: 0,
          mx: "-20px",
          px: "20px",
          pt: "12px",
          bg: "page",
        })}
      >
        <SaveButton
          failed={props.failed}
          disabled={props.busy || changes().length === 0}
          onClick={() => props.onSave(changes())}
        >
          {changes().length === 0 ? "Үнэ өөрчлөөгүй" : `${changes().length} үнэ хадгалах`}
        </SaveButton>
      </div>
    </>
  );
}
