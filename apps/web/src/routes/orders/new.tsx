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
import BankIcon from "~icons/ph/bank";
import ChatIcon from "~icons/ph/chat-circle";
import CoinsIcon from "~icons/ph/hand-coins";
import SearchIcon from "~icons/ph/magnifying-glass";
import MapPinIcon from "~icons/ph/map-pin";
import MinusIcon from "~icons/ph/minus-bold";
import NoteIcon from "~icons/ph/note-pencil";
import PhoneIcon from "~icons/ph/phone";
import PlusIcon from "~icons/ph/plus-bold";
import StoreIcon from "~icons/ph/storefront";

import { ApiClient } from "../../api/client";
import { runEffect, RuntimeContext } from "../../api/solid-effect";
import { Dock } from "../../chrome";
import { money } from "../../format";
import {
  act,
  button,
  headline,
  large,
  panel,
  Pill,
  press,
  Problem,
  searchBox,
  section,
  sectionHead,
  Segmented,
  sub,
  Tile,
  title3,
} from "../../ui";
import type { Icon } from "../../ui";

type Product = typeof ProductRow.Type;

const FEE = 6000;

const sources = [
  ["messenger_human", "Чат", ChatIcon],
  ["phone", "Утас", PhoneIcon],
  ["walk_in", "Дэлгүүр", StoreIcon],
] satisfies ReadonlyArray<readonly [OrderSource, string, Icon]>;

/** One line of the grouped contact fields: an icon, then the input. */
const fieldRow = css.raw({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minHeight: "56px",
  px: "16px",
  "& + &": { boxShadow: "inset 50px 0 0 {colors.surface}, inset 0 .5px 0 {colors.line}" },
  "& > svg": { fontSize: "21px", color: "inkMuted", flex: "none", width: "22px" },
  "& input, & textarea": {
    flex: 1,
    minWidth: 0,
    py: "16px",
    bg: "transparent",
    outline: "none",
    fontSize: "17px",
    lineHeight: "22px",
    color: "ink",
    resize: "none",
    _placeholder: { color: "#8a8277" },
  },
});

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
    <main class={css({ pb: "140px" })}>
      <header
        class={css({
          position: "sticky",
          top: 0,
          zIndex: 5,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          px: "14px",
          pt: "calc(env(safe-area-inset-top) + 8px)",
          pb: "8px",
          bg: "rgba(248,244,236,.9)",
          backdropFilter: "blur(22px) saturate(180%)",
        })}
      >
        <a
          href="/orders"
          class={css(press, {
            justifySelf: "start",
            height: "44px",
            px: "6px",
            display: "grid",
            placeItems: "center",
            fontSize: "17px",
            fontWeight: "600",
          })}
        >
          Болих
        </a>
        <b class={css(headline)}>Шинэ захиалга</b>
      </header>

      <div class={css({ px: "20px", pt: "12px" })}>
        <Segmented options={sources} value={source()} onChange={setSource} />

        <div class={css(panel, { mt: "16px", borderRadius: "20px", overflow: "hidden" })}>
          <label class={css(fieldRow)}>
            <PhoneIcon />
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
              class={css({
                fontWeight: "650",
                letterSpacing: "0.01em",
                fontVariantNumeric: "tabular-nums",
              })}
            />
            <Show when={history().length > 0}>
              <Pill tone="soft">{history().length + 1} дахь захиалга</Pill>
            </Show>
          </label>
          <Show when={!walkIn()}>
            <label class={css(fieldRow)}>
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
          <label class={css(fieldRow)}>
            <NoteIcon />
            <input
              aria-label="Тэмдэглэл"
              placeholder="Тэмдэглэл: орцны код, залгах"
              value={notes()}
              onInput={(event) => setNotes(event.currentTarget.value)}
            />
          </label>
        </div>
      </div>

      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<div class={css(panel, { m: "28px 16px", height: "320px" })} />}>
          <Show when={before().length > 0}>
            <section class={css(section, { mt: "28px" })}>
              <h2 class={css(title3, { mb: "10px" })}>Өмнө авсан</h2>
              <div
                class={css({
                  display: "flex",
                  gap: "10px",
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  mx: "-20px",
                  px: "20px",
                  pt: "4px",
                  pb: "8px",
                })}
              >
                <For each={before()} keyed={(product) => product.id}>
                  {(product) => (
                    <button
                      type="button"
                      onClick={() => add(product(), 1)}
                      class={css(press, panel, {
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        flex: "none",
                        p: "8px 10px 8px 8px",
                        borderRadius: "20px",
                        textAlign: "left",
                      })}
                    >
                      <Tile
                        product={product()}
                        size={48}
                        quantity={cart[product().id] || undefined}
                        ring="surface"
                        still
                      />
                      <span>
                        <span
                          class={css({
                            display: "block",
                            fontSize: "15px",
                            lineHeight: "19px",
                            fontWeight: "600",
                          })}
                        >
                          {product().name}
                        </span>
                        <span class={css(sub, { fontSize: "13px" })}>{money(product().price)}</span>
                      </span>
                      <span
                        class={css({
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          bg: "chip",
                          fontSize: "17px",
                        })}
                      >
                        <PlusIcon />
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </section>
          </Show>

          <section class={css(section, { mt: "22px" })}>
            <h2 class={css(title3)}>Бараа</h2>
            <label class={css(searchBox, { mt: "12px" })}>
              <SearchIcon />
              <input
                type="search"
                placeholder="Бараа хайх"
                value={query()}
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
            </label>
            <div
              class={css({
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "20px 12px",
                mt: "14px",
              })}
            >
              <For each={shown()} keyed={(product) => product.id}>
                {(product) => (
                  <button
                    type="button"
                    onClick={() => add(product(), 1)}
                    class={css(
                      {
                        display: "block",
                        minWidth: 0,
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "transform .5s {easings.spring}",
                        _active: { transform: "scale(.95)", transition: "transform .1s ease-out" },
                      },
                      product().stock === 0 && { opacity: 0.42 },
                    )}
                  >
                    <span
                      class={css(
                        {
                          display: "block",
                          borderRadius: "20px",
                          transition: "box-shadow .2s ease",
                        },
                        (cart[product().id] ?? 0) > 0 && {
                          boxShadow: "0 0 0 2.5px {colors.sel}, 0 8px 16px -10px rgba(15,76,92,.5)",
                        },
                      )}
                    >
                      <Tile product={product()} quantity={cart[product().id] || undefined} still />
                    </span>
                    <span
                      class={css({
                        display: "block",
                        mt: "9px",
                        minHeight: "38px",
                        fontSize: "15px",
                        lineHeight: "19px",
                        fontWeight: "600",
                        letterSpacing: "-0.01em",
                        lineClamp: 3,
                      })}
                    >
                      {product().name}
                    </span>
                    <span
                      class={css(sub, {
                        display: "block",
                        mt: "2px",
                        fontSize: "13px",
                        lineHeight: "17px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      })}
                    >
                      {product().count} ш · {product().brand}
                    </span>
                    <span
                      class={css({
                        display: "block",
                        mt: "3px",
                        fontSize: "15px",
                        fontWeight: "650",
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      {product().stock === 0 ? "Дууссан" : money(product().price)}
                    </span>
                  </button>
                )}
              </For>
            </div>
            <Show when={shown().length === 0}>
              <p class={css(sub, { py: "20px", textAlign: "center" })}>Ийм бараа алга</p>
            </Show>
          </section>

          <section class={css(section)}>
            <div class={css(sectionHead)}>
              <h2 class={css(title3)}>Сагс</h2>
            </div>
            <Show
              when={picked().length > 0}
              fallback={<p class={css(sub)}>Дээрээс бараа сонгоно уу</p>}
            >
              <div class={css({ display: "grid", gap: "14px" })}>
                <For each={picked()} keyed={(line) => line.product.id}>
                  {(line) => (
                    <div class={css({ display: "flex", alignItems: "center", gap: "12px" })}>
                      <Tile product={line().product} size={52} />
                      <div class={css({ flex: 1, minWidth: 0 })}>
                        <div class={css(headline, { fontSize: "16px" })}>{line().product.name}</div>
                        <div class={css(sub, { fontVariantNumeric: "tabular-nums" })}>
                          {money(line().product.price * line().quantity)}
                        </div>
                      </div>
                      <div
                        class={css({
                          display: "flex",
                          alignItems: "center",
                          flex: "none",
                          height: "44px",
                          borderRadius: "22px",
                          bg: "surface",
                          boxShadow: "raiseSm",
                          "& button": {
                            width: "44px",
                            height: "44px",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "18px",
                            cursor: "pointer",
                          },
                        })}
                      >
                        <button
                          type="button"
                          aria-label="Хасах"
                          onClick={() => add(line().product, -1)}
                        >
                          <MinusIcon />
                        </button>
                        <b
                          class={css({
                            minWidth: "18px",
                            textAlign: "center",
                            fontWeight: "700",
                            fontVariantNumeric: "tabular-nums",
                          })}
                        >
                          {line().quantity}
                        </b>
                        <button
                          type="button"
                          aria-label="Нэмэх"
                          onClick={() => add(line().product, 1)}
                        >
                          <PlusIcon />
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
              <div
                class={css({ mt: "18px", color: "inkMuted", fontVariantNumeric: "tabular-nums" })}
              >
                <div class={css({ display: "flex", justifyContent: "space-between", py: "5px" })}>
                  <span>Бараа</span>
                  <span class={css({ color: "ink", fontWeight: "600" })}>{money(subtotal())}</span>
                </div>
                <div class={css({ display: "flex", justifyContent: "space-between", py: "5px" })}>
                  <span>{walkIn() ? "Хүргэлтгүй" : "Хүргэлт"}</span>
                  <span class={css({ color: "ink", fontWeight: "600" })}>{money(fee())}</span>
                </div>
              </div>
            </Show>
          </section>

          <section class={css(section, { mt: "26px" })}>
            <h2 class={css(title3, { mb: "10px" })}>Төлбөр</h2>
            <Segmented
              options={[
                ["prepay", "Урьдчилсан", BankIcon],
                ["cod", "Хүргэлтээр", CoinsIcon],
              ]}
              value={terms()}
              onChange={setTerms}
            />
          </section>

          <Dock>
            <Show when={failed()}>
              <p class={css({ color: "owes", fontSize: "15px", textAlign: "center" })}>
                Хадгалж чадсангүй. Дахин оролдоно уу.
              </p>
            </Show>
            <button
              type="button"
              disabled={missing() !== undefined || busy()}
              onClick={() => place()}
              class={css(button, act, large, { width: "100%" })}
            >
              <Show when={missing()} fallback={`Захиалга үүсгэх · ${money(subtotal() + fee())}`}>
                {(why) => why()}
              </Show>
            </button>
          </Dock>
        </Loading>
      </Errored>
    </main>
  );
}
