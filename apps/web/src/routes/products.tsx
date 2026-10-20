import type { ProductRow } from "@amerik/contracts";
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
import MinusIcon from "~icons/ph/minus-bold";
import PlusIcon from "~icons/ph/plus-bold";

import { ApiClient } from "../api/client";
import { runEffect, RuntimeContext } from "../api/solid-effect";
import { Sheet, TabBar } from "../chrome";
import { money } from "../format";
import {
  act,
  button,
  field,
  headline,
  large,
  largeTitle,
  panel,
  Problem,
  round,
  searchBox,
  small,
  sub,
  Tile,
  top,
} from "../ui";

type Product = typeof ProductRow.Type;

// Null until the first count or receipt.
const stockText = (stock: number | null) => {
  if (stock === null) return "Тоолоогүй";

  return stock === 0 ? "Дууссан" : `${stock}`;
};

const matches = (product: Product, query: string) =>
  `${product.brand} ${product.name}`.toLowerCase().includes(query.trim().toLowerCase());

export default function Products() {
  const products = createMemo(() => runEffect(ApiClient.use((api) => api.listProducts())));
  const runtime = useContext(RuntimeContext);
  const [query, setQuery] = createSignal("");
  const [counting, setCounting] = createSignal<Product>();
  const [counted, setCounted] = createSignal(0);
  const [busy, setBusy] = createOptimistic(false);

  const shown = () =>
    products().filter((product) => product.archivedAt === null && matches(product, query()));

  const open = (product: Product) => {
    setCounted(product.stock ?? 0);
    setCounting(product);
  };

  // A hand count sets stock to what she sees on the shelf; the log keeps the difference.
  const save = action(function* save(product: Product, stock: number) {
    setBusy(true);
    yield runtime.runPromise(
      ApiClient.use((api) => api.countStock({ productId: product.id, counted: stock })),
    );
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
                  <div class={css({ flex: 1, minWidth: 0 })}>
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
                  </div>
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

      <Sheet
        open={counting() !== undefined}
        title={counting()?.name ?? ""}
        onClose={() => setCounting(undefined)}
      >
        <Show when={counting()}>
          {(product) => (
            <>
              <p class={css(sub, { pb: "18px", mt: "-10px" })}>
                {product().brand} · {product().count} ш. Тавиур дээр хэд байна?
              </p>
              <div class={css({ display: "flex", alignItems: "center", gap: "12px", pb: "20px" })}>
                <button
                  type="button"
                  aria-label="Хасах"
                  disabled={counted() <= 0}
                  onClick={() => setCounted((value) => Math.max(0, value - 1))}
                  class={css(round, { width: "56px", height: "56px", fontSize: "22px" })}
                >
                  <MinusIcon />
                </button>
                <input
                  inputmode="numeric"
                  value={counted()}
                  onInput={(event) =>
                    setCounted(Number(event.currentTarget.value.replaceAll(/\D/gu, "")))
                  }
                  class={css(field, {
                    flex: 1,
                    textAlign: "center",
                    fontSize: "30px",
                    fontWeight: "700",
                    fontVariantNumeric: "tabular-nums",
                  })}
                />
                <button
                  type="button"
                  aria-label="Нэмэх"
                  onClick={() => setCounted((value) => value + 1)}
                  class={css(round, { width: "56px", height: "56px", fontSize: "22px" })}
                >
                  <PlusIcon />
                </button>
              </div>
              <button
                type="button"
                disabled={busy()}
                onClick={() => save(product(), counted())}
                class={css(button, act, large, { width: "100%" })}
              >
                Хадгалах
              </button>
            </>
          )}
        </Show>
      </Sheet>
      <TabBar />
    </main>
  );
}
