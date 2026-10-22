import { ProductId } from "@amerik/contracts";
import type { OrderSource, PaymentTerms, PlaceOrder, ProductRow } from "@amerik/contracts";
import { useNavigate, useSearchParams } from "@solidjs/router";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  createMemo,
  createSignal,
  createStore,
  Errored,
  For,
  latest,
  Loading,
  Show,
  untrack,
} from "solid-js";
import { css } from "styled-system/css";
import BankIcon from "~icons/ph/bank";
import ChatIcon from "~icons/ph/chat-circle";
import CoinsIcon from "~icons/ph/hand-coins";
import SearchIcon from "~icons/ph/magnifying-glass";
import MapPinIcon from "~icons/ph/map-pin";
import NoteIcon from "~icons/ph/note-pencil";
import PhoneIcon from "~icons/ph/phone";
import PlusIcon from "~icons/ph/plus-bold";
import StoreIcon from "~icons/ph/storefront";

import { ApiClient } from "../../api/client";
import { createWrite, runEffect } from "../../api/solid-effect";
import { Cart } from "../../cart";
import { digits, matches, money } from "../../format";
import { Tile } from "../../photos";
import { GridSkeleton } from "../../skeletons";
import { press } from "../../styles";
import {
  appear,
  Dock,
  glassBar,
  panel,
  Pill,
  Problem,
  SaveButton,
  searchBox,
  section,
  Segmented,
  spinner,
  sub,
} from "../../ui";
import type { Icon } from "../../ui";
import { sourceText } from "../../words";

const FEE = 6000;

const sources = [
  ["messenger_human", sourceText.messenger_human, ChatIcon],
  ["phone", sourceText.phone, PhoneIcon],
  ["walk_in", sourceText.walk_in, StoreIcon],
] satisfies ReadonlyArray<readonly [OrderSource, string, Icon]>;

type Quantities = Record<ProductId, number>;

/**
 * An order she writes by hand from a chat, a call or the counter (PRODUCT.md,
 * Features 9). A known phone fills in the last address and shows what it
 * bought before, one tap to add again.
 */
export default function NewOrder() {
  const products = createMemo(() => runEffect(ApiClient.use((api) => api.listProducts())));
  const navigate = useNavigate();

  const [phone, setPhone] = createSignal("");
  const [typedAddress, setAddress] = createSignal<string>();
  const [notes, setNotes] = createSignal("");
  const [source, setSource] = createSignal<OrderSource>("messenger_human");
  const [terms, setTerms] = createSignal<PaymentTerms>("prepay");
  const [query, setQuery] = createSignal("");
  const [params] = useSearchParams<{ add?: string }>();

  // The product page's Захиалах opens here with that product already in the cart.
  const added = untrack(() =>
    Option.getOrUndefined(Schema.decodeUnknownOption(ProductId)(params.add)),
  );

  const [cart, setCart] = createStore<Quantities>(added === undefined ? {} : { [added]: 1 });

  const { write, busy, failed } = createWrite({
    fallback: "Хадгалж чадсангүй. Дахин оролдоно уу.",
  });

  // A full phone looks up the customer: how many orders, and the last address.
  const customer = createMemo(() => {
    const typed = phone();

    return runEffect(
      Effect.gen(function* () {
        if (typed.length !== 8) return undefined;

        const api = yield* ApiClient;

        return yield* api.findCustomer({ phone: typed }).pipe(
          // A new phone has no customer yet; any other failure reaches Errored.
          Effect.catchTag("CustomerNotFound", () => Effect.succeed(undefined)),
        );
      }),
    );
  });

  const pastOrders = createMemo(() => {
    const typed = phone();

    return runEffect(
      Effect.gen(function* () {
        if (typed.length !== 8) return [];

        const api = yield* ApiClient;

        return yield* api.listOrders({ phone: typed });
      }),
    );
  });

  const address = () => typedAddress() ?? customer()?.address ?? "";
  const walkIn = () => source() === "walk_in";
  const fee = () => (walkIn() ? 0 : FEE);
  const live = () => products().filter((product) => product.archivedAt === null);

  const picked = () =>
    live().flatMap((product) => {
      const quantity = cart[product.id] ?? 0;

      return quantity > 0 ? [{ product, quantity }] : [];
    });

  const shown = createMemo(() =>
    live()
      .filter((product) => matches(product, query()))
      .toSorted((a, b) => Number(a.stock === 0) - Number(b.stock === 0)),
  );

  const before = () => {
    const ids = new Set(pastOrders().flatMap((order) => order.lines.map((line) => line.productId)));

    return live().filter((product) => ids.has(product.id));
  };

  const subtotal = () =>
    picked().reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  const add = (product: ProductRow, change: number) =>
    setCart((draft) => {
      draft[product.id] = Math.max(0, (draft[product.id] ?? 0) + change);
    });

  const missing = () => {
    if (picked().length === 0) return "Бараа сонгоно уу";

    return walkIn() || phone().length === 8 ? undefined : "Утасны дугаар оруулна уу";
  };

  const place = () => {
    const lines = picked().map(({ product, quantity }) => ({ productId: product.id, quantity }));

    if (!Arr.isArrayNonEmpty(lines)) return;

    const input = {
      phone: phone().length === 8 ? phone() : undefined,
      // The prefilled address may still be loading; send what she sees.
      address: latest(address).trim() || undefined,
      notes: notes().trim() || undefined,
      source: source(),
      terms: terms(),
      fulfillment: walkIn() ? "in_store" : "courier",
      deliveryFee: fee(),
      lines,
    } satisfies PlaceOrder;

    void write(
      ApiClient.use((api) => api.placeOrder(input)),
      (placed) => navigate(`/orders/${placed.orderId}`, { replace: true }),
    );
  };

  return (
    <main class={css({ pb: "140px" })}>
      <header
        class={css(glassBar, {
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
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
            textStyle: "body",
            fontWeight: "600",
          })}
        >
          Болих
        </a>
        <b class={css({ textStyle: "headline" })}>Шинэ захиалга</b>
      </header>

      {/* A failed customer lookup lands here too, not in a quiet empty pill. */}
      <Errored fallback={(error) => <Problem error={error()} />}>
        <div class={css({ px: "20px", pt: "12px" })}>
          <Segmented options={sources} value={source()} onChange={setSource} />
          <ContactFields
            walkIn={walkIn()}
            phone={phone()}
            address={address()}
            notes={notes()}
            orders={customer()?.orders}
            onPhone={setPhone}
            onAddress={setAddress}
            onNotes={setNotes}
          />
        </div>

        <Loading fallback={<GridSkeleton />}>
          <div class={css(appear)}>
            <Loading on={phone()} fallback={null}>
              <PastBuys products={before()} cart={cart} onAdd={(product) => add(product, 1)} />
            </Loading>

            <ProductGrid
              products={shown()}
              cart={cart}
              query={query()}
              onQuery={setQuery}
              onAdd={(product) => add(product, 1)}
            />

            <Cart
              lines={picked()}
              subtotal={subtotal()}
              fee={fee()}
              walkIn={walkIn()}
              onAdd={add}
            />

            <section class={css(section, { mt: "26px" })}>
              <h2 class={css({ textStyle: "title3", mb: "10px" })}>Төлбөр</h2>
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
              <SaveButton
                failed={failed()}
                disabled={missing() !== undefined || busy()}
                onClick={place}
              >
                {missing() ?? `Захиалга үүсгэх · ${money(subtotal() + fee())}`}
              </SaveButton>
            </Dock>
          </div>
        </Loading>
      </Errored>
    </main>
  );
}

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
    textStyle: "body",
    color: "ink",
    resize: "none",
    _placeholder: { color: "inkFaint" },
  },
});

/** Phone, address and note. `address` and `orders` read the phone's lookup. */
function ContactFields(props: {
  walkIn: boolean;
  phone: string;
  address: string;
  notes: string;
  orders: number | undefined;
  onPhone: (phone: string) => void;
  onAddress: (address: string) => void;
  onNotes: (notes: string) => void;
}) {
  return (
    <div class={css(panel, { mt: "16px", borderRadius: "20px", overflow: "hidden" })}>
      <label class={css(fieldRow)}>
        <PhoneIcon />
        <input
          inputmode="numeric"
          autocomplete="off"
          aria-label="Утас"
          placeholder={props.walkIn ? "Утас, заавал биш" : "Утас"}
          value={props.phone}
          onInput={(event) => props.onPhone(digits(event.currentTarget.value).slice(-8))}
          class={css({
            fontWeight: "650",
            letterSpacing: "0.01em",
            fontVariantNumeric: "tabular-nums",
          })}
        />
        {/* A new phone shows the spinner, not the last phone's customer, until its lookup lands. */}
        <Loading
          on={props.phone}
          fallback={
            <span aria-label="Хайж байна" class={css(spinner, { width: "18px", height: "18px" })} />
          }
        >
          <Show when={props.orders}>
            {(orders) => <Pill tone="soft">{orders() + 1} дахь захиалга</Pill>}
          </Show>
        </Loading>
      </label>
      <Show when={!props.walkIn}>
        <label class={css(fieldRow)}>
          <MapPinIcon />
          <Loading
            on={props.phone}
            fallback={<span class={css(sub, { flex: 1, py: "2px" })}>Хаяг хайж байна…</span>}
          >
            <textarea
              rows={2}
              aria-label="Хаяг"
              placeholder="Хаяг"
              value={props.address}
              onInput={(event) => props.onAddress(event.currentTarget.value)}
            />
          </Loading>
        </label>
      </Show>
      <label class={css(fieldRow)}>
        <NoteIcon />
        <input
          aria-label="Тэмдэглэл"
          placeholder="Тэмдэглэл: орцны код, залгах"
          value={props.notes}
          onInput={(event) => props.onNotes(event.currentTarget.value)}
        />
      </label>
    </div>
  );
}

function PastBuys(props: {
  products: ReadonlyArray<ProductRow>;
  cart: Quantities;
  onAdd: (product: ProductRow) => void;
}) {
  return (
    <Show when={props.products.length > 0}>
      <section class={css(section, { mt: "28px" })}>
        <h2 class={css({ textStyle: "title3", mb: "10px" })}>Өмнө авсан</h2>
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
          <For each={props.products} keyed={(product) => product.id}>
            {(product) => (
              <button
                type="button"
                onClick={() => props.onAdd(product())}
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
                  quantity={props.cart[product().id] || undefined}
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
  );
}

function ProductGrid(props: {
  products: ReadonlyArray<ProductRow>;
  cart: Quantities;
  query: string;
  onQuery: (query: string) => void;
  onAdd: (product: ProductRow) => void;
}) {
  return (
    <section class={css(section, { mt: "22px" })}>
      <h2 class={css({ textStyle: "title3" })}>Бараа</h2>
      <label class={css(searchBox, { mt: "12px" })}>
        <SearchIcon />
        <input
          type="search"
          placeholder="Бараа хайх"
          value={props.query}
          onInput={(event) => props.onQuery(event.currentTarget.value)}
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
        <For each={props.products} keyed={(product) => product.id}>
          {(product) => (
            <button
              type="button"
              onClick={() => props.onAdd(product())}
              class={css(
                {
                  display: "block",
                  minWidth: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "transform .5s {easings.spring}",
                  _active: {
                    transform: "scale(.95)",
                    transition: "transform .1s ease-out",
                  },
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
                  (props.cart[product().id] ?? 0) > 0 && {
                    boxShadow: "0 0 0 2.5px {colors.sel}, 0 8px 16px -10px {colors.sel/50}",
                  },
                )}
              >
                <Tile product={product()} quantity={props.cart[product().id] || undefined} still />
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
                  textStyle: "footnote",
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
                  textStyle: "subhead",
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
      <Show when={props.products.length === 0}>
        <p class={css(sub, { py: "20px", textAlign: "center" })}>Ийм бараа алга</p>
      </Show>
    </section>
  );
}
