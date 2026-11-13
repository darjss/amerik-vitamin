import { stockLevel } from "@amerik/contracts";
import type { ProductRow } from "@amerik/contracts";
import { useLocation, useSearchParams } from "@solidjs/router";
import { createMemo, createSignal, Errored, For, Loading, Show } from "solid-js";
import { css } from "styled-system/css";
import ArchiveIcon from "~icons/ph/archive";
import CheckIcon from "~icons/ph/check-bold";
import CopyIcon from "~icons/ph/copy-bold";
import MoreIcon from "~icons/ph/dots-three-bold";
import FunnelIcon from "~icons/ph/funnel-simple-bold";
import HashIcon from "~icons/ph/hash";
import InfoIcon from "~icons/ph/info";
import SearchIcon from "~icons/ph/magnifying-glass";
import PackageIcon from "~icons/ph/package";
import PlusIcon from "~icons/ph/plus-bold";
import BagIcon from "~icons/ph/shopping-bag-open";
import TagIcon from "~icons/ph/tag";

import { ApiClient } from "../../api/client";
import { createWrite, runEffect } from "../../api/solid-effect";
import { matches, money } from "../../format";
import { Tile } from "../../photos";
import { NumberSheet, StockSheet, stockText, stockTone } from "../../products";
import type { StockMode } from "../../products";
import { press, round } from "../../styles";
import {
  appear,
  createCopied,
  Failed,
  hairline,
  oneLine,
  panel,
  Problem,
  searchBox,
  Sheet,
  sheetRow,
  sub,
  tones,
  top,
} from "../../ui";
import { copyText, formText } from "../../words";
import { ListSkeleton } from "../../skeletons";
import { StickyBar, Tab, TabBar, Tabs } from "../../bars";

/** The stock views, keyed by stock level, then the archive. */
const views = [
  { key: "all", label: "Бүгд", tone: undefined },
  { key: "out", label: "Дууссан", tone: "owe" },
  { key: "low", label: "Дуусаж байна", tone: "wait" },
  { key: "unknown", label: "Тоолоогүй", tone: undefined },
  { key: "archived", label: "Архив", tone: undefined },
] as const;

type View = (typeof views)[number]["key"];

const inView = (view: View, product: ProductRow) =>
  view === "archived"
    ? product.archivedAt !== null
    : product.archivedAt === null && (view === "all" || stockLevel(product.stock) === view);

/** The price and stock buttons on a row: compact, tinted by what they hold. */
const rowButton = css.raw(press, {
  position: "relative",
  zIndex: 1,
  display: "inline-grid",
  placeItems: "center",
  flex: "none",
  height: "32px",
  px: "10px",
  borderRadius: "9px",
  textStyle: "subhead",
  fontWeight: "650",
  fontVariantNumeric: "tabular-nums",
});

export default function Products() {
  const products = createMemo(() => runEffect(ApiClient.use((api) => api.listProducts())));
  // In the URL, so coming back from a product keeps the filters.
  const [params, setParams] = useSearchParams<{ view?: string; brand?: string; q?: string }>();
  const location = useLocation();
  const [stocking, setStocking] = createSignal<ProductRow>();
  const [stockMode, setStockMode] = createSignal<StockMode>("count");
  const [pricing, setPricing] = createSignal<ProductRow>();
  const [acting, setActing] = createSignal<ProductRow>();
  const [picking, setPicking] = createSignal(false);
  const { write, busy, failed, setFailed } = createWrite({ source: products });

  const view = () => views.find((candidate) => candidate.key === params.view)?.key ?? "all";

  const ofBrand = (product: ProductRow) =>
    params.brand === undefined || product.brand === params.brand;

  // Each filter counts what the other filters leave.
  const searched = createMemo(() =>
    products().filter((product) => matches(product, params.q ?? "")),
  );

  const counts = createMemo(() =>
    Object.fromEntries(
      views.map(({ key }) => [
        key,
        searched().filter((product) => ofBrand(product) && inView(key, product)).length,
      ]),
    ),
  );

  // The list comes sorted by brand. A selected brand stays at 0, so an empty list still says why.
  const brands = createMemo(() => {
    const tally = [
      ...Map.groupBy(
        searched().filter((product) => inView(view(), product)),
        (product) => product.brand,
      ),
    ].map(([name, list]) => ({ name, count: list.length }));

    const selected = params.brand;

    return selected === undefined || tally.some((brand) => brand.name === selected)
      ? tally
      : [...tally, { name: selected, count: 0 }];
  });

  const shown = createMemo(() =>
    searched().filter((product) => inView(view(), product) && ofBrand(product)),
  );

  const viewHref = (key: View) => {
    const next = new URLSearchParams(location.search);

    if (key === "all") next.delete("view");
    else next.set("view", key);

    return next.size === 0 ? "/products" : `/products?${next}`;
  };

  // The product page's ‹ comes back here with the same filters.
  const back = () => JSON.stringify({ back: `/products${location.search}` });

  const close = () => {
    setStocking(undefined);
    setPricing(undefined);
    setActing(undefined);
  };

  const openStock = (product: ProductRow, mode: StockMode = "count") => {
    close();
    setFailed(undefined);
    setStockMode(mode);
    setStocking(product);
  };

  const openPrice = (product: ProductRow) => {
    close();
    setFailed(undefined);
    setPricing(product);
  };

  const openActions = (product: ProductRow) => {
    setFailed(undefined);
    setActing(product);
  };

  return (
    <main class={css(top, { maxWidth: "640px", mx: "auto", px: "16px", pb: "104px" })}>
      <header class={css({ display: "flex", alignItems: "center", gap: "10px", pb: "10px" })}>
        <h1 class={css({ flex: 1, textStyle: "title" })}>Бараа</h1>
        <a href="/products/new" aria-label="Шинэ бараа" class={round({ tone: "butter" })}>
          <PlusIcon />
        </a>
      </header>

      <StickyBar>
        <div class={css({ display: "flex", gap: "8px" })}>
          <label class={css(searchBox, { flex: 1, minWidth: 0 })}>
            <SearchIcon />
            <input
              type="search"
              placeholder="Нэр эсвэл брэнд"
              value={params.q ?? ""}
              onInput={(event) =>
                setParams({ q: event.currentTarget.value || undefined }, { replace: true })
              }
            />
          </label>
          <button
            type="button"
            onClick={() => setPicking(true)}
            class={css(
              press,
              {
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                flex: "none",
                maxWidth: "45%",
                height: "42px",
                px: "12px",
                borderRadius: "12px",
                bg: "fill",
                textStyle: "subhead",
                fontWeight: "600",
                "& svg": { flex: "none", fontSize: "17px" },
              },
              params.brand !== undefined && { bg: "ink", color: "page" },
            )}
          >
            <FunnelIcon />
            <span class={css(oneLine)}>{params.brand ?? "Брэнд"}</span>
          </button>
        </div>

        <Tabs current={view()}>
          <For each={views}>
            {(candidate) => (
              <Tab
                href={viewHref(candidate.key)}
                current={view() === candidate.key}
                label={candidate.label}
                count={counts()[candidate.key]}
                tone={candidate.tone}
              />
            )}
          </For>
        </Tabs>
      </StickyBar>

      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<ListSkeleton />}>
          <div class={css(appear, { pt: "12px" })}>
            <Show
              when={shown().length > 0}
              fallback={
                <p class={css(sub, { py: "48px", textAlign: "center" })}>Бараа олдсонгүй</p>
              }
            >
              <div class={css(panel)}>
                <For each={shown()} keyed={(product) => product.id}>
                  {(product) => (
                    <Row
                      product={product()}
                      back={back()}
                      onPrice={() => openPrice(product())}
                      onStock={() => openStock(product())}
                      onMore={() => openActions(product())}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Loading>
      </Errored>

      <Sheet open={picking()} title="Брэнд" onClose={() => setPicking(false)}>
        <Loading fallback={null}>
          <div class={css(panel)}>
            <For
              each={[
                {
                  name: undefined,
                  count: brands().reduce((sum, brand) => sum + brand.count, 0),
                },
                ...brands(),
              ]}
            >
              {(brand) => (
                <button
                  type="button"
                  onClick={() => {
                    setParams({ brand: brand.name });
                    setPicking(false);
                  }}
                  class={css(sheetRow)}
                >
                  <span class={css(oneLine, { flex: 1 })}>{brand.name ?? "Бүх брэнд"}</span>
                  <span class={css(sub, { fontVariantNumeric: "tabular-nums" })}>
                    {brand.count}
                  </span>
                  <span class={css({ width: "20px", display: "grid", placeItems: "center" })}>
                    <Show when={params.brand === brand.name}>
                      <CheckIcon />
                    </Show>
                  </span>
                </button>
              )}
            </For>
          </div>
        </Loading>
      </Sheet>

      <ActionsSheet
        product={acting()}
        busy={busy()}
        failed={failed()}
        onClose={() => setActing(undefined)}
        onStock={openStock}
        onPrice={openPrice}
        onArchive={(product) => {
          const productId = product.id;
          const archived = product.archivedAt === null;

          void write(
            ApiClient.use((api) => api.archiveProduct({ productId, archived })),
            close,
          );
        }}
      />
      <StockSheet
        product={stocking()}
        mode={stockMode()}
        busy={busy()}
        failed={failed()}
        onClose={close}
        onCount={(counted) => {
          const product = stocking();

          if (product !== undefined) {
            void write(
              ApiClient.use((api) => api.countStock({ productId: product.id, counted })),
              close,
            );
          }
        }}
        onReceive={(received) => {
          const product = stocking();

          if (product !== undefined) {
            void write(
              ApiClient.use((api) => api.receiveStock({ productId: product.id, received })),
              close,
            );
          }
        }}
      />
      <NumberSheet
        open={pricing() !== undefined}
        title={pricing()?.nameMn ?? ""}
        prompt={`Одоо ${money(pricing()?.price ?? 0)}. Хуучин захиалгын үнэ өөрчлөгдөхгүй.`}
        start={pricing()?.price ?? 0}
        price
        busy={busy()}
        failed={failed()}
        onClose={close}
        onSave={(price) => {
          const product = pricing();

          if (product !== undefined) {
            void write(
              ApiClient.use((api) => api.setPrice({ productId: product.id, price })),
              close,
            );
          }
        }}
      />
      <TabBar />
    </main>
  );
}

/**
 * One product: the photo big enough to tell look-alike bottles apart, the
 * Mongolian name, brand · count · form, then the price and stock buttons and ⋯.
 */
function Row(props: {
  product: ProductRow;
  back: string;
  onPrice: () => void;
  onStock: () => void;
  onMore: () => void;
}) {
  return (
    <div
      class={css(hairline, {
        display: "flex",
        gap: "12px",
        px: "12px",
        py: "8px",
        bg: "card",
        transition: "background-color 120ms ease",
        "&:has(> a:active)": { bg: "fill" },
      })}
    >
      {/* The whole row opens the product; the photo and buttons sit above it. */}
      <a
        href={`/products/${props.product.id}`}
        state={props.back}
        aria-label={props.product.nameMn}
        class={css({ position: "absolute", inset: 0 })}
      />
      <Tile product={props.product} size={76} />
      <div class={css({ flex: 1, minWidth: 0 })}>
        <div class={css({ textStyle: "subhead", fontWeight: "600", lineClamp: 2 })}>
          {props.product.nameMn}
        </div>
        <div class={css(oneLine, { mt: "2px", textStyle: "footnote", color: "inkMuted" })}>
          {props.product.brand} · {props.product.count} ш · {formText[props.product.form]}
        </div>
        <div class={css({ display: "flex", alignItems: "center", gap: "6px", mt: "6px" })}>
          <button
            type="button"
            aria-label={`${props.product.nameMn} үнэ өөрчлөх`}
            onClick={() => props.onPrice()}
            class={css(rowButton, { bg: "fill" })}
          >
            {money(props.product.price)}
          </button>
          <button
            type="button"
            aria-label={`${props.product.nameMn} үлдэгдэл`}
            onClick={() => props.onStock()}
            class={css(
              rowButton,
              { minWidth: "52px" },
              tones[stockTone[stockLevel(props.product.stock)]],
            )}
          >
            {stockText(props.product.stock)}
          </button>
          <button
            type="button"
            aria-label={`${props.product.nameMn} үйлдэл`}
            onClick={() => props.onMore()}
            class={css(rowButton, {
              ml: "auto",
              width: "36px",
              px: 0,
              color: "inkMuted",
              fontSize: "20px",
            })}
          >
            <MoreIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionsSheet(props: {
  product: ProductRow | undefined;
  busy: boolean;
  failed: string | undefined;
  onClose: () => void;
  onStock: (product: ProductRow, mode: StockMode) => void;
  onPrice: (product: ProductRow) => void;
  onArchive: (product: ProductRow) => void;
}) {
  const { copied, copy } = createCopied();

  return (
    <Sheet
      open={props.product !== undefined}
      title={props.product?.nameMn ?? ""}
      onClose={props.onClose}
    >
      <Show when={props.product}>
        {(product) => (
          <div class={css({ display: "grid", gap: "16px" })}>
            <div class={css(panel)}>
              <Show when={product().archivedAt === null}>
                <a href={`/orders/new?add=${product().id}`} class={css(sheetRow)}>
                  <BagIcon />
                  Захиалга үүсгэх
                </a>
              </Show>
              <button
                type="button"
                class={css(sheetRow)}
                onClick={() => props.onStock(product(), "receive")}
              >
                <PackageIcon />
                Ирсэн бараа нэмэх
              </button>
              <button
                type="button"
                class={css(sheetRow)}
                onClick={() => props.onStock(product(), "count")}
              >
                <HashIcon />
                Тоолох
              </button>
              <button type="button" class={css(sheetRow)} onClick={() => props.onPrice(product())}>
                <TagIcon />
                Үнэ өөрчлөх
              </button>
              <button
                type="button"
                class={css(sheetRow, copied() === "copied" && { color: "ok" })}
                onClick={() =>
                  void copy(`${product().brand} ${product().name}\n${money(product().price)}`)
                }
              >
                <CopyIcon />
                {copyText[copied() ?? "idle"]}
              </button>
              <a href={`/products/${product().id}`} class={css(sheetRow)}>
                <InfoIcon />
                Дэлгэрэнгүй
              </a>
            </div>
            <div>
              <Failed text={props.failed} />
              <div class={css(panel)}>
                <button
                  type="button"
                  disabled={props.busy}
                  class={css(sheetRow, product().archivedAt === null && { color: "owe" })}
                  onClick={() => props.onArchive(product())}
                >
                  <ArchiveIcon />
                  {product().archivedAt === null ? "Архивлах" : "Сэргээх"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </Sheet>
  );
}
