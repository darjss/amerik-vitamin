import { LOW_STOCK } from "@amerik/contracts";
import type { ProductRow } from "@amerik/contracts";
import { useSearchParams } from "@solidjs/router";
import type * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
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
import SearchIcon from "~icons/ph/magnifying-glass";

import { ApiClient } from "../../api/client";
import { runEffect, RuntimeContext } from "../../api/solid-effect";
import { TabBar } from "../../chrome";
import { failureText, matches, money } from "../../format";
import { PriceSheet, StockSheet, stockButton, stockText } from "../../product-parts";
import {
  button,
  chip,
  chipOn,
  chipRow,
  headline,
  largeTitle,
  panel,
  press,
  Problem,
  searchBox,
  small,
  sub,
  Tile,
  top,
} from "../../ui";

/** The stock views. Each one but Бүгд shows only when it has products. */
const views = [
  { key: "all", label: "Бүгд", dot: undefined },
  { key: "out", label: "Дууссан", dot: "owes" },
  { key: "low", label: "Дуусаж байна", dot: "wait" },
  { key: "uncounted", label: "Тоолоогүй", dot: "inkFaint" },
  { key: "archived", label: "Архив", dot: undefined },
] as const;

type View = (typeof views)[number]["key"];

const inView = (view: View, product: ProductRow) => {
  if (view === "archived") return product.archivedAt !== null;

  if (product.archivedAt !== null) return false;

  if (view === "out") return product.stock !== null && product.stock <= 0;

  if (view === "low")
    return product.stock !== null && product.stock > 0 && product.stock <= LOW_STOCK;

  if (view === "uncounted") return product.stock === null;

  return true;
};

const dots = {
  owes: css.raw({ bg: "owes" }),
  wait: css.raw({ bg: "wait" }),
  inkFaint: css.raw({ bg: "inkFaint" }),
};

export default function Products() {
  const products = createMemo(() => runEffect(ApiClient.use((api) => api.listProducts())));
  const runtime = useContext(RuntimeContext);
  // In the URL, so coming back from a product keeps the filters.
  const [params, setParams] = useSearchParams<{ view?: string; brand?: string; q?: string }>();
  const [stocking, setStocking] = createSignal<ProductRow>();
  const [pricing, setPricing] = createSignal<ProductRow>();
  const [busy, setBusy] = createOptimistic(false);
  const [failed, setFailed] = createSignal<string>();

  const view = () => views.find((candidate) => candidate.key === params.view)?.key ?? "all";
  const query = () => params.q ?? "";

  const counts = createMemo(() =>
    Object.fromEntries(
      views.map(({ key }) => [key, products().filter((product) => inView(key, product)).length]),
    ),
  );

  // Brands in the current view, with how many products each has there.
  const brands = createMemo(() => {
    const tally = new Map<string, number>();

    for (const product of products()) {
      if (inView(view(), product)) tally.set(product.brand, (tally.get(product.brand) ?? 0) + 1);
    }

    return [...tally].map(([name, count]) => ({ name, count }));
  });

  const shown = () =>
    products().filter(
      (product) =>
        inView(view(), product) &&
        (params.brand === undefined || product.brand === params.brand) &&
        matches(product, query()),
    );

  const close = () => {
    setStocking(undefined);
    setPricing(undefined);
  };

  // A failure keeps the sheet open and says why; success closes it and reloads the list.
  const write = action(async function* write<A, E extends { readonly _tag: string }>(
    effect: Effect.Effect<A, E, ApiClient>,
  ) {
    setBusy(true);
    const exit = await runtime.runPromiseExit(effect);
    yield;

    if (Exit.isFailure(exit)) {
      setFailed(failureText(exit.cause));

      return;
    }

    close();
    yield refresh(products);
  });

  const openStock = (product: ProductRow) => {
    setFailed(undefined);
    setStocking(product);
  };

  const openPrice = (product: ProductRow) => {
    setFailed(undefined);
    setPricing(product);
  };

  return (
    <main class={css(top, { pb: "120px" })}>
      <h1 class={css(largeTitle, { px: "20px", pt: "52px" })}>Бараа</h1>
      <label class={css(searchBox, { mx: "16px", mt: "16px" })}>
        <SearchIcon />
        <input
          type="search"
          placeholder="Бараа хайх"
          value={query()}
          onInput={(event) => setParams({ q: event.currentTarget.value || undefined })}
        />
      </label>

      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(panel, { m: "20px 16px", height: "320px" })} />}>
          <nav class={css(chipRow, { pt: "14px" })}>
            <For each={views.filter(({ key }) => key === "all" || counts()[key] > 0)}>
              {(candidate) => (
                <button
                  type="button"
                  onClick={() =>
                    setParams({
                      view: candidate.key === "all" ? undefined : candidate.key,
                      brand: undefined,
                    })
                  }
                  class={css(
                    chip,
                    view() === candidate.key &&
                      (candidate.key !== "all" || params.brand === undefined) &&
                      chipOn,
                  )}
                >
                  <Show when={candidate.dot}>
                    {(dot) => (
                      <span
                        class={css(
                          { width: "9px", height: "9px", borderRadius: "50%" },
                          dots[dot()],
                        )}
                      />
                    )}
                  </Show>
                  {candidate.label}
                  <b>{counts()[candidate.key]}</b>
                </button>
              )}
            </For>
            <span
              aria-hidden="true"
              class={css({ flex: "none", width: "1px", my: "8px", bg: "ink/12" })}
            />
            <For each={brands()} keyed={(brand) => brand.name}>
              {(brand) => (
                <button
                  type="button"
                  aria-pressed={params.brand === brand().name ? "true" : "false"}
                  onClick={() =>
                    setParams({ brand: params.brand === brand().name ? undefined : brand().name })
                  }
                  class={css(chip, params.brand === brand().name && chipOn)}
                >
                  {brand().name}
                  <b>{brand().count}</b>
                </button>
              )}
            </For>
          </nav>

          <div class={css({ display: "grid", gap: "4px", px: "16px", pt: "14px" })}>
            <Show
              when={shown().length > 0}
              fallback={
                <p class={css(sub, { py: "24px", textAlign: "center" })}>Бараа олдсонгүй.</p>
              }
            >
              <For each={shown()} keyed={(product) => product.id}>
                {(product) => (
                  <div
                    class={css({ display: "flex", gap: "14px", alignItems: "center", py: "8px" })}
                  >
                    <Tile product={product()} size={68} />
                    <div class={css({ flex: 1, minWidth: 0 })}>
                      <a href={`/products/${product().id}`} class={css({ display: "block" })}>
                        <div class={css(headline)}>{product().name}</div>
                        <div class={css(sub)}>
                          {product().brand} · {product().count} ш
                        </div>
                      </a>
                      <button
                        type="button"
                        aria-label={`${product().name} үнэ өөрчлөх`}
                        onClick={() => openPrice(product())}
                        class={css(press, {
                          mt: "4px",
                          px: "10px",
                          height: "30px",
                          borderRadius: "15px",
                          bg: "surface",
                          boxShadow: "raiseSm",
                          fontSize: "15px",
                          fontWeight: "650",
                          fontVariantNumeric: "tabular-nums",
                        })}
                      >
                        {money(product().price)}
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label={`${product().name} үлдэгдэл`}
                      onClick={() => openStock(product())}
                      class={css(
                        button,
                        small,
                        { minWidth: "64px", px: "14px", fontVariantNumeric: "tabular-nums" },
                        stockButton(product().stock),
                      )}
                    >
                      {stockText(product().stock)}
                    </button>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </Loading>
      </Errored>

      <StockSheet
        product={stocking()}
        busy={busy()}
        failed={failed()}
        onClose={close}
        onCount={(counted) => {
          const product = stocking();

          if (product !== undefined) {
            void write(ApiClient.use((api) => api.countStock({ productId: product.id, counted })));
          }
        }}
        onReceive={(received) => {
          const product = stocking();

          if (product !== undefined) {
            void write(
              ApiClient.use((api) => api.receiveStock({ productId: product.id, received })),
            );
          }
        }}
      />
      <PriceSheet
        open={pricing() !== undefined}
        title={pricing()?.name ?? ""}
        prompt={`Одоо ${money(pricing()?.price ?? 0)}. Хуучин захиалгын үнэ өөрчлөгдөхгүй.`}
        price={pricing()?.price ?? 0}
        busy={busy()}
        failed={failed()}
        onClose={close}
        onSave={(price) => {
          const product = pricing();

          if (product !== undefined) {
            void write(ApiClient.use((api) => api.setPrice({ productId: product.id, price })));
          }
        }}
      />
      <TabBar />
    </main>
  );
}
