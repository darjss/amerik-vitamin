import type { OrderSource, ProductId, ProductRow } from "@amerik/contracts";
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
import CloseIcon from "~icons/ph/x";
import MinusIcon from "~icons/ph/minus-bold";
import PlusIcon from "~icons/ph/plus-bold";
import SearchIcon from "~icons/ph/magnifying-glass";

import { ApiClient } from "../../api/client";
import { runEffect, RuntimeContext } from "../../api/solid-effect";
import { money } from "../../format";
import {
  bigButton,
  block,
  blockTitle,
  button,
  darkButton,
  field,
  muted,
  Photo,
  Problem,
  top,
} from "../../ui";

type Product = typeof ProductRow.Type;

const FEE = 6000;

const sources = [
  { key: "messenger_human", label: "Чат" },
  { key: "phone", label: "Утас" },
  { key: "walk_in", label: "Дэлгүүр" },
] satisfies ReadonlyArray<{ key: OrderSource; label: string }>;

const choice = css.raw({ flex: 1 });

const chosen = css.raw({ bg: "clay", color: "white" });

const label = css.raw({ display: "block", fontSize: "14px", color: "inkMuted", pb: "6px" });

const stepper = css.raw({ width: "40px", height: "40px", px: 0, borderRadius: "50%" });

/**
 * An order she writes by hand from a chat, a call or the counter (PRODUCT.md,
 * Features 9). A known phone fills in the last address.
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
  const [known, setKnown] = createSignal<{ orders: number; address: string | null }>();
  const [busy, setBusy] = createOptimistic(false);
  const [failed, setFailed] = createSignal(false);

  const walkIn = () => source() === "walk_in";
  const fee = () => (walkIn() ? 0 : FEE);

  const picked = () =>
    products().flatMap((product) => {
      const quantity = cart[product.id] ?? 0;

      return quantity > 0 ? [{ product, quantity }] : [];
    });

  const found = () => {
    const words = query().trim().toLowerCase();

    if (words.length < 2) return [];

    return products()
      .filter(
        (product) =>
          product.archivedAt === null &&
          `${product.brand} ${product.name}`.toLowerCase().includes(words),
      )
      .slice(0, 6);
  };

  const total = () =>
    picked().reduce((sum, line) => sum + line.product.price * line.quantity, fee());

  const add = (product: Product, change: number) =>
    setCart((draft) => {
      draft[product.id] = Math.max(0, (draft[product.id] ?? 0) + change);
    });

  const lookUp = (digits: string) => {
    setKnown(undefined);

    if (digits.length !== 8) return;

    void runtime
      .runPromise(
        ApiClient.use((api) => api.findCustomer({ phone: digits })).pipe(
          Effect.orElseSucceed(() => undefined),
        ),
      )
      .then((customer) => {
        if (customer === undefined) return;

        setKnown({ orders: customer.orders, address: customer.address });

        if (address() === "" && customer.address !== null) setAddress(customer.address);
      });
  };

  const ready = () => picked().length > 0 && (walkIn() || phone().length === 8);

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
    <main class={css(top, { pb: "130px" })}>
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

      <section class={css(block, { px: "16px", py: "14px", display: "grid", gap: "14px" })}>
        <div class={css({ display: "flex", gap: "8px" })}>
          <For each={sources}>
            {(option) => (
              <button
                type="button"
                onClick={() => setSource(option.key)}
                class={css(button, choice, source() === option.key && chosen)}
              >
                {option.label}
              </button>
            )}
          </For>
        </div>

        <label>
          <span class={css(label)}>Утас</span>
          <input
            inputmode="numeric"
            autocomplete="off"
            placeholder="8 оронтой"
            value={phone()}
            onInput={(event) => {
              const digits = event.currentTarget.value.replaceAll(/\D/gu, "").slice(-8);
              setPhone(digits);
              lookUp(digits);
            }}
            class={css(field, { fontSize: "20px", fontWeight: "600", letterSpacing: "0.5px" })}
          />
          <Show when={known()}>
            {(customer) => (
              <small class={css({ display: "block", fontSize: "14px", color: "clay", pt: "6px" })}>
                Өмнө {customer().orders} захиалга өгсөн
                {customer().address === null ? "" : ". Хаягийг нь бөглөлөө."}
              </small>
            )}
          </Show>
        </label>

        <Show when={!walkIn()}>
          <label>
            <span class={css(label)}>Хаяг</span>
            <textarea
              rows={2}
              value={address()}
              onInput={(event) => setAddress(event.currentTarget.value)}
              class={css(field, { resize: "none" })}
            />
          </label>
        </Show>

        <label>
          <span class={css(label)}>Тэмдэглэл</span>
          <input
            placeholder="Орцны код, хэзээ хүргэх"
            value={notes()}
            onInput={(event) => setNotes(event.currentTarget.value)}
            class={css(field)}
          />
        </label>

        <div class={css({ display: "flex", gap: "8px" })}>
          <button
            type="button"
            onClick={() => setTerms("prepay")}
            class={css(button, choice, terms() === "prepay" && chosen)}
          >
            Урьдчилж төлнө
          </button>
          <button
            type="button"
            onClick={() => setTerms("cod")}
            class={css(button, choice, terms() === "cod" && chosen)}
          >
            Хүргэлтээр төлнө
          </button>
        </div>
      </section>

      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(block, { height: "200px" })} />}>
          <section class={css(block)}>
            <h2 class={css(blockTitle)}>Бараа</h2>
            <div class={css({ px: "16px", pb: "12px" })}>
              <label
                class={css({
                  height: "44px",
                  borderRadius: "12px",
                  bg: "chip",
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

            <For each={found()} keyed={(product) => product.id}>
              {(product) => (
                <button
                  type="button"
                  onClick={() => {
                    add(product(), 1);
                    setQuery("");
                  }}
                  class={css({
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    px: "16px",
                    py: "8px",
                    textAlign: "left",
                    cursor: "pointer",
                    borderTop: "1px solid {colors.line}",
                  })}
                >
                  <Photo product={product()} size={48} />
                  <span class={css({ flex: 1, minWidth: 0 })}>
                    <span class={css({ display: "block", fontSize: "16px", fontWeight: "600" })}>
                      {product().name}
                    </span>
                    <span class={css(muted, { display: "block", fontSize: "14px" })}>
                      {product().brand} · {product().count} ш · {money(product().price)}
                    </span>
                  </span>
                  <span
                    class={css(
                      muted,
                      { fontSize: "14px", whiteSpace: "nowrap" },
                      product().stock === 0 && { color: "owes" },
                    )}
                  >
                    {product().stock === null ? "" : `${product().stock} үлдсэн`}
                  </span>
                </button>
              )}
            </For>

            <For each={picked()} keyed={(line) => line.product.id}>
              {(line) => (
                <div
                  class={css({
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    px: "16px",
                    py: "10px",
                    borderTop: "1px solid {colors.line}",
                  })}
                >
                  <Photo product={line().product} size={56} />
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
            })}
          >
            <Show when={failed()}>
              <p class={css({ color: "owes", fontSize: "14px", pb: "8px" })}>
                Хадгалж чадсангүй. Дахин оролдоно уу.
              </p>
            </Show>
            <Show when={fee() > 0 && picked().length > 0}>
              <p class={css(muted, { fontSize: "14px", pb: "8px", textAlign: "center" })}>
                Хүргэлт {money(fee())} нэмэгдсэн
              </p>
            </Show>
            <button
              type="button"
              disabled={!ready() || busy()}
              onClick={() => place()}
              class={css(button, darkButton, bigButton, { width: "100%" })}
            >
              <Show when={picked().length > 0} fallback="Бараа нэмнэ үү">
                Захиалга үүсгэх · {money(total())}
              </Show>
            </button>
          </div>
        </Loading>
      </Errored>
    </main>
  );
}
