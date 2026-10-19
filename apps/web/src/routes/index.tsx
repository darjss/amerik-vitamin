import type { JSX } from "@solidjs/web";
import * as DateTime from "effect/DateTime";
import { createMemo, Errored, For, Loading, Show } from "solid-js";

import { css } from "styled-system/css";
import CaretIcon from "~icons/ph/caret-right";
import ClockIcon from "~icons/ph/clock";
import PackageIcon from "~icons/ph/package";

import { ApiClient } from "../api/client";
import { runEffect } from "../api/solid-effect";
import { longDate, money } from "../format";
import {
  button,
  card,
  cardTitle,
  countBadge,
  darkButton,
  Header,
  muted,
  Photo,
  Problem,
  TabBar,
} from "../ui";

const row = css.raw({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  px: "16px",
  py: "10px",
  "& + &": { borderTop: "1px solid {colors.line}" },
});

const circle = css.raw({
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  bg: "chip",
  display: "grid",
  placeItems: "center",
  fontSize: "20px",
  flex: "none",
  overflow: "hidden",
});

function Todo(props: {
  href: string;
  icon: JSX.Element;
  title: JSX.Element;
  sub: string;
  action?: string;
}) {
  return (
    <a href={props.href} class={css(row)}>
      <span class={css(circle)}>{props.icon}</span>
      <div class={css({ flex: 1, minWidth: 0 })}>
        {props.title}
        <small class={css(muted, { display: "block", fontSize: "13px", lineHeight: "17px" })}>
          {props.sub}
        </small>
      </div>
      <Show when={props.action} fallback={<CaretIcon class={css(muted)} />}>
        {(label) => <span class={css(button, darkButton)}>{label()}</span>}
      </Show>
    </a>
  );
}

export default function Home() {
  const home = createMemo(() => runEffect(ApiClient.use((api) => api.home())));
  const now = createMemo(() => runEffect(DateTime.nowAsDate));

  return (
    <main class={css({ pb: "100px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(card, { height: "320px", mt: "120px" })} />}>
          <Header above={longDate(now())} title="Америк Хүнс Бараа" />
          <div class={css(card, { display: "grid", gridTemplateColumns: "1fr 1fr" })}>
            <Money label="Өнөөдөр орсон" amount={home().paidToday} sub="QPay, шилжүүлэг" />
            <Money
              label="Хүргэлтээр авах"
              amount={home().codToCollect}
              sub={`${home().codOrders} захиалга`}
              owes
            />
          </div>

          <div class={css(card)}>
            <h2 class={css(cardTitle)}>Хийх зүйлс</h2>
            <Show
              when={home().toShip > 0 || home().awaitingPayment > 0}
              fallback={<p class={css(row, muted)}>Одоохондоо юу ч алга</p>}
            >
              <Show when={home().toShip > 0}>
                <Todo
                  href="/orders"
                  icon={<PackageIcon />}
                  title={<b>{home().toShip} захиалга илгээх</b>}
                  sub={`${home().toShipPieces} ширхэг`}
                  action="Савлах"
                />
              </Show>
              <Show when={home().awaitingPayment > 0}>
                <Todo
                  href="/orders?view=awaiting"
                  icon={<ClockIcon />}
                  title={
                    <>
                      <b>{home().awaitingPayment} захиалга</b> төлбөр хүлээж байна
                    </>
                  }
                  sub="Төлөгдмөгц илгээх жагсаалтад орно"
                />
              </Show>
            </Show>
          </div>

          <Show when={home().shelf.length > 0}>
            <div class={css(card)}>
              <h2 class={css(cardTitle)}>Тавиураас авах</h2>
              <div
                class={css({
                  display: "flex",
                  gap: "10px",
                  px: "16px",
                  pt: "4px",
                  pb: "16px",
                  overflowX: "auto",
                })}
              >
                <For each={home().shelf} keyed={(product) => product.productId}>
                  {(product) => (
                    <div class={css({ width: "104px", flex: "none" })}>
                      <div
                        class={css({
                          position: "relative",
                          height: "104px",
                          borderRadius: "12px",
                          boxShadow: "hairline",
                          overflow: "hidden",
                        })}
                      >
                        <Photo
                          src={product().image}
                          alt={`${product().brand} ${product().name}`}
                          styles={{ p: "8px" }}
                        />
                        <span
                          class={css(countBadge, {
                            left: "6px",
                            top: "6px",
                            bottom: "auto",
                            fontSize: "13px",
                            lineHeight: "20px",
                            borderRadius: "8px",
                            px: "7px",
                            border: "none",
                          })}
                        >
                          ×{product().quantity}
                        </span>
                      </div>
                      <div
                        class={css({
                          fontSize: "13px",
                          lineHeight: "16px",
                          mt: "6px",
                          fontWeight: "550",
                        })}
                      >
                        {product().name}
                      </div>
                      <small
                        class={css(muted, {
                          display: "block",
                          fontSize: "12px",
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
            </div>
          </Show>

          <Show when={home().lowStock.length > 0}>
            <div class={css(card)}>
              <h2 class={css(cardTitle)}>Удахгүй дуусна</h2>
              <For each={home().lowStock} keyed={(product) => product.productId}>
                {(product) => (
                  <div class={css(row)}>
                    <span class={css(circle)}>
                      <Photo src={product().image} alt={`${product().brand} ${product().name}`} />
                    </span>
                    <div class={css({ flex: 1, minWidth: 0 })}>
                      <b>{product().name}</b>
                      <small class={css(muted, { display: "block", fontSize: "13px" })}>
                        {product().brand} · {product().count} ш
                      </small>
                    </div>
                    <b
                      class={css({
                        color: product().stock === 0 ? "owes" : "ink",
                        whiteSpace: "nowrap",
                      })}
                    >
                      {product().stock === 0 ? "Дууссан" : `${product().stock} үлдсэн`}
                    </b>
                  </div>
                )}
              </For>
              <div class={css({ height: "6px" })} />
            </div>
          </Show>
        </Loading>
      </Errored>
      <TabBar />
    </main>
  );
}

function Money(props: { label: string; amount: number; sub: string; owes?: boolean }) {
  return (
    <div
      class={css({
        px: "16px",
        py: "14px",
        "& + &": { borderLeft: "1px solid {colors.line}" },
      })}
    >
      <small class={css(muted, { display: "block", fontSize: "13px" })}>{props.label}</small>
      <b
        class={css(
          {
            display: "block",
            fontSize: "22px",
            lineHeight: "28px",
            fontWeight: "700",
            letterSpacing: "-0.3px",
            fontVariantNumeric: "tabular-nums",
          },
          props.owes && { color: "owes" },
        )}
      >
        {money(props.amount)}
      </b>
      <small class={css(muted, { display: "block", fontSize: "13px" })}>{props.sub}</small>
    </div>
  );
}
