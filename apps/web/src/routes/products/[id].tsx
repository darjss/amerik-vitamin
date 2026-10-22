import { ProductId, stockLevel } from "@amerik/contracts";
import type { ProductDetail, StockMove } from "@amerik/contracts";
import { useParams } from "@solidjs/router";
import * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";
import { createMemo, createSignal, Errored, For, Loading, Show, useContext } from "solid-js";
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
import { createWrite, runEffect } from "../../api/solid-effect";
import { money, sized, srcset, when } from "../../format";
import { Zoom } from "../../photos";
import { NumberSheet, stockText, stockTone } from "../../products";
import { DetailSkeleton } from "../../skeletons";
import {
  appear,
  button,
  createCopied,
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
  SaveButton,
  section,
  sectionHead,
  Sheet,
  sub,
  title2,
  wide,
} from "../../ui";
import type { Icon } from "../../ui";
import { formText, reasonText, stockAsk } from "../../words";

type SheetKind = "count" | "receive" | "price" | "menu";

export default function ProductPage() {
  const params = useParams();
  const productId = () => Schema.decodeUnknownSync(ProductId)(params.id);

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

            <Gallery product={product()} />
            <Heading product={product()} onPrice={() => open("price")} />
            <StockPanel stock={product().stock} sold30={product().sold30} />
            <QuickActions product={product()} onOpen={open} />
            <Facts product={product()} />
            <Show when={product().description}>
              {(description) => <Description text={description()} />}
            </Show>
            <History moves={product().moves} now={now()} />

            <NumberSheet
              open={sheet() === "count"}
              title="Тоолох"
              prompt="Тавиур дээр хэд байна?"
              start={product().stock ?? 0}
              min={0}
              busy={busy()}
              failed={failed()}
              onClose={close}
              onSave={(counted) =>
                void write(
                  ApiClient.use((api) => api.countStock({ productId: productId(), counted })),
                  close,
                )
              }
            />
            <NumberSheet
              open={sheet() === "receive"}
              title="Ирсэн бараа"
              prompt={`Хэдэн ширхэг ирсэн бэ? Одоо ${stockText(product().stock)}.`}
              start={1}
              min={1}
              busy={busy()}
              failed={failed()}
              onClose={close}
              onSave={(received) =>
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

function Gallery(props: { product: ProductDetail }) {
  const zoom = useContext(Zoom);

  return (
    <Show
      when={props.product.images.length > 0}
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
        <For each={props.product.images}>
          {(src, index) => (
            <button
              type="button"
              aria-label={`Зураг ${index() + 1} томоор харах`}
              onClick={() => zoom({ ...props.product, image: src })}
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

function Heading(props: { product: ProductDetail; onPrice: () => void }) {
  return (
    <div class={css({ px: "20px", pt: "8px" })}>
      <h1 class={css(title2, { fontSize: "26px", lineHeight: "32px", textWrap: "balance" })}>
        {props.product.name}
      </h1>
      <div class={css({ display: "flex", alignItems: "center", gap: "10px", mt: "12px" })}>
        <button
          type="button"
          aria-label="Үнэ өөрчлөх"
          onClick={() => props.onPrice()}
          class={css(press, {
            fontSize: "28px",
            lineHeight: "34px",
            fontWeight: "700",
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
          })}
        >
          {money(props.product.price)}
        </button>
        <span class={css({ flex: 1 })} />
        <Show when={props.product.archivedAt !== null}>
          <Pill tone="neutral">Архивласан</Pill>
        </Show>
      </div>
    </div>
  );
}

function StockPanel(props: { stock: number | null; sold30: number }) {
  const level = () => stockLevel(props.stock);

  return (
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
          {stockText(props.stock)}
        </div>
        <div class={css(sub, { fontVariantNumeric: "tabular-nums" })}>
          {props.sold30 > 0
            ? `Сүүлийн 30 хоногт ${props.sold30} зарсан`
            : "Сүүлийн 30 хоногт зараагүй"}
        </div>
      </div>
      <Show when={stockAsk[level()]}>
        {(ask) => <Pill tone={stockTone[level()]}>{ask()}</Pill>}
      </Show>
    </div>
  );
}

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

function QuickActions(props: { product: ProductDetail; onOpen: (sheet: SheetKind) => void }) {
  const { copied, copy } = createCopied();

  return (
    <>
      <div
        class={css({
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "10px",
          px: "16px",
          mt: "14px",
        })}
      >
        <QuickAction icon={HashIcon} label="Тоолох" onClick={() => props.onOpen("count")} />
        <QuickAction icon={PackageIcon} label="Ирсэн" onClick={() => props.onOpen("receive")} />
        <QuickAction icon={TagIcon} label="Үнэ" onClick={() => props.onOpen("price")} />
        <Show
          when={props.product.archivedAt === null}
          fallback={
            <QuickAction icon={ArchiveIcon} label="Сэргээх" onClick={() => props.onOpen("menu")} />
          }
        >
          <QuickAction
            icon={BagIcon}
            label="Захиалах"
            href={`/orders/new?add=${props.product.id}`}
          />
        </Show>
      </div>
      <button
        type="button"
        onClick={() =>
          void copy(`${props.product.brand} ${props.product.name}\n${money(props.product.price)}`)
        }
        class={css(
          button,
          { mx: "16px", mt: "10px", width: "calc(100% - 32px)" },
          copied() && { bg: "paidBg", color: "paid", boxShadow: "none" },
        )}
      >
        <CopyIcon />
        {copied() ? "Хуулсан" : "Нэр, үнэ хуулах"}
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
    ["Амт", product.flavor],
    ["Ангилал", product.category],
  ].flatMap(([label, value]) => (value ? [{ label, value }] : []));

function Facts(props: { product: ProductDetail }) {
  return (
    <section class={css(section)}>
      <div class={css(sectionHead)}>
        <h2 class={css(title2)}>Мэдээлэл</h2>
      </div>
      <dl class={css({ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px" })}>
        <For each={facts(props.product)} keyed={(fact) => fact.label}>
          {(fact) => (
            <>
              <dt class={css(sub, { fontSize: "17px", lineHeight: "22px" })}>{fact().label}</dt>
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
  );
}

function Description(props: { text: string }) {
  return (
    <section class={css(section)}>
      <div class={css(sectionHead)}>
        <h2 class={css(title2)}>Тайлбар</h2>
      </div>
      <div class={css({ display: "grid", gap: "12px", fontSize: "17px", lineHeight: "25px" })}>
        <For each={props.text.split(/\n+/u)}>{(paragraph) => <p>{paragraph}</p>}</For>
      </div>
    </section>
  );
}

function History(props: { moves: ReadonlyArray<StockMove>; now: Date }) {
  return (
    <section class={css(section)}>
      <div class={css(sectionHead)}>
        <h2 class={css(title2)}>Түүх</h2>
      </div>
      <Show when={props.moves.length > 0} fallback={<p class={css(sub)}>Хөдөлгөөн алга.</p>}>
        <For each={props.moves} keyed={(move) => move.id}>
          {(move) => <MoveRow move={move()} now={props.now} />}
        </For>
      </Show>
    </section>
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
        {props.move.change > 0 ? `+${props.move.change}` : `−${-props.move.change}`}
      </b>
    </div>
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
      title={props.product.name}
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
        <button
          type="button"
          disabled={props.busy}
          onClick={() => props.onArchive(true)}
          class={css(button, wide, { color: "owes" })}
        >
          <ArchiveIcon />
          Архивлах
        </button>
      </Show>
    </Sheet>
  );
}
