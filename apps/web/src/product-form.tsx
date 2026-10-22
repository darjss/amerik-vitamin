import { priceFromAmazon, ProductForm } from "@amerik/contracts";
import type { CatalogOptions, NewProduct, ProductDraft, ProductId } from "@amerik/contracts";
import { useNavigate } from "@solidjs/router";
import * as Effect from "effect/Effect";
import { createSignal, createStore, For, Show, untrack } from "solid-js";
import { css } from "styled-system/css";
import CloseIcon from "~icons/ph/x-bold";

import { ApiClient } from "./api/client";
import { createWrite } from "./api/solid-effect";
import { digits, money, sized, srcset, thousands } from "./format";
import {
  chip,
  chipOn,
  Dock,
  field,
  glass,
  Note,
  panel,
  round,
  SaveButton,
  section,
  sectionHead,
  sub,
  title2,
} from "./ui";
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
  name: "",
  servingSize: null,
  servings: null,
  dailyUnits: null,
  description: "",
  images: [],
  asin: null,
  amazonUrl: null,
  amazonTitle: null,
  amazonCents: null,
  photoOnly: false,
  bannedWords: [],
  note: "",
};

const label = css.raw({ display: "grid", gap: "6px", fontSize: "15px", color: "inkMuted" });

/** A text field; the ink color keeps typed text dark inside the muted label. */
export const input = css.raw(field, { color: "ink" });

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
  const [duplicate, setDuplicate] = createSignal<ProductId | null>(untrack(() => props.existing));

  const missing = () => {
    if (draft.brand.trim() === "") return "Брэнд";

    if (draft.name.trim() === "") return "Нэр";

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
      name: draft.name.trim(),
      servingSize: draft.servingSize,
      servings: draft.servings,
      dailyUnits: draft.dailyUnits,
      description: draft.description.trim() || null,
      images: [...draft.images],
      asin: draft.asin,
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
          ? setDuplicate(saved.existing)
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
    <div class={css({ display: "grid" })}>
      <Show when={duplicate()}>
        {(productId) => (
          <div class={css({ px: "16px", pt: "8px" })}>
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
          <div class={css({ px: "16px", pt: "8px" })}>
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
            px: "16px",
            pt: "12px",
            pb: "6px",
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
                  p: "8px",
                  bg: "white",
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
                  class={css(round, glass, {
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
          <p class={css(sub, { px: "20px", pt: "8px" })}>
            Amazon:{" "}
            <a href={draft.amazonUrl ?? undefined} class={css({ color: "sel" })}>
              {title()}
            </a>
          </p>
        )}
      </Show>

      <section class={css(section, { mt: "20px", display: "grid", gap: "14px" })}>
        <label class={css(label)}>
          Брэнд
          <input list="brands" class={css(input)} {...bind("brand", String)} />
          <datalist id="brands">
            <For each={props.options.brands}>{(brand) => <option value={brand} />}</For>
          </datalist>
        </label>
        <label class={css(label)}>
          Нэр
          <input class={css(input)} {...bind("name", String)} />
        </label>
        <div class={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" })}>
          <label class={css(label)}>
            Тун
            <input
              class={css(input)}
              placeholder="1500 mcg"
              {...bind("potency", (text) => text || null)}
            />
          </label>
          <label class={css(label)}>
            Ширхэг
            <input
              inputmode="numeric"
              class={css(input)}
              {...bind("count", (text) => Number(digits(text)))}
            />
          </label>
        </div>
      </section>

      <section class={css(section, { mt: "22px" })}>
        <div class={css(sectionHead, { mb: "10px" })}>
          <h2 class={css(title2, { fontSize: "18px" })}>Хэлбэр</h2>
        </div>
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
                class={css(chip, { height: "36px" }, draft.form === value && chipOn)}
              >
                {formText[value]}
              </button>
            )}
          </For>
        </div>
      </section>

      <section class={css(section, { mt: "22px" })}>
        <div class={css(sectionHead, { mb: "10px" })}>
          <h2 class={css(title2, { fontSize: "18px" })}>Ангилал</h2>
        </div>
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
                class={css(chip, { height: "36px" }, draft.category === category.slug && chipOn)}
              >
                {category.name}
              </button>
            )}
          </For>
        </div>
      </section>

      <section class={css(section, { mt: "22px", display: "grid", gap: "14px" })}>
        <div class={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" })}>
          <label class={css(label)}>
            Үнэ
            <input
              inputmode="numeric"
              placeholder="0₮"
              {...bind("price", (text) => Number(digits(text)))}
              value={draft.price === 0 ? "" : `${thousands(draft.price)}₮`}
              class={css(input, { fontWeight: "650", fontVariantNumeric: "tabular-nums" })}
            />
          </label>
          <label class={css(label)}>
            Үлдэгдэл
            <input
              inputmode="numeric"
              placeholder="0"
              {...bind("stock", (text) => Number(digits(text)))}
              class={css(input, { fontVariantNumeric: "tabular-nums" })}
            />
          </label>
        </div>
        <Show when={draft.amazonCents}>
          {(cents) => (
            <p class={css(sub, { mt: "-6px" })}>
              Amazon дээр ${(cents() / 100).toFixed(2)}, тооцоолсон үнэ{" "}
              {money(priceFromAmazon(cents()))}. Үлдэгдэл хоосон бол тоолоогүй гэж нэмэгдэнэ.
            </p>
          )}
        </Show>
      </section>

      <section class={css(section, { mt: "22px", display: "grid", gap: "8px" })}>
        <label class={css(label)}>
          Тайлбар
          <textarea
            rows={9}
            {...bind("description", String)}
            class={css(input, { lineHeight: "23px", resize: "vertical" })}
          />
        </label>
      </section>

      <section class={css(section, { mt: "18px" })}>
        <details>
          <summary class={css(sub, { cursor: "pointer", py: "6px" })}>Бусад мэдээлэл</summary>
          <div class={css({ display: "grid", gap: "12px", pt: "10px" })}>
            <label class={css(label)}>
              Шугам (англиар, брэнд, тун, тоогүй)
              <input class={css(input)} {...bind("line", String)} />
            </label>
            <div class={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" })}>
              <label class={css(label)}>
                Амт
                <input class={css(input)} {...bind("flavor", (text) => text || null)} />
              </label>
              <label class={css(label)}>
                Нэг удаагийн хэмжээ
                <input
                  inputmode="numeric"
                  class={css(input)}
                  {...bind("servingSize", optionalInt)}
                />
              </label>
              <label class={css(label)}>
                Хэдэн удаа
                <input inputmode="numeric" class={css(input)} {...bind("servings", optionalInt)} />
              </label>
              <label class={css(label)}>
                Өдөрт хэдэн ширхэг
                <input
                  inputmode="numeric"
                  class={css(input)}
                  {...bind("dailyUnits", optionalInt)}
                />
              </label>
            </div>
          </div>
        </details>
      </section>

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
