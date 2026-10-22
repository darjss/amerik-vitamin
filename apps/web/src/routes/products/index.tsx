import type { ProductRow } from "@amerik/contracts";
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
  useContext,
} from "solid-js";
import { css } from "styled-system/css";
import SearchIcon from "~icons/ph/magnifying-glass";

import { ApiClient } from "../../api/client";
import { runEffect, RuntimeContext } from "../../api/solid-effect";
import { TabBar } from "../../chrome";
import { failureText, matches, money } from "../../format";
import { StepperSheet, stockText } from "../../product-parts";
import {
  button,
  headline,
  largeTitle,
  panel,
  Problem,
  searchBox,
  small,
  sub,
  Tile,
  top,
} from "../../ui";

export default function Products() {
  const products = createMemo(() => runEffect(ApiClient.use((api) => api.listProducts())));
  const runtime = useContext(RuntimeContext);
  const [query, setQuery] = createSignal("");
  const [counting, setCounting] = createSignal<ProductRow>();
  const [busy, setBusy] = createOptimistic(false);
  const [failed, setFailed] = createSignal<string>();

  const shown = () =>
    products().filter((product) => product.archivedAt === null && matches(product, query()));

  const open = (product: ProductRow) => {
    setFailed(undefined);
    setCounting(product);
  };

  // A hand count sets stock to what she sees on the shelf; the log keeps the difference.
  // A failure keeps the sheet open and says why.
  const save = action(async function* save(product: ProductRow, stock: number) {
    setBusy(true);

    const exit = await runtime.runPromiseExit(
      ApiClient.use((api) => api.countStock({ productId: product.id, counted: stock })),
    );

    yield;

    if (Exit.isFailure(exit)) {
      setFailed(failureText(exit.cause));

      return;
    }

    setCounting(undefined);
    yield refresh(products);
  });

  return (
    <main class={css(top, { pb: "120px" })}>
      <h1 class={css(largeTitle, { px: "20px", pt: "52px" })}>Бараа</h1>
      <label class={css(searchBox, { mx: "16px", mt: "16px" })}>
        <SearchIcon />
        <input
          type="search"
          placeholder="Бараа хайх"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(panel, { m: "20px 16px", height: "320px" })} />}>
          <div class={css({ display: "grid", gap: "8px", px: "16px", pt: "18px" })}>
            <For each={shown()} keyed={(product) => product.id}>
              {(product) => (
                <div class={css({ display: "flex", gap: "14px", alignItems: "center", py: "6px" })}>
                  <Tile product={product()} size={64} />
                  <a href={`/products/${product().id}`} class={css({ flex: 1, minWidth: 0 })}>
                    <div class={css(headline)}>{product().name}</div>
                    <div class={css(sub)}>
                      {product().brand} · {product().count} ш
                    </div>
                    <div
                      class={css({
                        fontSize: "15px",
                        fontWeight: "650",
                        mt: "2px",
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      {money(product().price)}
                    </div>
                  </a>
                  <button
                    type="button"
                    aria-label={`${product().name} тоолох`}
                    onClick={() => open(product())}
                    class={css(
                      button,
                      small,
                      { minWidth: "64px", px: "14px", fontVariantNumeric: "tabular-nums" },
                      product().stock === 0 && { bg: "owesBg", color: "owes", boxShadow: "none" },
                    )}
                  >
                    {stockText(product().stock)}
                  </button>
                </div>
              )}
            </For>
          </div>
        </Loading>
      </Errored>

      <StepperSheet
        open={counting() !== undefined}
        title={counting()?.name ?? ""}
        prompt={`${counting()?.brand ?? ""} · ${counting()?.count ?? 0} ш. Тавиур дээр хэд байна?`}
        start={counting()?.stock ?? 0}
        min={0}
        busy={busy()}
        failed={failed()}
        onClose={() => setCounting(undefined)}
        onSave={(stock) => {
          const product = counting();

          if (product !== undefined) void save(product, stock);
        }}
      />
      <TabBar />
    </main>
  );
}
