import { ProductForm } from "@amerik/contracts";
import type { CatalogOptions, NewProduct, ProductDraft, ProductId } from "@amerik/contracts";
import { useNavigate } from "@solidjs/router";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import {
  action,
  createOptimistic,
  createSignal,
  createStore,
  For,
  Show,
  untrack,
  useContext,
} from "solid-js";
import { css } from "styled-system/css";
import CloseIcon from "~icons/ph/x-bold";

import { ApiClient } from "./api/client";
import { RuntimeContext } from "./api/solid-effect";
import { Dock } from "./chrome";
import { failureText, money, thousands } from "./format";
import { formText } from "./product-parts";
import {
  act,
  button,
  chip,
  chipOn,
  Failed,
  field,
  glass,
  Note,
  panel,
  round,
  section,
  sectionHead,
  sub,
  title2,
  wide,
} from "./ui";

// The new-product form: filled by the drafting run, or empty for a hand-typed product.

const optionalInt = (text: string) => {
  const digits = text.replaceAll(/\D/gu, "");

  return digits === "" ? null : Number(digits);
};

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
  const runtime = useContext(RuntimeContext);
  const navigate = useNavigate();
  const initial = untrack(() => props.initial);

  const [form, setForm] = createStore({
    ...initial,
    images: [...initial.images],
    price: 0,
    stock: 0,
  });

  const [busy, setBusy] = createOptimistic(false);
  const [failed, setFailed] = createSignal<string>();
  const [duplicate, setDuplicate] = createSignal<ProductId | null>(untrack(() => props.existing));

  const missing = () => {
    if (form.brand.trim() === "") return "Брэнд";

    if (form.name.trim() === "") return "Нэр";

    if (form.count <= 0) return "Ширхэг";

    if (form.price <= 0) return "Үнэ";

    return undefined;
  };

  const save = action(async function* save() {
    setBusy(true);
    setFailed(undefined);

    const input: NewProduct = {
      brand: form.brand.trim(),
      category: form.category,
      // The line is part of the product's identity; a hand-typed product uses its name.
      line: (form.line.trim() || form.name).trim(),
      potency: form.potency?.trim() || null,
      count: form.count,
      form: form.form,
      flavor: form.flavor?.trim() || null,
      name: form.name.trim(),
      servingSize: form.servingSize,
      servings: form.servings,
      dailyUnits: form.dailyUnits,
      description: form.description.trim() || null,
      images: [...form.images],
      asin: form.asin,
      price: form.price,
      stock: form.stock,
    };

    // A duplicate is an answer, not a failure: she gets a link to the one that exists.
    const exit = await runtime.runPromiseExit(
      ApiClient.use((api) => api.createProduct(input)).pipe(
        Effect.map((created) => ({ created, existing: null })),
        Effect.catchTag("DuplicateProduct", ({ productId }) =>
          Effect.succeed({ created: null, existing: productId }),
        ),
      ),
    );

    yield;

    if (Exit.isFailure(exit)) {
      setFailed(failureText(exit.cause));

      return;
    }

    if (exit.value.created === null) setDuplicate(exit.value.existing);
    else navigate(`/products/${exit.value.created}`);
  });

  const text = (key: "brand" | "name" | "line") => ({
    value: form[key],
    onInput: (event: { currentTarget: HTMLInputElement }) =>
      setForm((draft) => {
        draft[key] = event.currentTarget.value;
      }),
  });

  const optional = (key: "potency" | "flavor") => ({
    value: form[key] ?? "",
    onInput: (event: { currentTarget: HTMLInputElement }) =>
      setForm((draft) => {
        draft[key] = event.currentTarget.value || null;
      }),
  });

  const number = (key: "servingSize" | "servings" | "dailyUnits") => ({
    inputmode: "numeric" as const,
    value: form[key] ?? "",
    onInput: (event: { currentTarget: HTMLInputElement }) =>
      setForm((draft) => {
        draft[key] = optionalInt(event.currentTarget.value);
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
      <Show when={form.note}>
        {(note) => (
          <div class={css({ px: "16px", pt: "8px" })}>
            <Note>{note()}</Note>
          </div>
        )}
      </Show>

      <Show when={form.images.length > 0}>
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
          <For each={form.images}>
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
                <img src={src} alt="" />
                <button
                  type="button"
                  aria-label={`Зураг ${index() + 1} хасах`}
                  onClick={() =>
                    setForm((draft) => {
                      draft.images.splice(index(), 1);
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

      <Show when={form.amazonTitle}>
        {(title) => (
          <p class={css(sub, { px: "20px", pt: "8px" })}>
            Amazon:{" "}
            <a href={form.amazonUrl ?? undefined} class={css({ color: "sel" })}>
              {title()}
            </a>
          </p>
        )}
      </Show>

      <section class={css(section, { mt: "20px", display: "grid", gap: "14px" })}>
        <label class={css(label)}>
          Брэнд
          <input list="brands" class={css(input)} {...text("brand")} />
          <datalist id="brands">
            <For each={props.options.brands}>{(brand) => <option value={brand} />}</For>
          </datalist>
        </label>
        <label class={css(label)}>
          Нэр
          <input class={css(input)} {...text("name")} />
        </label>
        <div class={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" })}>
          <label class={css(label)}>
            Тун
            <input class={css(input)} placeholder="1500 mcg" {...optional("potency")} />
          </label>
          <label class={css(label)}>
            Ширхэг
            <input
              inputmode="numeric"
              class={css(input)}
              value={form.count === 0 ? "" : form.count}
              onInput={(event) =>
                setForm((draft) => {
                  draft.count = optionalInt(event.currentTarget.value) ?? 0;
                })
              }
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
                  setForm((draft) => {
                    draft.form = value;
                  })
                }
                class={css(chip, { height: "36px" }, form.form === value && chipOn)}
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
                  setForm((draft) => {
                    draft.category = category.slug;
                  })
                }
                class={css(chip, { height: "36px" }, form.category === category.slug && chipOn)}
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
              value={form.price === 0 ? "" : `${thousands(form.price)}₮`}
              onInput={(event) =>
                setForm((draft) => {
                  draft.price = optionalInt(event.currentTarget.value) ?? 0;
                })
              }
              class={css(input, { fontWeight: "650", fontVariantNumeric: "tabular-nums" })}
            />
          </label>
          <label class={css(label)}>
            Үлдэгдэл
            <input
              inputmode="numeric"
              placeholder="0"
              value={form.stock === 0 ? "" : form.stock}
              onInput={(event) =>
                setForm((draft) => {
                  draft.stock = optionalInt(event.currentTarget.value) ?? 0;
                })
              }
              class={css(input, { fontVariantNumeric: "tabular-nums" })}
            />
          </label>
        </div>
        <Show when={form.amazonCents}>
          {(cents) => (
            <p class={css(sub, { mt: "-6px" })}>
              Amazon дээр ${(cents() / 100).toFixed(2)}. Шинэ бараа тоолоогүй үлдэгдэлтэй нэмэгдэнэ.
            </p>
          )}
        </Show>
      </section>

      <section class={css(section, { mt: "22px", display: "grid", gap: "8px" })}>
        <label class={css(label)}>
          Тайлбар
          <textarea
            rows={9}
            value={form.description}
            onInput={(event) =>
              setForm((draft) => {
                draft.description = event.currentTarget.value;
              })
            }
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
              <input class={css(input)} {...text("line")} />
            </label>
            <div class={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" })}>
              <label class={css(label)}>
                Амт
                <input class={css(input)} {...optional("flavor")} />
              </label>
              <label class={css(label)}>
                Нэг удаагийн хэмжээ
                <input class={css(input)} {...number("servingSize")} />
              </label>
              <label class={css(label)}>
                Хэдэн удаа
                <input class={css(input)} {...number("servings")} />
              </label>
              <label class={css(label)}>
                Өдөрт хэдэн ширхэг
                <input class={css(input)} {...number("dailyUnits")} />
              </label>
            </div>
          </div>
        </details>
      </section>

      <Dock>
        <Failed text={failed()} />
        <button
          type="button"
          disabled={busy() || missing() !== undefined || duplicate() !== null}
          onClick={() => void save()}
          class={css(button, act, wide)}
        >
          {missing() === undefined
            ? `Бараа нэмэх · ${money(form.price)}`
            : `${missing()} оруулна уу`}
        </button>
      </Dock>
    </div>
  );
}
