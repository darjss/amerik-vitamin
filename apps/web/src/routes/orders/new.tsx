import type { OrderSource, OrderSummary, ProductId, ProductRow } from "@amerik/contracts";
import { useNavigate } from "@solidjs/router";
import * as Effect from "effect/Effect";
import {
  action,
  createMemo,
  createOptimistic,
  createSignal,
  createStore,
  Errored,
  For,
  Loading,
  Show,
  useContext,
} from "solid-js";
import { css } from "styled-system/css";
import MapPinIcon from "~icons/ph/map-pin";
import MinusIcon from "~icons/ph/minus-bold";
import NoteIcon from "~icons/ph/note-pencil";
import PhoneIcon from "~icons/ph/phone";
import PlusIcon from "~icons/ph/plus-bold";
import SearchIcon from "~icons/ph/magnifying-glass";
import CloseIcon from "~icons/ph/x";

import { ApiClient } from "../../api/client";
import { runEffect, RuntimeContext } from "../../api/solid-effect";
import { money } from "../../format";
import {
  bigButton,
  block,
  blockTitle,
  button,
  countBadge,
  darkButton,
  muted,
  Photo,
  Problem,
  Segmented,
  top,
} from "../../ui";

type Product = typeof ProductRow.Type;

const FEE = 6000;

const sources = [
  ["messenger_human", "Чат"],
  ["phone", "Утас"],
  ["walk_in", "Дэлгүүр"],
] satisfies ReadonlyArray<readonly [OrderSource, string]>;

/** One line of the contact group: an icon, then the input. */
const contactRow = css.raw({
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  px: "16px",
  py: "12px",
  "& + &": { borderTop: "1px solid {colors.line}" },
  "& > svg": { flex: "none", fontSize: "22px", color: "inkMuted", mt: "1px" },
  "& input, & textarea": {
    flex: 1,
    minWidth: 0,
    bg: "transparent",
    outline: "none",
    fontSize: "17px",
    lineHeight: "24px",
    color: "ink",
    resize: "none",
    _placeholder: { color: "inkMuted" },
  },
});

const stepper = css.raw({ width: "36px", height: "36px", px: 0, borderRadius: "50%" });

const kv = css.raw({ display: "flex", justifyContent: "space-between", py: "3px" });

/**
 * An order she writes by hand from a chat, a call or the counter (PRODUCT.md,
 * Features 9). A known phone fills in the last address and shows what it
 * bought before, one tap to add again.
 */
export default function NewOrder() {
  const products = createMemo(() => runEffect(ApiClient.use((api) => api.listProducts())));
  const runtime = useContext(RuntimeContext);
  const navigate = useNavigate();

  const [phone, setPhone] = createSignal("");
  const [address, setAddress] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [source, setSource] = createSignal<OrderSource>("messenger_human");
  const [terms, setTerms] = createSignal<"prepay" | "cod">("prepay");
  const [query, setQuery] = createSignal("");
  const [cart, setCart] = createStore<Record<ProductId, number>>({});
  const [history, setHistory] = createSignal<ReadonlyArray<typeof OrderSummary.Type>>([]);
  const [busy, setBusy] = createOptimistic(false);
  const [failed, setFailed] = createSignal(false);

  const walkIn = () => source() === "walk_in";
  const fee = () => (walkIn() ? 0 : FEE);
  const live = () => products().filter((product) => product.archivedAt === null);

  const picked = () =>
    live().flatMap((product) => {
      const quantity = cart[product.id] ?? 0;

      return quantity > 0 ? [{ product, quantity }] : [];
    });

  // Sold out goes last; a search narrows by brand or name.
  const shown = () => {
    const words = query().trim().toLowerCase();

    return live()
      .filter((product) => `${product.brand} ${product.name}`.toLowerCase().includes(words))
      .toSorted((a, b) => Number(a.stock === 0) - Number(b.stock === 0));
  };

  // What this phone bought before, most recent first.
  const before = () => {
    const ids = new Set(history().flatMap((order) => order.lines.map((line) => line.productId)));

    return live().filter((product) => ids.has(product.id));
  };

  const subtotal = () =>
    picked().reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  const add = (product: Product, change: number) =>
    setCart((draft) => {
      draft[product.id] = Math.max(0, (draft[product.id] ?? 0) + change);
    });

  const lookUp = (digits: string) => {
    setHistory([]);

    if (digits.length !== 8) return;

    void runtime
      .runPromise(
        ApiClient.use((api) => api.listOrders({ phone: digits })).pipe(
          Effect.orElseSucceed(() => []),
        ),
      )
      .then((orders) => {
        setHistory(orders);

        const last = orders.find((order) => order.address !== null)?.address;

        if (address() === "" && last !== undefined && last !== null) setAddress(last);
      });
  };

  const missing = () => {
    if (picked().length === 0) return "Бараа сонгоно уу";

    return walkIn() || phone().length === 8 ? undefined : "Утасны дугаар оруулна уу";
  };

  const place = action(function* place() {
    const [first, ...rest] = picked().map(({ product, quantity }) => ({
      productId: product.id,
      quantity,
    }));

    if (first === undefined) return;

    const input = {
      phone: phone().length === 8 ? phone() : undefined,
      address: address().trim() || undefined,
      notes: notes().trim() || undefined,
      source: source(),
      terms: terms(),
      fulfillment: walkIn() ? ("in_store" as const) : ("courier" as const),
      deliveryFee: fee(),
      lines: [first, ...rest] as const,
    };

    setBusy(true);
    setFailed(false);

    try {
      yield runtime
        .runPromise(ApiClient.use((api) => api.placeOrder(input)))
        .then((placed) => navigate(`/orders/${placed.orderId}`, { replace: true }));
    } catch {
      setFailed(true);
    }
  });

  return (
    <main class={css(top, { pb: "170px" })}>
      <div
        class={css({
          display: "flex",
          alignItems: "center",
          gap: "8px",
          px: "8px",
          pb: "8px",
          "& svg": { fontSize: "24px" },
        })}
      >
        <a href="/orders" aria-label="Хаах" class={css({ p: "8px" })}>
          <CloseIcon />
        </a>
        <b class={css({ fontSize: "18px", fontWeight: "600" })}>Шинэ захиалга</b>
      </div>

      <div class={css({ px: "16px", pb: "12px" })}>
        <Segmented options={sources} value={source()} onChange={setSource} />
      </div>

      <section class={css(block)}>
        <label class={css(contactRow)}>
          <PhoneIcon />
          <span class={css({ flex: 1, minWidth: 0, display: "grid", gap: "2px" })}>
            <input
              inputmode="numeric"
              autocomplete="off"
              aria-label="Утас"
              placeholder={walkIn() ? "Утас, заавал биш" : "Утас"}
              value={phone()}
              onInput={(event) => {
                const digits = event.currentTarget.value.replaceAll(/\D/gu, "").slice(-8);
                setPhone(digits);
                lookUp(digits);
              }}
              class={css({ fontWeight: "600", fontVariantNumeric: "tabular-nums" })}
            />
            <Show when={history().length > 0}>
              <small
                class={css({
                  justifySelf: "start",
                  fontSize: "13px",
                  fontWeight: "600",
                  bg: "highlight",
                  borderRadius: "6px",
                  px: "6px",
                  lineHeight: "20px",
                })}
              >
                {history().length + 1} дахь захиалга
              </small>
            </Show>
          </span>
        </label>
        <Show when={!walkIn()}>
          <label class={css(contactRow)}>
            <MapPinIcon />
            <textarea
              rows={2}
              aria-label="Хаяг"
              placeholder="Хаяг"
              value={address()}
              onInput={(event) => setAddress(event.currentTarget.value)}
            />
          </label>
        </Show>
        <label class={css(contactRow)}>
          <NoteIcon />
          <input
            aria-label="Тэмдэглэл"
            placeholder="Тэмдэглэл: орцны код, хэзээ хүргэх"
            value={notes()}
            onInput={(event) => setNotes(event.currentTarget.value)}
          />
        </label>
      </section>

      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(block, { height: "320px" })} />}>
          <Show when={picked().length > 0}>
            <section class={css(block, { pb: "12px" })}>
              <h2 class={css(blockTitle)}>Сагс</h2>
              <For each={picked()} keyed={(line) => line.product.id}>
                {(line) => (
                  <div
                    class={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      px: "16px",
                      py: "8px",
                    })}
                  >
                    <Photo product={line().product} size={52} />
                    <div class={css({ flex: 1, minWidth: 0 })}>
                      <div class={css({ fontSize: "16px", fontWeight: "600" })}>
                        {line().product.name}
                      </div>
                      <div class={css(muted, { fontSize: "14px" })}>
                        {line().product.brand} · {money(line().product.price * line().quantity)}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Хасах"
                      onClick={() => add(line().product, -1)}
                      class={css(button, stepper)}
                    >
                      <MinusIcon />
                    </button>
                    <b
                      class={css({
                        minWidth: "20px",
                        textAlign: "center",
                        fontSize: "18px",
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      {line().quantity}
                    </b>
                    <button
                      type="button"
                      aria-label="Нэмэх"
                      onClick={() => add(line().product, 1)}
                      class={css(button, stepper)}
                    >
                      <PlusIcon />
                    </button>
                  </div>
                )}
              </For>
              <div
                class={css({
                  mx: "16px",
                  mt: "8px",
                  pt: "10px",
                  borderTop: "1px solid {colors.line}",
                  fontSize: "15px",
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                <div class={css(kv)}>
                  <span class={css(muted)}>Бараа</span>
                  <span>{money(subtotal())}</span>
                </div>
                <div class={css(kv)}>
                  <span class={css(muted)}>{walkIn() ? "Хүргэлтгүй" : "Хүргэлт"}</span>
                  <span>{money(fee())}</span>
                </div>
              </div>
            </section>
          </Show>

          <Show when={before().length > 0}>
            <section class={css(block, { pb: "14px" })}>
              <h2 class={css(blockTitle)}>Өмнө авсан</h2>
              <div
                class={css({
                  display: "grid",
                  gridAutoFlow: "column",
                  gridAutoColumns: "112px",
                  gap: "12px",
                  px: "16px",
                  overflowX: "auto",
                })}
              >
                <For each={before()} keyed={(product) => product.id}>
                  {(product) => (
                    <Tile
                      product={product()}
                      quantity={cart[product().id] ?? 0}
                      onAdd={() => add(product(), 1)}
                    />
                  )}
                </For>
              </div>
            </section>
          </Show>

          <section class={css(block, { pb: "16px" })}>
            <h2 class={css(blockTitle)}>Бараа</h2>
            <div class={css({ px: "16px", pb: "14px" })}>
              <label
                class={css({
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
                  placeholder="D3, омега, магни…"
                  value={query()}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                />
              </label>
            </div>
            <div
              class={css({
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "18px 12px",
                px: "16px",
              })}
            >
              <For each={shown()} keyed={(product) => product.id}>
                {(product) => (
                  <Tile
                    product={product()}
                    quantity={cart[product().id] ?? 0}
                    onAdd={() => add(product(), 1)}
                  />
                )}
              </For>
            </div>
            <Show when={shown().length === 0}>
              <p class={css(muted, { px: "16px", py: "16px", textAlign: "center" })}>
                Ийм бараа алга
              </p>
            </Show>
          </section>

          <div
            class={css({
              position: "fixed",
              zIndex: 10,
              left: 0,
              right: 0,
              bottom: 0,
              bg: "surface",
              borderTop: "1px solid {colors.line}",
              px: "16px",
              pt: "10px",
              pb: "calc(env(safe-area-inset-bottom) + 14px)",
              display: "grid",
              gap: "10px",
            })}
          >
            <Show when={failed()}>
              <p class={css({ color: "owes", fontSize: "14px" })}>
                Хадгалж чадсангүй. Дахин оролдоно уу.
              </p>
            </Show>
            <Segmented
              options={[
                ["prepay", "Урьдчилж төлнө"],
                ["cod", "Хүргэлтээр төлнө"],
              ]}
              value={terms()}
              onChange={setTerms}
            />
            <button
              type="button"
              disabled={missing() !== undefined || busy()}
              onClick={() => place()}
              class={css(button, darkButton, bigButton, { width: "100%" })}
            >
              <Show when={missing()} fallback={`Захиалга үүсгэх · ${money(subtotal() + fee())}`}>
                {(why) => why()}
              </Show>
            </button>
          </div>
        </Loading>
      </Errored>
    </main>
  );
}

/** A product to tap into the cart, with how many are in it already. */
function Tile(props: { product: Product; quantity: number; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={() => props.onAdd()}
      class={css({
        width: "100%",
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: "6px",
        alignContent: "start",
        textAlign: "left",
        cursor: "pointer",
      })}
    >
      <span
        class={css(
          {
            position: "relative",
            display: "block",
            aspectRatio: "1",
            bg: "white",
            borderRadius: "14px",
            boxShadow: "hairline",
            p: "6px",
          },
          props.quantity > 0 && { boxShadow: "0 0 0 3px {colors.highlight}" },
        )}
      >
        <Show when={props.product.image}>
          {(src) => (
            <img
              src={src()}
              alt=""
              loading="lazy"
              class={css(
                { width: "100%", height: "100%", objectFit: "contain" },
                props.product.stock === 0 && { opacity: 0.4 },
              )}
            />
          )}
        </Show>
        <Show when={props.quantity > 0}>
          <span class={css(countBadge)}>×{props.quantity}</span>
        </Show>
      </span>
      <span>
        <span
          class={css({
            display: "block",
            fontSize: "14px",
            lineHeight: "18px",
            fontWeight: "600",
            lineClamp: 2,
          })}
        >
          {props.product.name}
        </span>
        <span
          class={css(muted, {
            display: "block",
            fontSize: "13px",
            lineHeight: "18px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          })}
        >
          {props.product.count} ш · {props.product.brand}
        </span>
        <b
          class={css(
            { display: "block", fontSize: "14px", lineHeight: "20px", fontWeight: "600" },
            props.product.stock === 0 && { color: "owes" },
          )}
        >
          {props.product.stock === 0 ? "Дууссан" : money(props.product.price)}
        </b>
      </span>
    </button>
  );
}
