import { ProductId } from "@amerik/contracts";
import type { ProductDetail, StockMove, StockMoveReason } from "@amerik/contracts";
import { useParams } from "@solidjs/router";
import * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import {
  action,
  createMemo,
  createOptimistic,
  createSignal,
  Errored,
  For,
  Loading,
  onCleanup,
  refresh,
  Show,
  useContext,
} from "solid-js";
import { css } from "styled-system/css";
import ArchiveIcon from "~icons/ph/archive";
import CopyIcon from "~icons/ph/copy-bold";
import HashIcon from "~icons/ph/hash";
import MoreIcon from "~icons/ph/dots-three-bold";
import PackageIcon from "~icons/ph/package";
import BagIcon from "~icons/ph/shopping-bag-open";
import TagIcon from "~icons/ph/tag";
import CloseIcon from "~icons/ph/x-bold";

import { ApiClient } from "../../api/client";
import { runEffect, RuntimeContext } from "../../api/solid-effect";
import { failureText, money, offline, sized, srcset, when } from "../../format";
import { formText, PriceSheet, StepperSheet, stockText, stockTone } from "../../products";
import {
  act,
  appear,
  button,
  Failed,
  glass,
  glassBar,
  headline,
  Note,
  panel,
  Pill,
  press,
  Problem,
  round,
  section,
  sectionHead,
  Sheet,
  sub,
  title2,
  wide,
} from "../../ui";
import { DetailSkeleton } from "../../skeletons";
import type { Icon } from "../../ui";
import { Zoom } from "../../zoom";

const reasonText: Record<StockMoveReason, string> = {
  sale: "Зарсан",
  cancel: "Цуцалсан",
  edit: "Захиалга зассан",
  receipt: "Ирсэн",
  count: "Тоолсон",
};

/** The label facts she'd read off the bottle, skipping what the product doesn't have. */
const facts = (product: ProductDetail) =>
  [
    ["Хэлбэр", formText[product.form]],
    ["Тун", product.potency],
    ["Ширхэг", `${product.count}`],
    ["Нэг удаагийн хэмжээ", product.servingSize === null ? null : `${product.servingSize} ш`],
    ["Хэдэн удаа", product.servings === null ? null : `${product.servings}`],
    ["Амт", product.flavor],
    ["Ангилал", product.category],
  ].flatMap(([label, value]) => (value ? [{ label, value }] : []));

/** What the stock asks of her: reorder, reorder soon, or count it once. */
const toneText = { owes: "Захиалах", wait: "Дуусаж байна", neutral: "Тоол" };

const signed = (change: number) => (change > 0 ? `+${change}` : `−${-change}`);

const quickAction = css.raw(press, {
  display: "grid",
  justifyItems: "center",
  alignContent: "center",
  gap: "6px",
  height: "76px",
  borderRadius: "18px",
  bg: "surface",
  color: "ink",
  boxShadow: "raiseSm",
  fontSize: "13px",
  fontWeight: "600",
  "& svg": { fontSize: "24px" },
});

function QuickAction(props: { icon: Icon; label: string; onClick?: () => void; href?: string }) {
  return (
    <Show
      when={props.href}
      fallback={
        <button type="button" onClick={() => props.onClick?.()} class={css(quickAction)}>
          <props.icon />
          {props.label}
        </button>
      }
    >
      {(href) => (
        <a href={href()} class={css(quickAction)}>
          <props.icon />
          {props.label}
        </a>
      )}
    </Show>
  );
}

function MoveRow(props: { move: StockMove; now: Date }) {
  return (
    <div class={css({ display: "flex", alignItems: "baseline", gap: "12px", py: "9px" })}>
      <div class={css({ flex: 1, minWidth: 0 })}>
        <div class={css({ fontSize: "17px", fontWeight: "550" })}>
          {reasonText[props.move.reason]}
          <Show when={props.move.orderId}>
            {(orderId) => (
              <a
                href={`/orders/${orderId()}`}
                class={css({ color: "sel", fontVariantNumeric: "tabular-nums" })}
              >
                {" "}
                #{props.move.orderNumber}
              </a>
            )}
          </Show>
        </div>
        <div class={css(sub)}>
          {when(props.move.createdAt, props.now)}
          <Show when={props.move.note}>{(note) => <> · {note()}</>}</Show>
        </div>
      </div>
      <b
        class={css(
          { fontSize: "17px", fontVariantNumeric: "tabular-nums" },
          props.move.change > 0 && { color: "paid" },
        )}
      >
        {signed(props.move.change)}
      </b>
    </div>
  );
}

export default function ProductPage() {
  const params = useParams();
  const productId = () => Schema.decodeUnknownSync(ProductId)(params.id);

  const product = createMemo(() => {
    const id = productId();

    return runEffect(ApiClient.use((api) => api.getProduct({ productId: id })));
  });

  const now = createMemo(() => runEffect(DateTime.nowAsDate));
  const runtime = useContext(RuntimeContext);
  const zoom = useContext(Zoom);
  const [busy, setBusy] = createOptimistic(false);
  const [failed, setFailed] = createSignal<string>();
  const [copied, setCopied] = createSignal(false);
  const [sheet, setSheet] = createSignal<"count" | "receive" | "price" | "menu">();

  const open = (next: ReturnType<typeof sheet>) => {
    setFailed(undefined);
    setSheet(next);
  };

  // A failure keeps the sheet open and says why; success closes it and reloads the page.
  const write = action(async function* write<A, E extends { readonly _tag: string }>(
    effect: Effect.Effect<A, E, ApiClient>,
  ) {
    setBusy(true);
    const exit = await runtime.runPromiseExit(effect);
    yield;

    if (Exit.isFailure(exit)) setFailed(failureText(exit.cause));
    else open(undefined);

    if (Exit.isSuccess(exit) || !offline(exit.cause)) yield refresh(product);
  });

  const count = (counted: number) => {
    const id = productId();

    return write(ApiClient.use((api) => api.countStock({ productId: id, counted })));
  };

  const receive = (received: number) => {
    const id = productId();

    return write(ApiClient.use((api) => api.receiveStock({ productId: id, received })));
  };

  const setPrice = (price: number) => {
    const id = productId();

    return write(ApiClient.use((api) => api.setPrice({ productId: id, price })));
  };

  const archive = (archived: boolean) => {
    const id = productId();

    return write(ApiClient.use((api) => api.archiveProduct({ productId: id, archived })));
  };

  let copiedReset: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copiedReset));

  // What she pastes into a Messenger chat when someone asks the price.
  const copy = async () => {
    const { brand, name, price } = product();
    await navigator.clipboard.writeText(`${brand} ${name}\n${money(price)}`);
    setCopied(true);
    clearTimeout(copiedReset);
    copiedReset = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main class={css({ pb: "60px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<DetailSkeleton photo />}>
          <div class={css(appear)}>
            <header class={css(glassBar, { display: "flex", alignItems: "center", gap: "10px" })}>
              <a href="/products" aria-label="Хаах" class={css(round, glass)}>
                <CloseIcon />
              </a>
              <b class={css(headline, { flex: 1, textAlign: "center" })}>{product().brand}</b>
              <button
                type="button"
                aria-label="Бусад үйлдэл"
                onClick={() => open("menu")}
                class={css(round, glass)}
              >
                <MoreIcon />
              </button>
            </header>

            <Show
              when={product().images.length > 0}
              fallback={
                <div
                  class={css(panel, {
                    mx: "20px",
                    mt: "8px",
                    height: "180px",
                    display: "grid",
                    placeItems: "center",
                    color: "inkMuted",
                  })}
                >
                  Зураггүй
                </div>
              }
            >
              <div
                class={css({
                  display: "flex",
                  gap: "12px",
                  overflowX: "auto",
                  scrollSnapType: "x mandatory",
                  scrollPaddingInline: "20px",
                  px: "20px",
                  pt: "8px",
                  pb: "14px",
                  scrollbarWidth: "none",
                })}
              >
                <For each={product().images}>
                  {(src, index) => (
                    <button
                      type="button"
                      aria-label={`Зураг ${index() + 1} томоор харах`}
                      onClick={() => zoom({ ...product(), image: src })}
                      class={css(panel, {
                        flex: "none",
                        width: "min(78vw, 340px)",
                        aspectRatio: "1",
                        p: "16px",
                        bg: "white",
                        scrollSnapAlign: "start",
                        cursor: "zoom-in",
                        "& img": { width: "100%", height: "100%", objectFit: "contain" },
                      })}
                    >
                      <img
                        src={sized(src, 680)}
                        srcset={srcset(src, 340)}
                        alt={`${product().brand} ${product().name}`}
                        loading={index() === 0 ? "eager" : "lazy"}
                        decoding="async"
                      />
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <div class={css({ px: "20px", pt: "8px" })}>
              <h1
                class={css(title2, { fontSize: "26px", lineHeight: "32px", textWrap: "balance" })}
              >
                {product().name}
              </h1>
              <div class={css({ display: "flex", alignItems: "center", gap: "10px", mt: "12px" })}>
                <button
                  type="button"
                  aria-label="Үнэ өөрчлөх"
                  onClick={() => open("price")}
                  class={css(press, {
                    fontSize: "28px",
                    lineHeight: "34px",
                    fontWeight: "700",
                    letterSpacing: "-0.02em",
                    fontVariantNumeric: "tabular-nums",
                  })}
                >
                  {money(product().price)}
                </button>
                <span class={css({ flex: 1 })} />
                <Show when={product().archivedAt !== null}>
                  <Pill tone="neutral">Архивласан</Pill>
                </Show>
              </div>
            </div>

            <div
              class={css(panel, {
                mx: "16px",
                mt: "18px",
                px: "20px",
                py: "16px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              })}
            >
              <div class={css({ flex: 1 })}>
                <div class={css(sub)}>Үлдэгдэл</div>
                <div
                  class={css({
                    fontSize: "34px",
                    lineHeight: "40px",
                    fontWeight: "700",
                    fontVariantNumeric: "tabular-nums",
                  })}
                >
                  {stockText(product().stock)}
                </div>
                <div class={css(sub, { fontVariantNumeric: "tabular-nums" })}>
                  {product().sold30 > 0
                    ? `Сүүлийн 30 хоногт ${product().sold30} зарсан`
                    : "Сүүлийн 30 хоногт зараагүй"}
                </div>
              </div>
              <Show when={stockTone(product().stock)}>
                {(tone) => <Pill tone={tone()}>{toneText[tone()]}</Pill>}
              </Show>
            </div>

            <div
              class={css({
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "10px",
                px: "16px",
                mt: "14px",
              })}
            >
              <QuickAction icon={HashIcon} label="Тоолох" onClick={() => open("count")} />
              <QuickAction icon={PackageIcon} label="Ирсэн" onClick={() => open("receive")} />
              <QuickAction icon={TagIcon} label="Үнэ" onClick={() => open("price")} />
              <Show
                when={product().archivedAt === null}
                fallback={
                  <QuickAction icon={ArchiveIcon} label="Сэргээх" onClick={() => open("menu")} />
                }
              >
                <QuickAction
                  icon={BagIcon}
                  label="Захиалах"
                  href={`/orders/new?add=${product().id}`}
                />
              </Show>
            </div>
            <button
              type="button"
              onClick={() => void copy()}
              class={css(
                button,
                { mx: "16px", mt: "10px", width: "calc(100% - 32px)" },
                copied() && { bg: "paidBg", color: "paid", boxShadow: "none" },
              )}
            >
              <CopyIcon />
              {copied() ? "Хуулсан" : "Нэр, үнэ хуулах"}
            </button>

            <section class={css(section)}>
              <div class={css(sectionHead)}>
                <h2 class={css(title2)}>Мэдээлэл</h2>
              </div>
              <dl
                class={css({ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px" })}
              >
                <For each={facts(product())} keyed={(fact) => fact.label}>
                  {(fact) => (
                    <>
                      <dt class={css(sub, { fontSize: "17px", lineHeight: "22px" })}>
                        {fact().label}
                      </dt>
                      <dd
                        class={css({
                          fontSize: "17px",
                          lineHeight: "22px",
                          fontWeight: "550",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        })}
                      >
                        {fact().value}
                      </dd>
                    </>
                  )}
                </For>
              </dl>
            </section>

            <Show when={product().description}>
              {(description) => (
                <section class={css(section)}>
                  <div class={css(sectionHead)}>
                    <h2 class={css(title2)}>Тайлбар</h2>
                  </div>
                  <div
                    class={css({
                      display: "grid",
                      gap: "12px",
                      fontSize: "17px",
                      lineHeight: "25px",
                    })}
                  >
                    <For each={description().split(/\n+/u)}>
                      {(paragraph) => <p>{paragraph}</p>}
                    </For>
                  </div>
                </section>
              )}
            </Show>

            <section class={css(section)}>
              <div class={css(sectionHead)}>
                <h2 class={css(title2)}>Түүх</h2>
              </div>
              <Show
                when={product().moves.length > 0}
                fallback={<p class={css(sub)}>Хөдөлгөөн алга.</p>}
              >
                <For each={product().moves} keyed={(move) => move.id}>
                  {(move) => <MoveRow move={move()} now={now()} />}
                </For>
              </Show>
            </section>

            <StepperSheet
              open={sheet() === "count"}
              title="Тоолох"
              prompt="Тавиур дээр хэд байна?"
              start={product().stock ?? 0}
              min={0}
              busy={busy()}
              failed={failed()}
              onClose={() => open(undefined)}
              onSave={(counted) => void count(counted)}
            />
            <StepperSheet
              open={sheet() === "receive"}
              title="Ирсэн бараа"
              prompt={`Хэдэн ширхэг ирсэн бэ? Одоо ${stockText(product().stock)}.`}
              start={1}
              min={1}
              busy={busy()}
              failed={failed()}
              onClose={() => open(undefined)}
              onSave={(received) => void receive(received)}
            />
            <PriceSheet
              open={sheet() === "price"}
              title="Үнэ"
              prompt={`Одоо ${money(product().price)}. Хуучин захиалгын үнэ өөрчлөгдөхгүй.`}
              price={product().price}
              busy={busy()}
              failed={failed()}
              onClose={() => open(undefined)}
              onSave={(price) => void setPrice(price)}
            />
            <Sheet open={sheet() === "menu"} title={product().name} onClose={() => open(undefined)}>
              <Show
                when={product().archivedAt === null}
                fallback={
                  <>
                    <p class={css(sub, { pb: "18px", mt: "-10px" })}>
                      Архивласан бараа жагсаалт болон шинэ захиалгад харагдахгүй.
                    </p>
                    <Failed text={failed()} />
                    <button
                      type="button"
                      disabled={busy()}
                      onClick={() => void archive(false)}
                      class={css(button, act, wide)}
                    >
                      Сэргээх
                    </button>
                  </>
                }
              >
                <div class={css({ pb: "18px", mt: "-10px" })}>
                  <Note>Хуучин захиалгууд хэвээр үлдэнэ. Хүссэн үедээ сэргээж болно.</Note>
                </div>
                <Failed text={failed()} />
                <button
                  type="button"
                  disabled={busy()}
                  onClick={() => void archive(true)}
                  class={css(button, wide, { color: "owes" })}
                >
                  <ArchiveIcon />
                  Архивлах
                </button>
              </Show>
            </Sheet>
          </div>
        </Loading>
      </Errored>
    </main>
  );
}
