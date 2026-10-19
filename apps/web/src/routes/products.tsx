import { createMemo, Errored, For, Loading } from "solid-js";
import { css } from "styled-system/css";

import { ApiClient } from "../api/client";
import { runEffect } from "../api/solid-effect";
import { money } from "../format";
import { card, Header, muted, Photo, Problem, TabBar } from "../ui";

// Null until the first count or receipt.
const stockText = (stock: number | null) => {
  if (stock === null) return "Тоолоогүй";

  return stock === 0 ? "Дууссан" : `${stock}`;
};

export default function Products() {
  const products = createMemo(() => runEffect(ApiClient.use((api) => api.listProducts())));

  return (
    <main class={css({ pb: "100px" })}>
      <Header title="Бараа" />
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(card, { height: "320px" })} />}>
          <div class={css(card)}>
            <For
              each={products().filter((product) => product.archivedAt === null)}
              keyed={(product) => product.id}
            >
              {(product) => (
                <div
                  class={css({
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    px: "12px",
                    py: "10px",
                    "& + &": { borderTop: "1px solid {colors.line}" },
                  })}
                >
                  <Photo
                    src={product().image}
                    alt={`${product().brand} ${product().name}`}
                    styles={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "12px",
                      boxShadow: "hairline",
                      flex: "none",
                    }}
                  />
                  <div class={css({ flex: 1, minWidth: 0 })}>
                    <div class={css({ fontWeight: "600" })}>{product().name}</div>
                    <small class={css(muted, { display: "block", fontSize: "13px" })}>
                      {product().brand} · {product().count} ш · {money(product().price)}
                    </small>
                  </div>
                  <b
                    class={css({
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                      color: product().stock === 0 ? "owes" : "ink",
                    })}
                  >
                    {stockText(product().stock)}
                  </b>
                </div>
              )}
            </For>
          </div>
        </Loading>
      </Errored>
      <TabBar />
    </main>
  );
}
