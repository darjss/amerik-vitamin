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
import MinusIcon from "~icons/ph/minus-bold";
import PlusIcon from "~icons/ph/plus-bold";
import SearchIcon from "~icons/ph/magnifying-glass";

import { ApiClient } from "../api/client";
import { runEffect, RuntimeContext } from "../api/solid-effect";
import { money } from "../format";
import {
  bigButton,
  block,
  button,
  darkButton,
  field,
  muted,
  Photo,
  Problem,
  Sheet,
  TabBar,
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
    <main class={css(top, { pb: "100px" })}>
      <label
        class={css({
          mx: "16px",
          mb: "10px",
          height: "44px",
          borderRadius: "12px",
          bg: "surface",
          border: "1px solid {colors.line}",
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
          placeholder="Бараа хайх"
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(block, { height: "320px" })} />}>
          <div class={css(block)}>
            <For each={shown()} keyed={(product) => product.id}>
              {(product) => (
                <div
                  class={css({
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    px: "16px",
                    py: "10px",
                    "& + &": { borderTop: "1px solid {colors.line}" },
                  })}
                >
                  <Photo product={product()} size={56} />
                  <div class={css({ flex: 1, minWidth: 0 })}>
                    <div class={css({ fontSize: "16px", fontWeight: "600" })}>{product().name}</div>
                    <small class={css(muted, { display: "block", fontSize: "14px" })}>
                      {product().brand} · {product().count} ш · {money(product().price)}
                    </small>
                  </div>
                  <button
                    type="button"
                    aria-label={`${product().name} тоолох`}
                    onClick={() => open(product())}
                    class={css(
                      button,
                      { minWidth: "56px", px: "10px", fontVariantNumeric: "tabular-nums" },
                      product().stock === 0 && { color: "owes" },
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
              <p class={css(muted, { fontSize: "15px", pb: "16px" })}>
                {product().brand} · {product().count} ш. Тавиур дээр хэд байна?
              </p>
              <div
                class={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  pb: "20px",
                  "& > button": { width: "56px", height: "56px", px: 0, borderRadius: "50%" },
                })}
              >
                <button
                  type="button"
                  aria-label="Хасах"
                  disabled={counted() <= 0}
                  onClick={() => setCounted((value) => Math.max(0, value - 1))}
                  class={css(button)}
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
                    fontSize: "28px",
                    fontWeight: "700",
                  })}
                />
                <button
                  type="button"
                  aria-label="Нэмэх"
                  onClick={() => setCounted((value) => value + 1)}
                  class={css(button)}
                >
                  <PlusIcon />
                </button>
              </div>
              <button
                type="button"
                disabled={busy()}
                onClick={() => save(product(), counted())}
                class={css(button, darkButton, bigButton, { width: "100%" })}
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
