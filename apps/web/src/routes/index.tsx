import * as DateTime from "effect/DateTime";
import { createMemo, Errored, For, Loading, Show } from "solid-js";
import { css } from "styled-system/css";
import ChecklistIcon from "~icons/ph/list-checks";
import ClockIcon from "~icons/ph/clock";
import PackageIcon from "~icons/ph/package";
import WalletIcon from "~icons/ph/wallet";
import WarningIcon from "~icons/ph/warning-circle";

import { ApiClient } from "../api/client";
import { runEffect } from "../api/solid-effect";
import { longDate, money } from "../format";
import {
  block,
  blockTitle,
  button,
  countBadge,
  darkButton,
  muted,
  Photo,
  Problem,
  TabBar,
  top,
} from "../ui";

const row = css.raw({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  px: "16px",
  py: "12px",
  "& + &": { borderTop: "1px solid {colors.line}" },
});

const circle = css.raw({
  width: "44px",
  height: "44px",
  borderRadius: "50%",
  border: "1px solid {colors.line}",
  display: "grid",
  placeItems: "center",
  flex: "none",
  "& svg": { fontSize: "22px" },
});

const small = css.raw({ display: "block", fontSize: "14px", lineHeight: "18px" });

export default function Home() {
  const home = createMemo(() => runEffect(ApiClient.use((api) => api.home())));
  const now = createMemo(() => runEffect(DateTime.nowAsDate));

  return (
    <main class={css(top, { pb: "100px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(block, { height: "320px", mt: "40px" })} />}>
          <p class={css(muted, { px: "16px", pb: "10px", fontSize: "15px" })}>{longDate(now())}</p>

          <section class={css(block)}>
            <Show
              when={home().toShip > 0}
              fallback={
                <div class={css(row)}>
                  <span class={css(circle)}>
                    <PackageIcon />
                  </span>
                  <span class={css(muted, { fontSize: "16px" })}>
                    Илгээх захиалга одоохондоо алга
                  </span>
                </div>
              }
            >
              <div class={css(row)}>
                <span class={css(circle)}>
                  <PackageIcon />
                </span>
                <div class={css({ flex: 1 })}>
                  <b class={css({ fontSize: "18px", fontWeight: "600" })}>
                    {home().toShip} илгээмж савлах
                  </b>
                  <small class={css(small, muted)}>Тавиураас {home().toShipPieces} ширхэг</small>
                </div>
                <a href="/pack" class={css(button, darkButton)}>
                  Савлах
                </a>
              </div>
              <div
                class={css({
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "14px 12px",
                  px: "16px",
                  pt: "4px",
                  pb: "16px",
                })}
              >
                <For each={home().shelf} keyed={(product) => product.productId}>
                  {(product) => (
                    <div>
                      <span class={css({ position: "relative", display: "inline-block" })}>
                        <Photo product={product()} size={104} />
                        <span class={css(countBadge, { fontSize: "15px", lineHeight: "22px" })}>
                          ×{product().quantity}
                        </span>
                      </span>
                      <span
                        class={css({
                          lineClamp: 2,
                          fontSize: "14px",
                          lineHeight: "18px",
                          fontWeight: "600",
                          mt: "8px",
                        })}
                      >
                        {product().name}
                      </span>
                      <small
                        class={css(small, muted, {
                          fontSize: "13px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        })}
                      >
                        {product().brand} · {product().count} ш
                      </small>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <Show when={home().awaitingPayment > 0}>
            <section class={css(block)}>
              <h2 class={css(blockTitle)}>
                <ChecklistIcon />
                Хийх зүйлс
              </h2>
              <div class={css(row)}>
                <span class={css(circle)}>
                  <ClockIcon />
                </span>
                <div class={css({ flex: 1 })}>
                  <b class={css({ fontSize: "16px", fontWeight: "600" })}>
                    {home().awaitingPayment} төлбөр хүлээж байна
                  </b>
                  <small class={css(small, muted)}>Шилжүүлэг ирсэн эсэхийг шалгах</small>
                </div>
                <a href="/orders?view=awaiting" class={css(button)}>
                  Шалгах
                </a>
              </div>
            </section>
          </Show>

          <section class={css(block, { fontVariantNumeric: "tabular-nums" })}>
            <h2 class={css(blockTitle)}>
              <WalletIcon />
              Мөнгө
            </h2>
            <div class={css(row)}>
              <span class={css({ flex: 1, fontSize: "16px" })}>
                Хүргэлтээр авах
                <span class={css(muted)}> · {home().codOrders} илгээмж</span>
              </span>
              <b class={css({ fontSize: "18px", fontWeight: "700", color: "owes" })}>
                {money(home().codToCollect)}
              </b>
            </div>
            <div class={css(row)}>
              <span class={css({ flex: 1, fontSize: "16px" })}>Өнөөдөр орсон</span>
              <b class={css({ fontSize: "18px", fontWeight: "700" })}>{money(home().paidToday)}</b>
            </div>
          </section>

          <Show when={home().lowStock.length > 0}>
            <section class={css(block)}>
              <h2 class={css(blockTitle)}>
                <WarningIcon />
                Удахгүй дуусна
              </h2>
              <For each={home().lowStock} keyed={(product) => product.productId}>
                {(product) => (
                  <div class={css(row)}>
                    <Photo product={product()} size={48} />
                    <div class={css({ flex: 1, minWidth: 0 })}>
                      <div class={css({ fontSize: "16px", fontWeight: "600" })}>
                        {product().name}
                      </div>
                      <small class={css(small, muted)}>
                        {product().brand} · {product().count} ш
                      </small>
                    </div>
                    <b
                      class={css(
                        { fontSize: "16px", fontWeight: "600", whiteSpace: "nowrap" },
                        product().stock === 0 && { color: "owes" },
                      )}
                    >
                      {product().stock === 0 ? "Дууссан" : `${product().stock} үлдсэн`}
                    </b>
                  </div>
                )}
              </For>
            </section>
          </Show>
        </Loading>
      </Errored>
      <TabBar />
    </main>
  );
}
