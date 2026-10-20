import * as DateTime from "effect/DateTime";
import { createMemo, Errored, For, Loading, Show } from "solid-js";
import { css } from "styled-system/css";
import BankIcon from "~icons/ph/bank-bold";
import CaretIcon from "~icons/ph/caret-right-bold";
import PackageIcon from "~icons/ph/package-bold";

import { ApiClient } from "../api/client";
import { runEffect } from "../api/solid-effect";
import { TabBar } from "../chrome";
import { longDate, money } from "../format";
import {
  act,
  button,
  headline,
  large,
  largeTitle,
  panel,
  Pill,
  Problem,
  section,
  sectionHead,
  small,
  sub,
  Tile,
  title2,
  title3,
  top,
} from "../ui";

const bigMoney = css.raw({
  fontSize: "30px",
  lineHeight: "36px",
  fontWeight: "700",
  letterSpacing: "-0.025em",
  fontVariantNumeric: "tabular-nums",
});

export default function Home() {
  const home = createMemo(() => runEffect(ApiClient.use((api) => api.home())));
  const now = createMemo(() => runEffect(DateTime.nowAsDate));

  // "Мягмар, 10-р сарын 20": the weekday in ink, the date softer.
  const date = () => {
    const [weekday, rest] = longDate(now()).split(", ");

    return { weekday, rest };
  };

  return (
    <main class={css(top, { pb: "120px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(panel, { m: "60px 16px 0", height: "420px" })} />}>
          <h1
            class={css(largeTitle, {
              px: "20px",
              pt: "28px",
              fontSize: "32px",
              lineHeight: "38px",
            })}
          >
            {date().weekday},{" "}
            <span class={css({ color: "inkMuted", fontWeight: "600" })}>{date().rest}</span>
          </h1>

          <section class={css(panel, { mx: "16px", mt: "20px", borderRadius: "26px" })}>
            <Show
              when={home().toShip > 0}
              fallback={
                <div class={css({ p: "20px" })}>
                  <h2 class={css(title3)}>Илгээх захиалга алга</h2>
                  <p class={css(sub, { mt: "2px" })}>Шинэ захиалга ирэхэд энд гарна</p>
                </div>
              }
            >
              <div class={css({ px: "20px", pt: "20px" })}>
                <h2 class={css(title3)}>Өнөөдөр савлах</h2>
                <p class={css(sub, { mt: "2px", fontVariantNumeric: "tabular-nums" })}>
                  {home().toShip} илгээмж · {home().toShipPieces} ширхэг
                </p>
              </div>
              <div
                class={css({
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "18px 14px",
                  px: "20px",
                  pt: "22px",
                  pb: "20px",
                })}
              >
                <For each={home().shelf} keyed={(product) => product.productId}>
                  {(product) => (
                    <div>
                      <Tile product={product()} quantity={product().quantity} ring="surface" />
                      <div
                        class={css({
                          mt: "9px",
                          fontSize: "15px",
                          lineHeight: "19px",
                          fontWeight: "600",
                          letterSpacing: "-0.01em",
                          lineClamp: 3,
                        })}
                      >
                        {product().name}
                      </div>
                    </div>
                  )}
                </For>
              </div>
              <div class={css({ px: "16px", pb: "16px" })}>
                <a href="/pack" class={css(button, act, large, { width: "100%" })}>
                  <PackageIcon />
                  Савлах
                </a>
              </div>
            </Show>
          </section>

          <Show when={home().awaitingPayment > 0}>
            <section class={css(section)}>
              <div class={css(sectionHead)}>
                <h2 class={css(title2)}>Хийх</h2>
              </div>
              <div class={css({ display: "flex", alignItems: "center", gap: "14px" })}>
                <span
                  class={css({
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    flex: "none",
                    fontSize: "23px",
                    bg: "waitBg",
                    color: "wait",
                  })}
                >
                  <BankIcon />
                </span>
                <div class={css({ flex: 1, minWidth: 0 })}>
                  <div class={css(headline)}>{home().awaitingPayment} төлбөр хүлээж байна</div>
                  <div class={css(sub)}>Шилжүүлэг ирсэн эсэхийг шалгах</div>
                </div>
                <a href="/orders?view=awaiting" class={css(button, act, small)}>
                  Шалгах
                </a>
              </div>
            </section>
          </Show>

          <section class={css(section)}>
            <div class={css(sectionHead)}>
              <h2 class={css(title2)}>Мөнгө</h2>
            </div>
            <div class={css({ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: "16px" })}>
              <div>
                <div class={css(bigMoney, { color: "owes" })}>{money(home().codToCollect)}</div>
                <div class={css(sub, { mt: "2px" })}>{home().codOrders} илгээмжээс авах</div>
              </div>
              <div>
                <div class={css(bigMoney)}>{money(home().paidToday)}</div>
                <div class={css(sub, { mt: "2px" })}>Өнөөдөр орсон</div>
              </div>
            </div>
          </section>

          <Show when={home().lowStock.length > 0}>
            <section class={css(section)}>
              <div class={css(sectionHead)}>
                <h2 class={css(title2)}>Дуусаж байна</h2>
                <a
                  href="/products"
                  class={css({
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                    fontSize: "15px",
                    fontWeight: "600",
                    py: "12px",
                    my: "-12px",
                  })}
                >
                  Бараа
                  <CaretIcon />
                </a>
              </div>
              <div class={css({ display: "grid", gap: "12px" })}>
                <For each={home().lowStock} keyed={(product) => product.productId}>
                  {(product) => (
                    <div
                      class={css({ display: "flex", alignItems: "center", gap: "14px", py: "6px" })}
                    >
                      <Tile product={product()} size={56} />
                      <div class={css({ flex: 1, minWidth: 0 })}>
                        <div class={css(headline)}>{product().name}</div>
                        <div class={css(sub)}>
                          {product().brand} · {product().count} ш
                        </div>
                      </div>
                      <Show when={product().stock > 0} fallback={<Pill tone="owes">Дууссан</Pill>}>
                        <Pill tone="wait">{product().stock} үлдсэн</Pill>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </section>
          </Show>
        </Loading>
      </Errored>
      <TabBar />
    </main>
  );
}
