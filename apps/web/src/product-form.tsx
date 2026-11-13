import { priceFromAmazon, ProductForm } from "@amerik/contracts";
import type { CatalogOptions, NewProduct, ProductDraft, ProductId } from "@amerik/contracts";
import { useNavigate } from "@solidjs/router";
import * as Effect from "effect/Effect";
import { createSignal, createStore, For, Show, snapshot, untrack } from "solid-js";
import { css } from "styled-system/css";
import CaretRightIcon from "~icons/ph/caret-right-bold";
import CloseIcon from "~icons/ph/x-bold";

import { ApiClient } from "./api/client";
import { createWrite } from "./api/solid-effect";
import { digits, dollars, money, sized, srcset, thousands } from "./format";
import { FactsTable } from "./products";
import { chip, round } from "./styles";
import { Dock, groupHead, hairline, Note, panel, SaveButton, sub } from "./ui";
import { formText } from "./words";

const optionalInt = (text: string) => (digits(text) === "" ? null : Number(digits(text)));

/** The empty form for a product typed by hand. */
export const blank: ProductDraft = {
  brand: "",
  category: "vitamins",
  line: "",
  potency: null,
  count: 0,
  form: "capsule",
  flavor: null,
  base: null,
  name: "",
  nameMn: "",
  servingSize: null,
  servings: null,
  dailyUnits: null,
  description: "",
  images: [],
  asin: null,
  gtin: null,
  label: null,
  amazonUrl: null,
  amazonTitle: null,
  amazonCents: null,
  photoOnly: false,
  bannedWords: [],
  note: "",
};

/** A field in a white panel: its name small above what she types. */
const fieldRow = css.raw(hairline, {
  display: "grid",
  gap: "2px",
  minWidth: 0,
  px: "16px",
  py: "10px",
  textStyle: "footnote",
  fontWeight: "600",
  color: "inkMuted",
  "& input, & textarea": {
    width: "100%",
    bg: "transparent",
    outline: "none",
    textStyle: "body",
    fontWeight: "500",
    color: "ink",
    resize: "none",
    fieldSizing: "content",
    _placeholder: { color: "inkMuted", fontWeight: "400" },
  },
});

/** The second field of a row split in two: a line on its left instead of above. */
const sideField = css.raw({
  boxShadow: "inset 1px 0 0 {colors.line}",
  _before: { display: "none" },
});

/** The confirm form. She edits anything, adds the price, and saves. */
export function DraftForm(props: {
  initial: ProductDraft;
  existing: ProductId | null;
  options: CatalogOptions;
}) {
  const navigate = useNavigate();
  const initial = untrack(() => props.initial);

  const [draft, setDraft] = createStore({
    ...initial,
    images: [...initial.images],
    // Amazon's price suggests hers; she can change it before saving.
    price: initial.amazonCents === null ? 0 : priceFromAmazon(initial.amazonCents),
    stock: 0,
  });

  const { write, busy, failed } = createWrite();

  // "Already in the shop" holds for the fields it was said about. Changing
  // any identity field (or the ASIN) clears it, so a corrected product saves.
  const identity = () =>
    [
      draft.brand,
      draft.line,
      draft.potency,
      draft.count,
      draft.form,
      draft.flavor,
      draft.base,
      draft.asin,
    ].join("|");

  const [verdict, setVerdict] = createSignal(
    untrack(() => (props.existing === null ? undefined : { id: props.existing, for: identity() })),
  );

  const duplicate = () => {
    const said = verdict();

    return said !== undefined && said.for === identity() ? said.id : null;
  };

  const missing = () => {
    if (draft.brand.trim() === "") return "Брэнд";

    if (draft.name.trim() === "") return "Нэр";

    if (draft.nameMn.trim() === "") return "Монгол нэр";

    if (draft.count <= 0) return "Ширхэг";

    if (draft.price <= 0) return "Үнэ";

    return undefined;
  };

  const buttonText = () => {
    if (duplicate() !== null) return "Дэлгүүрт аль хэдийн байна";

    const needed = missing();

    return needed === undefined ? `Бараа нэмэх · ${money(draft.price)}` : `${needed} оруулна уу`;
  };

  const save = () => {
    const product: NewProduct = {
      brand: draft.brand.trim(),
      category: draft.category,
      // The line is part of the product's identity; a hand-typed product uses its name.
      line: (draft.line.trim() || draft.name).trim(),
      potency: draft.potency?.trim() || null,
      count: draft.count,
      form: draft.form,
      flavor: draft.flavor?.trim() || null,
      base: draft.base?.trim() || null,
      name: draft.name.trim(),
      nameMn: draft.nameMn.trim(),
      servingSize: draft.servingSize,
      servings: draft.servings,
      dailyUnits: draft.dailyUnits,
      description: draft.description.trim() || null,
      images: [...draft.images],
      asin: draft.asin,
      gtin: draft.gtin,
      label: snapshot(draft.label),
      price: draft.price,
      stock: draft.stock,
    };

    // A duplicate is an answer, not a failure: she gets a link to the one that exists.
    void write(
      ApiClient.use((api) => api.createProduct(product)).pipe(
        Effect.map((created) => ({ created, existing: null })),
        Effect.catchTag("DuplicateProduct", ({ productId }) =>
          Effect.succeed({ created: null, existing: productId }),
        ),
      ),
      (saved) =>
        saved.created === null
          ? setVerdict({ id: saved.existing, for: untrack(identity) })
          : navigate(`/products/${saved.created}`),
    );
  };

  // Empty numbers show as a blank field, not 0.
  const bind = <K extends keyof typeof draft>(
    key: K,
    parse: (text: string) => (typeof draft)[K],
  ) => ({
    value: draft[key] || "",
    onInput: (event: { currentTarget: { value: string } }) =>
      setDraft((next) => {
        next[key] = parse(event.currentTarget.value);
      }),
  });

  return (
    <div class={css({ display: "grid", px: "16px" })}>
      <Show when={duplicate()}>
        {(productId) => (
          <div class={css({ pt: "8px" })}>
            <Note large>
              Энэ бараа дэлгүүрт аль хэдийн байна.{" "}
              <a href={`/products/${productId()}`} class={css({ textDecoration: "underline" })}>
                Нээх
              </a>
            </Note>
          </div>
        )}
      </Show>
      <Show
        when={[
          draft.photoOnly ? "Amazon-оос олдсонгүй, зөвхөн зургаас уншив." : "",
          draft.bannedWords.length > 0
            ? `Тайлбарт хориотой үг байна: ${draft.bannedWords.join(", ")}`
            : "",
          draft.note,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {(note) => (
          <div class={css({ pt: "8px" })}>
            <Note>{note()}</Note>
          </div>
        )}
      </Show>

      <Show when={draft.images.length > 0}>
        <div
          class={css({
            display: "flex",
            gap: "10px",
            overflowX: "auto",
            mx: "-16px",
            px: "16px",
            pt: "12px",
            scrollbarWidth: "none",
          })}
        >
          <For each={draft.images}>
            {(src, index) => (
              <div
                class={css(panel, {
                  position: "relative",
                  flex: "none",
                  width: "132px",
                  height: "132px",
                  p: "10px",
                  "& img": { width: "100%", height: "100%", objectFit: "contain" },
                })}
              >
                <img src={sized(src, 264)} srcset={srcset(src, 132)} alt="" decoding="async" />
                <button
                  type="button"
                  aria-label={`Зураг ${index() + 1} хасах`}
                  onClick={() =>
                    setDraft((next) => {
                      next.images.splice(index(), 1);
                    })
                  }
                  class={css(round.raw({ tone: "glass" }), {
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    width: "30px",
                    height: "30px",
                    fontSize: "14px",
                  })}
                >
                  <CloseIcon />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={draft.amazonTitle}>
        {(title) => (
          <p class={css(sub, { px: "4px", pt: "10px" })}>
            Amazon:{" "}
            <a href={draft.amazonUrl ?? undefined} class={css({ color: "ink" })}>
              {title()}
            </a>
          </p>
        )}
      </Show>

      <h2 class={css(groupHead)}>Бараа</h2>
      <div class={css(panel)}>
        <label class={css(fieldRow)}>
          Брэнд
          <input list="brands" {...bind("brand", String)} />
          <datalist id="brands">
            <For each={props.options.brands}>{(brand) => <option value={brand} />}</For>
          </datalist>
        </label>
        <label class={css(fieldRow)}>
          Монгол нэр
          <textarea rows={2} {...bind("nameMn", String)} />
        </label>
        <label class={css(fieldRow)}>
          Нэр (англиар)
          <textarea rows={2} {...bind("name", String)} />
        </label>
        <div class={css(hairline, { display: "grid", gridTemplateColumns: "1fr 1fr" })}>
          <label class={css(fieldRow)}>
            Тун
            <input placeholder="1500 mcg" {...bind("potency", (text) => text || null)} />
          </label>
          <label class={css(fieldRow, sideField)}>
            Ширхэг
            <input inputmode="numeric" {...bind("count", (text) => Number(digits(text)))} />
          </label>
        </div>
      </div>

      <h2 class={css(groupHead)}>Хэлбэр</h2>
      <div class={css({ display: "flex", flexWrap: "wrap", gap: "8px" })}>
        <For each={ProductForm.literals}>
          {(value) => (
            <button
              type="button"
              onClick={() =>
                setDraft((next) => {
                  next.form = value;
                })
              }
              class={chip({ on: draft.form === value })}
            >
              {formText[value]}
            </button>
          )}
        </For>
      </div>

      <h2 class={css(groupHead)}>Ангилал</h2>
      <div class={css({ display: "flex", flexWrap: "wrap", gap: "8px" })}>
        <For each={props.options.categories}>
          {(category) => (
            <button
              type="button"
              onClick={() =>
                setDraft((next) => {
                  next.category = category.slug;
                })
              }
              class={chip({ on: draft.category === category.slug })}
            >
              {category.name}
            </button>
          )}
        </For>
      </div>

      <h2 class={css(groupHead)}>Үнэ ба үлдэгдэл</h2>
      <div class={css(panel, { display: "grid", gridTemplateColumns: "1fr 1fr" })}>
        <label class={css(fieldRow)}>
          Үнэ
          <input
            inputmode="numeric"
            placeholder="0₮"
            {...bind("price", (text) => Number(digits(text)))}
            value={draft.price === 0 ? "" : `${thousands(draft.price)}₮`}
            class={css({ fontWeight: "650", fontVariantNumeric: "tabular-nums" })}
          />
        </label>
        <label class={css(fieldRow, sideField)}>
          Үлдэгдэл
          <input
            inputmode="numeric"
            placeholder="Тоолоогүй"
            {...bind("stock", (text) => Number(digits(text)))}
            class={css({ fontVariantNumeric: "tabular-nums" })}
          />
        </label>
      </div>
      <p class={css(sub, { px: "4px", pt: "8px" })}>
        <Show when={draft.amazonCents}>
          {(cents) => (
            <>
              Amazon дээр {dollars(cents())}, тооцоолсон үнэ {money(priceFromAmazon(cents()))}.{" "}
            </>
          )}
        </Show>
        Үлдэгдэл хоосон бол тоолоогүй гэж нэмэгдэнэ.
      </p>

      <h2 class={css(groupHead)}>Тайлбар</h2>
      <label class={css(panel, fieldRow)}>
        <span class={css({ srOnly: true })}>Тайлбар</span>
        <textarea
          {...bind("description", String)}
          class={css({ minHeight: "180px", lineHeight: "1.45" })}
        />
      </label>

      <Show when={draft.label}>
        {(printed) => (
          <>
            <h2 class={css(groupHead)}>Найрлага</h2>
            <div class={css(panel, { p: "16px", display: "grid", gap: "12px" })}>
              <FactsTable label={printed()} />
              <Show when={printed().otherIngredients.join(", ")}>
                {(other) => <p class={css(sub)}>Бусад найрлага: {other()}</p>}
              </Show>
            </div>
          </>
        )}
      </Show>

      <details class={css({ mt: "20px", "&[open] summary svg": { transform: "rotate(90deg)" } })}>
        <summary
          class={css(groupHead, {
            mt: 0,
            listStyle: "none",
            cursor: "pointer",
            alignItems: "center",
            "&::-webkit-details-marker": { display: "none" },
            "& svg": { fontSize: "15px", transition: "transform 150ms ease" },
          })}
        >
          Бусад мэдээлэл
          <CaretRightIcon />
        </summary>
        <div class={css(panel)}>
          <label class={css(fieldRow)}>
            Шугам (англиар, брэнд, тун, тоогүй)
            <input {...bind("line", String)} />
          </label>
          <div class={css(hairline, { display: "grid", gridTemplateColumns: "1fr 1fr" })}>
            <label class={css(fieldRow)}>
              Амт
              <input {...bind("flavor", (text) => text || null)} />
            </label>
            <label class={css(fieldRow, sideField)}>
              Суурь тос
              <input placeholder="coconut oil" {...bind("base", (text) => text || null)} />
            </label>
          </div>
          <div class={css(hairline, { display: "grid", gridTemplateColumns: "1fr 1fr 1fr" })}>
            <label class={css(fieldRow)}>
              Нэг удаад
              <input inputmode="numeric" {...bind("servingSize", optionalInt)} />
            </label>
            <label class={css(fieldRow, sideField)}>
              Хэдэн удаа
              <input inputmode="numeric" {...bind("servings", optionalInt)} />
            </label>
            <label class={css(fieldRow, sideField)}>
              Өдөрт
              <input inputmode="numeric" {...bind("dailyUnits", optionalInt)} />
            </label>
          </div>
        </div>
      </details>

      <Dock>
        <SaveButton
          failed={failed()}
          disabled={busy() || missing() !== undefined || duplicate() !== null}
          onClick={() => save()}
        >
          {buttonText()}
        </SaveButton>
      </Dock>
    </div>
  );
}
