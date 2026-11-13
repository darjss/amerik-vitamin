import { ProductId, stockLevel } from "@amerik/contracts";
import type { ProductDetail, ProductLabel, StockMove } from "@amerik/contracts";
import { useLocation, useParams } from "@solidjs/router";
import * as DateTime from "effect/DateTime";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import { createMemo, createSignal, Errored, For, Loading, Show, useContext } from "solid-js";
import { css } from "styled-system/css";
import ArchiveIcon from "~icons/ph/archive";
import CaretRightIcon from "~icons/ph/caret-right-bold";
import CopyIcon from "~icons/ph/copy-bold";
import HashIcon from "~icons/ph/hash";
import PackageIcon from "~icons/ph/package";
import BagIcon from "~icons/ph/shopping-bag-open";
import TagIcon from "~icons/ph/tag";

import { ApiClient } from "../../api/client";
import { createWrite, runEffect } from "../../api/solid-effect";
import { NavBar } from "../../bars";
import { money, sized, srcset, when } from "../../format";
import { Zoom } from "../../photos";
import { FactsTable, NumberSheet, StockSheet, stockText, stockTone } from "../../products";
import type { StockMode } from "../../products";
import { DetailSkeleton } from "../../skeletons";
import { button, press } from "../../styles";
import {
  appear,
  createCopied,
  Failed,
  groupHead,
  hairline,
  Note,
  panel,
  Pill,
  Problem,
  SaveButton,
  Sheet,
  sheetRow,
  sub,
  tones,
} from "../../ui";
import type { Icon } from "../../ui";
import { copyText, formText, reasonText } from "../../words";

type SheetKind = StockMode | "price" | "menu";

/** A panel row: a label, what it holds on the right, and › when it opens something. */
const row = css.raw(hairline, {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  minHeight: "52px",
  px: "16px",
  py: "10px",
  textAlign: "left",
  fontVariantNumeric: "tabular-nums",
});

const tapRow = css.raw(row, {
  cursor: "pointer",
  transition: "background-color 120ms ease",
  _active: { bg: "fill" },
  "& > svg": { flex: "none", fontSize: "16px", color: "inkMuted" },
});

export default function ProductPage() {
  const params = useParams();
  const location = useLocation();
  const productId = () => Schema.decodeUnknownSync(ProductId)(params.id);

  // The list passes its URL in the link's state, so ‹ keeps her filters.
  const back = () => {
    const state = location.state;

    return Predicate.hasProperty(state, "back") && Predicate.isString(state.back)
      ? state.back
      : "/products";
  };

  const product = createMemo(() => {
    const id = productId();

    return runEffect(ApiClient.use((api) => api.getProduct({ productId: id })));
  });

  const now = createMemo(() => runEffect(DateTime.nowAsDate));
  const [sheet, setSheet] = createSignal<SheetKind>();
  const { write, busy, failed, setFailed } = createWrite({ source: product });

  const open = (next: SheetKind | undefined) => {
    setFailed(undefined);
    setSheet(next);
  };

  const close = () => open(undefined);

  const stockMode = () => {
    const current = sheet();

    return current === "count" || current === "receive" ? current : undefined;
  };

  return (
    <main class={css({ maxWidth: "640px", mx: "auto", pb: "60px" })}>
      <Errored fallback={(error) => <Problem error={error()} />}>
        <Loading fallback={<DetailSkeleton photo />}>
          <div class={css(appear)}>
            <NavBar
              back={back()}
              backLabel="Бараа"
              title={product().brand}
              onMore={() => open("menu")}
            />

            <div class={css({ px: "16px" })}>
              <Gallery product={product()} />
              <Heading product={product()} />
              <StockPanel product={product()} onOpen={open} />
              <Facts product={product()} />
              <Show when={product().label}>{(label) => <Label label={label()} />}</Show>
              <Show when={product().description}>
                {(description) => <Description text={description()} />}
              </Show>
              <History moves={product().moves} now={now()} />
            </div>

            <StockSheet
              product={stockMode() === undefined ? undefined : product()}
              mode={stockMode() ?? "count"}
              busy={busy()}
              failed={failed()}
              onClose={close}
              onCount={(counted) =>
                void write(
                  ApiClient.use((api) => api.countStock({ productId: productId(), counted })),
                  close,
                )
              }
              onReceive={(received) =>
                void write(
                  ApiClient.use((api) => api.receiveStock({ productId: productId(), received })),
                  close,
                )
              }
            />
            <NumberSheet
              open={sheet() === "price"}
              title="Үнэ"
              prompt={`Одоо ${money(product().price)}. Хуучин захиалгын үнэ өөрчлөгдөхгүй.`}
              start={product().price}
              price
              busy={busy()}
              failed={failed()}
              onClose={close}
              onSave={(price) =>
                void write(
                  ApiClient.use((api) => api.setPrice({ productId: productId(), price })),
                  close,
                )
              }
            />
            <MenuSheet
              open={sheet() === "menu"}
              product={product()}
              busy={busy()}
              failed={failed()}
              onClose={close}
              onArchive={(archived) =>
                void write(
                  ApiClient.use((api) => api.archiveProduct({ productId: productId(), archived })),
                  close,
                )
              }
            />
          </div>
        </Loading>
      </Errored>
    </main>
  );
}

/** The bottle on white, side by side when there are several; a tap shows one full size. */
function Gallery(props: { product: ProductDetail }) {
  const zoom = useContext(Zoom);
  const several = () => props.product.images.length > 1;

  return (
    <Show
      when={props.product.images.length > 0}
      fallback={
        <div
          class={css(panel, {
            mt: "6px",
            height: "160px",
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
        class={css(panel, {
          mt: "6px",
          display: "flex",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
        })}
      >
        <For each={props.product.images}>
          {(src, index) => (
            <button
              type="button"
              aria-label={`Зураг ${index() + 1} томоор харах`}
              onClick={() => zoom({ ...props.product, image: src })}
              class={css(
                {
                  flex: "none",
                  width: "100%",
                  height: "300px",
                  p: "16px",
                  scrollSnapAlign: "start",
                  cursor: "zoom-in",
                  "& img": { width: "100%", height: "100%", objectFit: "contain" },
                },
                several() && { width: "80%", px: "8px" },
              )}
            >
              <img
                src={sized(src, 640)}
                srcset={srcset(src, 320)}
                alt={`${props.product.brand} ${props.product.name}`}
                loading={index() === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}

function Heading(props: { product: ProductDetail }) {
  return (
    <div class={css({ px: "4px", pt: "16px" })}>
      <Show when={props.product.archivedAt !== null}>
        <div class={css({ mb: "8px" })}>
          <Pill tone="neutral">
            <ArchiveIcon />
            Архивласан
          </Pill>
        </div>
      </Show>
      <h1
        class={css({
          fontSize: "22px",
          lineHeight: "28px",
          fontWeight: "700",
          letterSpacing: "-0.01em",
          textWrap: "balance",
        })}
      >
        {props.product.nameMn}
      </h1>
      <p class={css(sub, { mt: "4px" })}>{props.product.name}</p>
    </div>
  );
}

const quickAction = css.raw(press, {
  display: "grid",
  justifyItems: "center",
  gap: "6px",
  py: "12px",
  textStyle: "footnote",
  fontWeight: "600",
  "& span": {
    display: "grid",
    placeItems: "center",
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    bg: "fill",
    fontSize: "22px",
  },
});

/** One quick action: an icon on a fill circle, its word under it. */
function QuickAction(props: { icon: Icon; label: string; onClick?: () => void; href?: string }) {
  return (
    <Show
      when={props.href}
      fallback={
        <button type="button" onClick={() => props.onClick?.()} class={css(quickAction)}>
          <span>
            <props.icon />
          </span>
          {props.label}
        </button>
      }
    >
      {(href) => (
        <a href={href()} class={css(quickAction)}>
          <span>
            <props.icon />
          </span>
          {props.label}
        </a>
      )}
    </Show>
  );
}

/** Price and what's left, each opening its pad, then the four things she does to a bottle. */
function StockPanel(props: { product: ProductDetail; onOpen: (sheet: SheetKind) => void }) {
  const { copied, copy } = createCopied();
  const level = () => stockLevel(props.product.stock);

  return (
    <>
      <div class={css(panel, { mt: "16px" })}>
        <button type="button" onClick={() => props.onOpen("price")} class={css(tapRow)}>
          <span class={css({ flex: 1, textStyle: "body" })}>Үнэ</span>
          <b class={css({ textStyle: "headline", fontWeight: "700" })}>
            {money(props.product.price)}
          </b>
          <CaretRightIcon />
        </button>
        <button type="button" onClick={() => props.onOpen("count")} class={css(tapRow)}>
          <span class={css({ flex: 1 })}>
            <span class={css({ display: "block", textStyle: "body" })}>Үлдэгдэл</span>
            <span class={css(sub, { display: "block" })}>
              {props.product.sold30 > 0
                ? `30 хоногт ${props.product.sold30} зарсан`
                : "30 хоногт зараагүй"}
            </span>
          </span>
          <b
            class={css(tones[stockTone[level()]], {
              bg: "transparent",
              textStyle: "headline",
              fontWeight: "700",
            })}
          >
            {stockText(props.product.stock)}
          </b>
          <CaretRightIcon />
        </button>
        <div
          class={css(hairline, {
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            px: "4px",
          })}
        >
          <QuickAction icon={HashIcon} label="Тоолох" onClick={() => props.onOpen("count")} />
          <QuickAction icon={PackageIcon} label="Ирсэн" onClick={() => props.onOpen("receive")} />
          <QuickAction icon={TagIcon} label="Үнэ" onClick={() => props.onOpen("price")} />
          <Show
            when={props.product.archivedAt === null}
            fallback={
              <QuickAction
                icon={ArchiveIcon}
                label="Сэргээх"
                onClick={() => props.onOpen("menu")}
              />
            }
          >
            <QuickAction
              icon={BagIcon}
              label="Захиалах"
              href={`/orders/new?add=${props.product.id}`}
            />
          </Show>
        </div>
      </div>
      <button
        type="button"
        onClick={() =>
          void copy(`${props.product.brand} ${props.product.name}\n${money(props.product.price)}`)
        }
        class={css(
          button.raw({ wide: true }),
          { mt: "10px" },
          copied() === "copied" && { bg: "okBg", color: "ok" },
        )}
      >
        <CopyIcon />
        {copyText[copied() ?? "idle"]}
      </button>
    </>
  );
}

/** The label facts she'd read off the bottle, skipping what the product doesn't have. */
const facts = (product: ProductDetail) =>
  [
    ["Хэлбэр", formText[product.form]],
    ["Тун", product.potency],
    ["Ширхэг", `${product.count}`],
    ["Нэг удаагийн хэмжээ", product.servingSize === null ? null : `${product.servingSize} ш`],
    ["Хэдэн удаа", product.servings === null ? null : `${product.servings}`],
    ["Өдөрт", product.dailyUnits === null ? null : `${product.dailyUnits} ш`],
    ["Амт", product.flavor],
    ["Суурь тос", product.base],
    ["Ангилал", product.category],
    ["Бар код", product.gtin],
  ].flatMap(([label, value]) => (value ? [{ label, value }] : []));

function Facts(props: { product: ProductDetail }) {
  return (
    <section>
      <h2 class={css(groupHead, { mt: "28px" })}>Мэдээлэл</h2>
      <dl class={css(panel)}>
        <For each={facts(props.product)} keyed={(fact) => fact.label}>
          {(fact) => (
            <div class={css(row, { minHeight: "46px" })}>
              <dt class={css({ flex: "none", textStyle: "body", color: "inkMuted" })}>
                {fact().label}
              </dt>
              <dd
                class={css({ flex: 1, textStyle: "body", fontWeight: "550", textAlign: "right" })}
              >
                {fact().value}
              </dd>
            </div>
          )}
        </For>
      </dl>
    </section>
  );
}

/** The label's text parts in listing order, skipping what it doesn't print. */
const labelParts = (label: ProductLabel) =>
  [
    ["Бусад найрлага", label.otherIngredients.join(", ")],
    ["Агуулсан", label.allergens.join(", ")],
    ["Агуулаагүй", label.freeOf.join(", ")],
    ["Хэрэглэх заавар", label.suggestedUse],
    ["Анхааруулга", label.warnings],
  ].flatMap(([title, text]) => (text ? [{ title, text }] : []));

function Label(props: { label: ProductLabel }) {
  return (
    <section>
      <h2 class={css(groupHead)}>Найрлага</h2>
      <div class={css(panel, { p: "16px", display: "grid", gap: "16px" })}>
        <FactsTable label={props.label} />
        <For each={labelParts(props.label)} keyed={(part) => part.title}>
          {(part) => (
            <div>
              <h3 class={css({ textStyle: "subhead", fontWeight: "650", mb: "2px" })}>
                {part().title}
              </h3>
              <p class={css({ textStyle: "body" })}>{part().text}</p>
            </div>
          )}
        </For>
        <Show when={props.label.certifications.length > 0}>
          <div class={css({ display: "flex", flexWrap: "wrap", gap: "6px" })}>
            <For each={props.label.certifications} keyed={false}>
              {(certification) => <Pill tone="neutral">{certification()}</Pill>}
            </For>
          </div>
        </Show>
        <a
          href={props.label.source}
          target="_blank"
          rel="noreferrer"
          class={css(sub, { textStyle: "footnote", textDecoration: "underline" })}
        >
          Эх сурвалж: {URL.parse(props.label.source)?.hostname ?? props.label.source}
        </a>
      </div>
    </section>
  );
}

function Description(props: { text: string }) {
  return (
    <section>
      <h2 class={css(groupHead)}>Тайлбар</h2>
      <div
        class={css(panel, {
          p: "16px",
          display: "grid",
          gap: "12px",
          textStyle: "body",
          lineHeight: "1.45",
        })}
      >
        <For each={props.text.split(/\n+/u)}>{(paragraph) => <p>{paragraph}</p>}</For>
      </div>
    </section>
  );
}

function History(props: { moves: ReadonlyArray<StockMove>; now: Date }) {
  return (
    <section>
      <h2 class={css(groupHead)}>Түүх</h2>
      <Show
        when={props.moves.length > 0}
        fallback={<p class={css(sub, { mx: "2px" })}>Хөдөлгөөн алга</p>}
      >
        <div class={css(panel)}>
          <For each={props.moves} keyed={(move) => move.id}>
            {(move) => <MoveRow move={move()} now={props.now} />}
          </For>
        </div>
      </Show>
    </section>
  );
}

/** One stock move; a sale or a cancel opens its order. */
function MoveRow(props: { move: StockMove; now: Date }) {
  const body = () => (
    <>
      <span class={css({ flex: 1, minWidth: 0 })}>
        <span class={css({ display: "block", textStyle: "body" })}>
          {reasonText[props.move.reason]}
          <Show when={props.move.orderNumber}>{(number) => <> #{number()}</>}</Show>
        </span>
        <span class={css(sub, { display: "block" })}>
          {when(props.move.createdAt, props.now)}
          <Show when={props.move.note}>{(note) => <> · {note()}</>}</Show>
        </span>
      </span>
      <b
        class={css(
          { textStyle: "headline", fontWeight: "700" },
          props.move.change > 0 && { color: "ok" },
        )}
      >
        {props.move.change > 0
          ? `+${props.move.change}`
          : props.move.change < 0
            ? `−${-props.move.change}`
            : "0"}
      </b>
    </>
  );

  return (
    <Show when={props.move.orderId} fallback={<div class={css(row)}>{body()}</div>}>
      {(orderId) => (
        <a href={`/orders/${orderId()}`} class={css(tapRow)}>
          {body()}
          <CaretRightIcon />
        </a>
      )}
    </Show>
  );
}

function MenuSheet(props: {
  open: boolean;
  product: ProductDetail;
  busy: boolean;
  failed: string | undefined;
  onClose: () => void;
  onArchive: (archived: boolean) => void;
}) {
  return (
    <Sheet
      open={props.open}
      title={props.product.nameMn}
      prompt={
        props.product.archivedAt === null ? (
          <Note>Хуучин захиалгууд хэвээр үлдэнэ. Хүссэн үедээ сэргээж болно.</Note>
        ) : (
          "Архивласан бараа жагсаалт болон шинэ захиалгад харагдахгүй."
        )
      }
      onClose={props.onClose}
    >
      <Show
        when={props.product.archivedAt === null}
        fallback={
          <SaveButton
            failed={props.failed}
            disabled={props.busy}
            onClick={() => props.onArchive(false)}
          >
            Сэргээх
          </SaveButton>
        }
      >
        <Failed text={props.failed} />
        <div class={css(panel)}>
          <button
            type="button"
            disabled={props.busy}
            onClick={() => props.onArchive(true)}
            class={css(sheetRow, { color: "owe" })}
          >
            <ArchiveIcon />
            Архивлах
          </button>
        </div>
      </Show>
    </Sheet>
  );
}
